import { useMemo } from "react";
import { formatarSql, tokenizarSql, type TipoToken } from "@/lib/sql";

const CORES: Partial<Record<TipoToken, string>> = {
  palavra: "font-semibold text-blue-700 dark:text-blue-300",
  funcao: "text-violet-700 dark:text-violet-300",
  texto: "text-emerald-700 dark:text-emerald-300",
  numero: "text-amber-700 dark:text-amber-300",
  comentario: "italic text-zinc-400",
  pontuacao: "text-zinc-500 dark:text-zinc-400",
};

/** SQL com realce de sintaxe (e quebra de linhas quando vem numa linha só e é longo). */
export function CodigoSql({ sql, className, formatar = true }: { sql: string; className?: string; formatar?: boolean }) {
  const tokens = useMemo(() => tokenizarSql(formatar ? formatarSql(sql) : sql), [sql, formatar]);
  return (
    <pre className={`font-mono text-xs leading-relaxed whitespace-pre-wrap break-words ${className ?? ""}`}>
      <Tokens tokens={tokens} />
    </pre>
  );
}

/** SQL de uma linha, com realce, para listas (corta com reticências; o texto completo fica no title). */
export function SqlEmLinha({ sql, className }: { sql: string; className?: string }) {
  const tokens = useMemo(() => tokenizarSql(sql), [sql]);
  return (
    <code className={`font-mono text-xs ${className ?? ""}`} title={sql}>
      <Tokens tokens={tokens} />
    </code>
  );
}

function Tokens({ tokens }: { tokens: ReturnType<typeof tokenizarSql> }) {
  return (
    <>
        {tokens.map((t, k) =>
          CORES[t.tipo] ? (
            <span key={k} className={CORES[t.tipo]}>
              {t.texto}
            </span>
          ) : (
            t.texto
          ),
        )}
    </>
  );
}
