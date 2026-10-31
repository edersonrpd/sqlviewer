"use client";

import { useEffect, useMemo, useState } from "react";
import { colunaDestaque } from "@/lib/destaque";
import type { Aba } from "@/lib/estado";
import { buscarPerfil } from "@/lib/perfis";
import { relacionadosDoRegistro } from "@/lib/relacionados";
import { Celula } from "./Celula";
import { IconeCopiar, IconeDireita, IconeEsquerda, IconeLink, IconeOlhoFechado, IconeX } from "./Icones";
import { SeloMarketplace } from "./SeloMarketplace";
import { BotaoCopiarChamado } from "./Saidas";
import { copiarTexto, useAviso } from "./util";

type Props = {
  aba: Aba;
  abas: Aba[];
  /** linhas filtradas e ordenadas, para Anterior/Próximo */
  indices: number[];
  colunasExibidas: number[];
  onNavegar: (registro: number) => void;
  onFechar: () => void;
  onAbrirTela: () => void;
  onAbrirRelacao: (destino: string, coluna: number, valor: string, rotulo: string) => void;
};

export function FichaRegistro({ aba, abas, indices, colunasExibidas, onNavegar, onFechar, onAbrirTela, onAbrirRelacao }: Props) {
  const registro = aba.registro!;
  const { dados } = aba;
  const linha = dados.linhas[registro];
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useAviso();

  const posicao = indices.indexOf(registro);
  const anterior = posicao > 0 ? indices[posicao - 1] : null;
  const proximo = posicao >= 0 && posicao < indices.length - 1 ? indices[posicao + 1] : null;

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT") {
        if (e.key === "Escape") onFechar();
        return;
      }
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft" && anterior !== null) onNavegar(anterior);
      if (e.key === "ArrowRight" && proximo !== null) onNavegar(proximo);
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [anterior, proximo, onNavegar, onFechar]);

  const perfil = buscarPerfil(aba.perfilId);
  const jTitulo = perfil?.colunaTitulo ? dados.colunas.findIndex((c) => c.nome === perfil.colunaTitulo) : -1;
  const destaque = colunaDestaque(dados.colunas, perfil);
  const valorDestaque = destaque ? linha[destaque.j] : null;
  const titulo = jTitulo >= 0 ? `${dados.colunas[jTitulo].nome}: ${linha[jTitulo] ?? "NULL"}` : `Registro ${registro + 1}`;

  // todos os campos: visíveis na ordem da tabela, depois os ocultos
  const campos = useMemo(() => {
    const vis = new Set(colunasExibidas);
    const todas = [...colunasExibidas, ...dados.colunas.map((_, j) => j).filter((j) => !vis.has(j))];
    // coluna destacada (ex.: NUMPOK) sempre no topo
    const ordem = destaque ? [destaque.j, ...todas.filter((j) => j !== destaque.j)] : todas;
    const t = busca.trim().toLowerCase();
    return ordem.filter((j) => !t || dados.colunas[j].nome.toLowerCase().includes(t)).map((j) => ({ j, oculta: !vis.has(j) }));
  }, [colunasExibidas, dados.colunas, busca, destaque]);

  const relacionados = useMemo(() => relacionadosDoRegistro(aba, registro, abas), [aba, registro, abas]);

  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside
        className="gaveta max-w-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Ficha do registro"
      >
        <header className="space-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-mono text-base font-semibold" title={titulo}>
                {titulo}
              </h2>
              {destaque && (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-sm dark:border-amber-700 dark:bg-amber-950/50" title={destaque.nome}>
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">{destaque.rotulo}</span>
                  <SeloMarketplace valor={valorDestaque} compacto />
                  {valorDestaque === null ? (
                    <span className="valor-null">NULL</span>
                  ) : valorDestaque.trim() === "" ? (
                    <span className="text-zinc-400">não informado</span>
                  ) : (
                    <>
                      <span className="font-mono font-bold text-amber-950 dark:text-amber-100">{valorDestaque}</span>
                      <button
                        className="btn-icone h-5 w-5"
                        title="Copiar"
                        onClick={async () => setAviso((await copiarTexto(valorDestaque)) ? `${destaque.nome} copiado` : "Não foi possível copiar")}
                      >
                        <IconeCopiar className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </p>
              )}
              <p className="text-xs text-zinc-500 tabular-nums">
                {posicao >= 0
                  ? `Registro ${posicao + 1} de ${indices.length} (filtro e ordenação atuais)`
                  : "Registro fora do filtro atual"}
              </p>
            </div>
            <button className="btn-icone" onClick={onFechar} aria-label="Fechar ficha" title="Fechar (Esc)">
              <IconeX />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn px-2" disabled={anterior === null} onClick={() => anterior !== null && onNavegar(anterior)} title="Anterior (←)">
              <IconeEsquerda /> Anterior
            </button>
            <button className="btn px-2" disabled={proximo === null} onClick={() => proximo !== null && onNavegar(proximo)} title="Próximo (→)">
              Próximo <IconeDireita />
            </button>
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={onAbrirTela} title="Ver este registro como tela de ERP">
                Abrir como tela
              </button>
              <BotaoCopiarChamado dados={dados} tabela={perfil?.tabela} linhas={[registro]} colunas={colunasExibidas} rotulo="Copiar para chamado" semLinhas="Nenhuma coluna visível" />
            </div>
          </div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campo" className="campo w-full" aria-label="Buscar campo na ficha" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {relacionados.length > 0 && (
            <section className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Relacionados</h3>
              <ul className="flex flex-wrap gap-2">
                {relacionados.map((r) => {
                  const vazio = r.quantidade === 0 || r.chave === null;
                  return (
                    <li key={`${r.abaId}-${r.colunaDestino}-${r.rotulo}`}>
                      <button
                        disabled={vazio}
                        onClick={() => onAbrirRelacao(r.abaId, r.colunaDestino, r.chave!, r.rotulo)}
                        title={vazio ? "Nenhum registro ligado nesta aba" : `Abrir a aba "${r.abaNome}" filtrando ${r.colunaDestinoNome} = ${r.chave}`}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ${
                          vazio
                            ? "cursor-default border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                            : "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900"
                        }`}
                      >
                        <IconeLink className="h-3.5 w-3.5" />
                        {r.rotulo} <span className="tabular-nums">({r.quantidade})</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {campos.map(({ j, oculta }) => {
              const c = dados.colunas[j];
              const v = linha[j];
              return (
                <div
                  key={j}
                  className={`group grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-start gap-2 px-4 py-1.5 ${
                    destaque?.j === j
                      ? "bg-amber-50 font-semibold dark:bg-amber-950/40"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <dt className="flex items-center gap-1 truncate pt-0.5 font-mono text-xs text-zinc-500" title={c.nome}>
                    {oculta && <IconeOlhoFechado className="h-3 w-3 shrink-0 opacity-60" />}
                    <span className="truncate">{c.nome}</span>
                  </dt>
                  <dd className="min-h-5 text-sm break-words whitespace-pre-wrap" title={v === null ? "NULL" : v}>
                    <Celula valor={v} tipo={c.tipo} />
                  </dd>
                  <button
                    className="btn-icone h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Copiar valor"
                    aria-label={`Copiar ${c.nome}`}
                    onClick={async () => {
                      const ok = await copiarTexto(v === null ? "NULL" : v);
                      setAviso(ok ? `${c.nome} copiado` : "Não foi possível copiar");
                    }}
                  >
                    <IconeCopiar className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {campos.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">Nenhum campo encontrado.</p>}
          </dl>
        </div>

        {aviso && (
          <div role="status" className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {aviso}
          </div>
        )}
      </aside>
    </div>
  );
}
