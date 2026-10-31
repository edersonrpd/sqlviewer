"use client";

import { useMemo, useState } from "react";
import { formatarValor, NOMES_TIPOS } from "@/lib/formatacao";
import type { ResultadoParse } from "@/lib/tipos";
import { IconeCopiar, IconeX } from "./Icones";
import { copiarTexto, useAviso } from "./util";

/** JSON ou XML formatado, quando o valor for um deles; null se for texto comum. */
export function valorEstruturado(v: string): { tipo: "JSON" | "XML"; texto: string } | null {
  const t = v.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return { tipo: "JSON", texto: JSON.stringify(JSON.parse(t), null, 2) };
    } catch {
      return null;
    }
  }
  if (t.startsWith("<") && t.endsWith(">") && /<\/?[A-Za-z]/.test(t)) {
    // recuo simples: uma tag por linha, aninhamento por 2 espaços
    let nivel = 0;
    const partes = t.replace(/>\s*</g, ">\n<").split("\n");
    const linhas = partes.map((p) => {
      if (/^<\//.test(p)) nivel = Math.max(0, nivel - 1);
      const l = "  ".repeat(nivel) + p;
      if (/^<[^!?/][^>]*[^/]>$/.test(p) && !/<\/[^>]+>$/.test(p)) nivel++;
      return l;
    });
    return { tipo: "XML", texto: linhas.join("\n") };
  }
  return null;
}

type Props = {
  dados: ResultadoParse;
  /** linha (índice em dados.linhas) e coluna da célula ativa; null = nada selecionado */
  linha: number | null;
  coluna: number | null;
  onFechar: () => void;
};

/** Painel lateral com o valor completo da célula ativa (texto longo, JSON/XML formatado). */
export function VisualizadorValor({ dados, linha, coluna, onFechar }: Props) {
  const [quebrar, setQuebrar] = useState(true);
  const [aviso, setAviso] = useAviso(2000);
  const col = coluna !== null ? dados.colunas[coluna] : null;
  const v = linha !== null && coluna !== null ? dados.linhas[linha]?.[coluna] : undefined;
  const estruturado = useMemo(() => (typeof v === "string" ? valorEstruturado(v) : null), [v]);
  const exibido = col && typeof v === "string" ? formatarValor(v, col.tipo) : null;

  return (
    <aside className="flex w-[min(380px,45%)] shrink-0 animate-deslizar flex-col border-l border-zinc-900/[0.08] bg-[#fafbfe] dark:border-white/[0.08] dark:bg-[#101219]">
      <div className="flex items-center gap-2 border-b border-zinc-900/[0.08] px-3 py-2 dark:border-white/[0.08]">
        <h3 className="text-sm font-semibold">Valor</h3>
        {col && (
          <span className="truncate font-mono text-xs text-zinc-500" title={col.nome}>
            {col.nome} · {NOMES_TIPOS[col.tipo]}
          </span>
        )}
        <button className="btn-icone ml-auto" title="Fechar painel" aria-label="Fechar painel de valor" onClick={onFechar}>
          <IconeX className="h-3.5 w-3.5" />
        </button>
      </div>

      {v === undefined || !col ? (
        <p className="p-4 text-sm text-zinc-500">Selecione uma célula na tabela para ver o valor completo aqui.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {v === null ? (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-medium dark:bg-white/10">NULL</span>
            ) : (
              <>
                <span>{v.length.toLocaleString("pt-BR")} caractere(s)</span>
                {estruturado && <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">{estruturado.tipo}</span>}
                {v !== v.trim() && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">espaços nas pontas</span>}
              </>
            )}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={quebrar} onChange={(e) => setQuebrar(e.target.checked)} /> Quebrar linhas
            </label>
          </div>

          {v === null ? (
            <p className="valor-null">NULL — sem valor no banco</p>
          ) : (
            <>
              <Bloco
                titulo={estruturado ? `${estruturado.tipo} formatado` : "Valor original"}
                texto={estruturado ? estruturado.texto : v}
                quebrar={quebrar}
                onCopiar={async (t) => setAviso((await copiarTexto(t)) ? "Copiado" : "Não foi possível copiar")}
              />
              {estruturado && (
                <Bloco titulo="Valor original" texto={v} quebrar={quebrar} onCopiar={async (t) => setAviso((await copiarTexto(t)) ? "Copiado" : "Não foi possível copiar")} />
              )}
              {exibido !== null && exibido !== v && (
                <Bloco titulo="Como aparece na tabela" texto={exibido} quebrar={quebrar} onCopiar={async (t) => setAviso((await copiarTexto(t)) ? "Copiado" : "Não foi possível copiar")} />
              )}
            </>
          )}
          {aviso && <span className="text-xs text-emerald-600 dark:text-emerald-400">{aviso}</span>}
        </div>
      )}
    </aside>
  );
}

function Bloco({ titulo, texto, quebrar, onCopiar }: { titulo: string; texto: string; quebrar: boolean; onCopiar: (t: string) => void }) {
  return (
    <section>
      <p className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-500">
        {titulo}
        <button className="btn-icone h-6 w-6" title="Copiar" aria-label={`Copiar ${titulo}`} onClick={() => onCopiar(texto)}>
          <IconeCopiar className="h-3.5 w-3.5" />
        </button>
      </p>
      <pre
        className={`max-h-[50vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-2.5 font-mono text-xs leading-relaxed select-text dark:border-white/10 dark:bg-zinc-950 ${
          quebrar ? "break-words whitespace-pre-wrap" : "whitespace-pre"
        }`}
      >
        {texto === "" ? <span className="text-zinc-400 italic">(vazio)</span> : texto}
      </pre>
    </section>
  );
}
