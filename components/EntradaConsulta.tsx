"use client";

import { useRef, useState } from "react";
import { IconeCadeado, IconeDireita } from "./Icones";
import { MontarConsulta } from "./MontarConsulta";

export function EntradaConsulta({
  onVisualizar,
  onCancelar,
}: {
  onVisualizar: (texto: string) => string | null;
  onCancelar?: () => void;
}) {
  // não controlada: colar dezenas de MB num textarea controlado pelo React é muito lento
  const ref = useRef<HTMLTextAreaElement>(null);
  const [temTexto, setTemTexto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = () => {
    const el = ref.current;
    if (!el) return;
    const e = onVisualizar(el.value);
    setErro(e);
    if (!e) {
      el.value = "";
      setTemTexto(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 overflow-y-auto p-4 sm:p-8">
      <div className="flex animate-subir flex-col gap-2.5">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <IconeCadeado className="h-3.5 w-3.5" />
          100% no navegador — nada é enviado nem salvo
        </span>
        <h2 className="bg-gradient-to-r from-zinc-900 via-indigo-700 to-cyan-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-white dark:via-indigo-200 dark:to-cyan-300">
          Nova consulta
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          No cliente MySQL, execute a consulta, selecione as linhas do resultado (Ctrl+A no grid) e copie{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">com o cabeçalho</strong> (ex.: botão direito →{" "}
          <em>Copiar linhas com nomes de coluna</em>). Depois cole abaixo e clique em{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">Visualizar</strong>. Ao fechar a página, tudo é descartado.
        </p>
      </div>

      <MontarConsulta />

      {/* moldura com borda luminosa girando */}
      <div className="relative flex min-h-72 flex-1 animate-subir overflow-hidden rounded-2xl p-[1.5px] [animation-delay:80ms]">
        <div
          aria-hidden
          className={`absolute top-1/2 left-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${
            temTexto ? "opacity-100" : "opacity-60"
          }`}
        >
          <div className="h-full w-full animate-girar bg-[conic-gradient(from_0deg,transparent_0deg,rgb(99_102_241/0.9)_60deg,rgb(34_211_238/0.9)_110deg,transparent_160deg,transparent_360deg)]" />
        </div>
        <div className="relative flex flex-1 flex-col rounded-[15px] bg-white/95 backdrop-blur-xl dark:bg-zinc-900/95">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3.5 py-2 font-mono text-xs text-zinc-500 dark:border-white/10" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2">resultado.tsv</span>
            <span className="ml-auto">TAB · UTF-8</span>
          </div>
          <textarea
            autoFocus
            ref={ref}
            onInput={(e) => setTemTexto(/\S/.test(e.currentTarget.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
            }}
            spellCheck={false}
            wrap="off"
            placeholder={'"AUTOINCREM"\t"FGO_CODEMP"\t"FGO_NUMDOC"\t...\n"00100000000000001001"\t"001"\t"000001000001"\t...'}
            aria-label="Resultado da consulta"
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-3.5 py-3 dark:border-white/10">
            <button className="btn-primario h-11 px-5" onClick={enviar} disabled={!temTexto}>
              Visualizar
              <IconeDireita className="h-4 w-4" />
            </button>
            {onCancelar && (
              <button className="btn h-11 px-4" onClick={onCancelar}>
                Cancelar
              </button>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500">
              <kbd className="rounded-md border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
                Ctrl
              </kbd>
              +
              <kbd className="rounded-md border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
                Enter
              </kbd>
              também visualiza
            </span>
          </div>
        </div>
      </div>

      {erro && (
        <p role="alert" className="animate-surgir rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}
    </div>
  );
}
