"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Registra o service worker (só em produção), que deixa o app abrir sem internet. */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelado = false;
    // a biblioteca do Excel é carregada só ao exportar: buscá-la uma vez, já com o service worker
    // no controle, a deixa guardada para exportar também sem internet
    const guardarSobDemanda = () => {
      if (!cancelado && navigator.onLine) void import("xlsx").catch(() => undefined);
    };
    const quandoControlar = () => {
      if (navigator.serviceWorker.controller) setTimeout(guardarSobDemanda, 3000);
      else navigator.serviceWorker.addEventListener("controllerchange", () => setTimeout(guardarSobDemanda, 3000), { once: true });
    };
    navigator.serviceWorker
      .register("/sw.js")
      .then(quandoControlar)
      .catch(() => {
        // sem service worker o app funciona igual, só não abre offline
      });
    return () => {
      cancelado = true;
    };
  }, []);
}

/** Botão "Instalar", exibido quando o navegador oferece instalar o app (Chrome e Edge). */
export function BotaoInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  useEffect(() => {
    const oferecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const instalado = () => setEvento(null);
    window.addEventListener("beforeinstallprompt", oferecer);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", oferecer);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);
  if (!evento) return null;
  return (
    <button
      className="btn-icone h-9 w-auto shrink-0 gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-sm font-medium dark:border-white/10"
      title="Instalar o SQL Viewer como aplicativo: abre em janela própria e funciona sem internet"
      onClick={async () => {
        await evento.prompt();
        await evento.userChoice;
        setEvento(null);
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
        <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
      </svg>
      <span className="baixa:sr-only">Instalar</span>
    </button>
  );
}
