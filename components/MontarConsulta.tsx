"use client";

import { useMemo, useState } from "react";
import { BUSCAS_RAPIDAS } from "@/config/perfis";
import { identificarMarketplace } from "@/lib/marketplace";
import { conversaoDaBusca, montarConsulta, separarValores, temJoin } from "@/lib/montar";
import { buscarPerfil } from "@/lib/perfis";
import { CodigoSql } from "./CodigoSql";
import { IconeCopiar } from "./Icones";
import { SeloMarketplace } from "./SeloMarketplace";
import { copiarTexto, useAviso } from "./util";

// grupos do menu, na ordem em que aparecem nas buscas
const GRUPOS = [...new Set(BUSCAS_RAPIDAS.map((b) => b.grupo))];

/** Gera o SELECT (ou o JOIN completo) a partir de um ou mais números, para rodar no MySQL e colar o resultado. */
export function MontarConsulta() {
  const [id, setId] = useState(BUSCAS_RAPIDAS[0].id);
  const [texto, setTexto] = useState("");
  // filtro adicional (ex.: domínio do cliente no HUB); fica guardado ao trocar de busca
  const [textoExtra, setTextoExtra] = useState("");
  const [comJoin, setComJoin] = useState(true);
  // a prévia começa fechada para não empurrar a área de colar em telas menores
  const [verSql, setVerSql] = useState(false);
  const [aviso, setAviso] = useAviso();

  const busca = BUSCAS_RAPIDAS.find((b) => b.id === id) ?? BUSCAS_RAPIDAS[0];
  // tabelas de outro banco (ex.: HUB): o SQL não roda no banco do ERP
  const banco = buscarPerfil(busca.perfil)?.banco;
  const podeJoin = useMemo(() => temJoin(busca), [busca]);
  const valores = useMemo(() => separarValores(texto, busca.separarSoPorVirgula), [texto, busca.separarSoPorVirgula]);
  const extras = useMemo(() => separarValores(textoExtra), [textoExtra]);
  const sql = montarConsulta(busca, valores, podeJoin && comJoin, extras);
  // NUMPOK / order_id do HUB: mostra como cada número vai para o SQL (com ou sem o prefixo do marketplace)
  const convertidos = useMemo(() => {
    const converter = conversaoDaBusca(busca);
    if (!converter) return [];
    return valores.map((v) => ({ original: v, final: converter(v) })).filter((c) => identificarMarketplace(c.final));
  }, [busca, valores]);

  return (
    <section className="painel animate-subir px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold whitespace-nowrap" title="Digite o número, copie o SQL, rode no MySQL e cole o resultado abaixo">
          Montar consulta
        </h3>
        <select className="campo" value={id} onChange={(e) => setId(e.target.value)} aria-label="Tipo de busca">
          {GRUPOS.map((g) => (
            <optgroup key={g} label={g}>
              {BUSCAS_RAPIDAS.filter((b) => b.grupo === g).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.rotulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          className="campo min-w-56 flex-1 font-mono"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`${busca.exemplo} (vários: separe por vírgula)`}
          aria-label="Valores"
        />
        {busca.filtroExtra && (
          <input
            className="campo w-40 font-mono"
            value={textoExtra}
            onChange={(e) => setTextoExtra(e.target.value)}
            placeholder={`${busca.filtroExtra.rotulo}: ${busca.filtroExtra.exemplo}`}
            aria-label={busca.filtroExtra.rotulo}
            title={`${busca.filtroExtra.rotulo} (opcional; vários: separe por vírgula)`}
          />
        )}
        {podeJoin && (
          <label className="inline-flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400" title="Traz as tabelas relacionadas na mesma consulta; ao colar, cada uma abre na sua aba">
            <input type="checkbox" checked={comJoin} onChange={(e) => setComJoin(e.target.checked)} />
            Tudo de uma vez (JOIN)
          </label>
        )}
        <button
          className="btn"
          disabled={!sql}
          style={{ opacity: sql ? undefined : 0.5 }}
          onClick={async () => sql && setAviso((await copiarTexto(sql)) ? "SQL copiado" : "Não foi possível copiar")}
        >
          <IconeCopiar className="h-4 w-4" /> Copiar SQL
        </button>
        {sql && (
          <button className="text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => setVerSql(!verSql)}>
            {verSql ? "Ocultar SQL" : "Ver SQL"}
          </button>
        )}
        {valores.length > 1 && <span className="text-xs text-zinc-500">{valores.length} valores</span>}
        {banco && (
          <span
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
            title={`Estas tabelas ficam no banco do ${banco}, não no do ERP: rode o SQL conectado ao banco do ${banco}`}
          >
            Rodar no banco do {banco}
          </span>
        )}
        {aviso && <span className="text-xs text-emerald-600">{aviso}</span>}
      </div>
      {convertidos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="NUMPOK identificados">
          {convertidos.slice(0, 8).map((c) => (
            <li
              key={c.original}
              className="inline-flex animate-surgir items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 py-0.5 pr-2.5 pl-1 font-mono text-xs dark:border-white/10 dark:bg-white/5"
            >
              <SeloMarketplace valor={c.final} compacto />
              {c.final !== c.original.trim() && <span className="text-zinc-400 line-through decoration-zinc-300">{c.original}</span>}
              {c.final !== c.original.trim() && <span className="text-zinc-400">→</span>}
              <span className="font-semibold">{c.final}</span>
            </li>
          ))}
          {convertidos.length > 8 && <li className="self-center text-xs text-zinc-500">+{convertidos.length - 8}</li>}
        </ul>
      )}
      {sql && verSql && (
        <CodigoSql sql={sql} className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-100 p-2.5 dark:bg-zinc-950" />
      )}
    </section>
  );
}
