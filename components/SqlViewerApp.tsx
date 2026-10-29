"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { estadoInicial, reducer, type Acao } from "@/lib/estado";
import { separarPorMarcadores } from "@/lib/join";
import { parsearConsulta } from "@/lib/parser";
import { AbaConsulta } from "./AbaConsulta";
import { EntradaConsulta } from "./EntradaConsulta";
import { IconeLua, IconeMais, IconeSol, IconeX } from "./Icones";

export function SqlViewerApp() {
  const [estado, dispatch] = useReducer(reducer, estadoInicial);
  const temAbas = estado.abas.length > 0;

  // Uso descartável: pede confirmação ao fechar/recarregar com consultas abertas.
  useEffect(() => {
    if (!temAbas) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [temAbas]);

  const visualizar = useCallback((texto: string): string | null => {
    const dados = parsearConsulta(texto);
    if (dados.colunas.length === 0) return "Nada para visualizar: cole o resultado da consulta com a linha de cabeçalho.";
    // resultado do JOIN sugerido (com marcadores >>TABELA): uma aba por tabela
    const partes = separarPorMarcadores(dados);
    if (partes) dispatch({ tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    else dispatch({ tipo: "criar", dados });
    return null;
  }, []);

  // estáveis, para o aviso de "Desfazer" não reiniciar a contagem a cada renderização
  const reabrir = useCallback(() => dispatch({ tipo: "reabrir" }), []);
  const descartarFechada = useCallback(() => dispatch({ tipo: "descartarFechada" }), []);

  const ativa = estado.abas.find((a) => a.id === estado.ativa) ?? null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="flex items-center gap-2 py-2 text-base font-semibold whitespace-nowrap">
          <span className="inline-block h-5 w-5 rounded bg-blue-600" aria-hidden />
          SQL Viewer
        </h1>
        <BarraAbas estado={estado} dispatch={dispatch} />
        <BotaoTema />
      </header>

      <main className="min-h-0 flex-1">
        {ativa ? (
          <AbaConsulta key={ativa.id} aba={ativa} abas={estado.abas} dispatch={dispatch} />
        ) : (
          <EntradaConsulta
            onVisualizar={visualizar}
            onCancelar={temAbas ? () => dispatch({ tipo: "ativar", id: estado.abas[estado.abas.length - 1].id }) : undefined}
          />
        )}
      </main>

      {estado.fechada && (
        <AvisoDesfazer
          key={estado.fechada.aba.id}
          nome={estado.fechada.aba.nome}
          onDesfazer={reabrir}
          onExpirar={descartarFechada}
        />
      )}
    </div>
  );
}

const SEGUNDOS_DESFAZER = 10;

/** "Aba X fechada · Desfazer": fechar é imediato e o engano tem volta (Ctrl+Shift+Z também desfaz). */
function AvisoDesfazer({ nome, onDesfazer, onExpirar }: { nome: string; onDesfazer: () => void; onExpirar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onExpirar, SEGUNDOS_DESFAZER * 1000);
    const teclas = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onDesfazer();
      }
    };
    window.addEventListener("keydown", teclas);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", teclas);
    };
  }, [onDesfazer, onExpirar]);

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
    >
      <span>
        Aba <strong>{nome}</strong> fechada
      </span>
      <button
        className="rounded-md px-2 py-1 font-semibold text-blue-300 hover:bg-white/10 dark:text-blue-700 dark:hover:bg-black/10"
        onClick={onDesfazer}
        title="Ctrl+Shift+Z"
      >
        Desfazer
      </button>
      <button className="rounded p-1 opacity-60 hover:opacity-100" onClick={onExpirar} aria-label="Dispensar">
        <IconeX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BarraAbas({ estado, dispatch }: { estado: typeof estadoInicial; dispatch: React.Dispatch<Acao> }) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <nav className="flex min-w-0 flex-1 items-end gap-1 self-stretch overflow-x-auto pt-2" aria-label="Consultas abertas">
      {estado.abas.map((a) => {
        const ativa = a.id === estado.ativa;
        return (
          <div
            key={a.id}
            // clique com o botão do meio fecha, como nas abas do navegador
            onAuxClick={(e) => {
              if (e.button === 1) dispatch({ tipo: "fechar", id: a.id });
            }}
            className={`group flex max-w-56 shrink-0 items-center gap-1 rounded-t-md border border-b-0 px-2 py-1 text-sm ${
              ativa
                ? "border-zinc-300 bg-zinc-50 font-medium dark:border-zinc-700 dark:bg-zinc-950"
                : "border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {editando === a.id ? (
              <input
                autoFocus
                defaultValue={a.nome}
                className="campo w-36 py-0.5"
                aria-label="Nome da aba"
                onBlur={(e) => {
                  dispatch({ tipo: "renomear", id: a.id, nome: e.target.value });
                  setEditando(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditando(null);
                }}
              />
            ) : (
              <button
                className="truncate"
                title={`${a.nome} — clique duas vezes para renomear`}
                onClick={() => dispatch({ tipo: "ativar", id: a.id })}
                onDoubleClick={() => setEditando(a.id)}
              >
                {a.nome}
              </button>
            )}
            <button
              className="btn-icone h-5 w-5"
              title="Fechar aba"
              aria-label={`Fechar ${a.nome}`}
              onClick={() => dispatch({ tipo: "fechar", id: a.id })}
            >
              <IconeX className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      <button
        className={`mb-1 ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ${
          estado.ativa === null ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
        }`}
        onClick={() => dispatch({ tipo: "ativar", id: null })}
      >
        <IconeMais /> Nova consulta
      </button>
    </nav>
  );
}

function BotaoTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => setEscuro(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      className="btn-icone h-8 w-8"
      title={escuro ? "Usar tema claro" : "Usar tema escuro"}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => {
        document.documentElement.classList.toggle("dark", !escuro);
        setEscuro(!escuro);
      }}
    >
      {escuro ? <IconeSol /> : <IconeLua />}
    </button>
  );
}
