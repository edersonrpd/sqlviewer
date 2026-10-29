"use client";

import { useRef, useState } from "react";

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
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-3 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Nova consulta</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          No cliente MySQL, execute a consulta, selecione as linhas do resultado (Ctrl+A no grid) e copie{" "}
          <strong>com o cabeçalho</strong> (ex.: botão direito → <em>Copiar linhas com nomes de coluna</em>). Depois cole
          abaixo e clique em <strong>Visualizar</strong>.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Os dados ficam só neste navegador: nada é enviado para servidor nem salvo. Ao fechar a página, tudo é descartado.
        </p>
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
        className="campo min-h-64 flex-1 resize-none p-3 font-mono text-xs leading-relaxed"
      />

      {erro && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-primario" onClick={enviar} disabled={!temTexto}>
          Visualizar
        </button>
        {onCancelar && (
          <button className="btn" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-500">Ctrl+Enter também visualiza</span>
      </div>
    </div>
  );
}
