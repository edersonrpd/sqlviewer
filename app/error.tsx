"use client";

/**
 * Erro inesperado na interface: em vez da página em branco, explica o que houve e
 * deixa tentar de novo. Os dados colados ficam só na memória; recarregar a página os descarta.
 */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Algo deu errado ao exibir esta tela</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        O erro aconteceu no navegador e nenhum dado foi enviado. Tente de novo; se continuar, recarregue a página e cole a
        consulta outra vez (sessões salvas em arquivo podem ser reabertas).
      </p>
      <pre className="max-h-40 w-full overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-red-300">
        {error.message || "Erro desconhecido"}
      </pre>
      <div className="flex gap-2">
        <button className="btn-primario h-10 px-4" onClick={reset}>
          Tentar de novo
        </button>
        <button className="btn h-10 px-4" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
      </div>
    </div>
  );
}
