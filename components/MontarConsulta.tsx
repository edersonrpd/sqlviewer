"use client";

import { useMemo, useState } from "react";
import { BUSCAS_RAPIDAS } from "@/config/perfis";
import { identificarMarketplace, normalizarNumpok } from "@/lib/marketplace";
import { montarConsulta, separarValores, temJoin } from "@/lib/montar";
import { CodigoSql } from "./CodigoSql";
import { IconeCopiar } from "./Icones";
import { SeloMarketplace } from "./SeloMarketplace";
import { copiarTexto, useAviso } from "./util";

/** Gera o SELECT (ou o JOIN completo) a partir de um ou mais números, para rodar no MySQL e colar o resultado. */
export function MontarConsulta() {
  const [id, setId] = useState(BUSCAS_RAPIDAS[0].id);
  const [texto, setTexto] = useState("");
  const [comJoin, setComJoin] = useState(true);
  // a prévia começa fechada para não empurrar a área de colar em telas menores
  const [verSql, setVerSql] = useState(false);
  const [aviso, setAviso] = useAviso();

  const busca = BUSCAS_RAPIDAS.find((b) => b.id === id) ?? BUSCAS_RAPIDAS[0];
  const podeJoin = useMemo(() => temJoin(busca), [busca]);
  const valores = useMemo(() => separarValores(texto), [texto]);
  const sql = montarConsulta(busca, valores, podeJoin && comJoin);
  // NUMPOK: mostra como cada número vai para o SQL (com o prefixo do marketplace)
  const convertidos = useMemo(() => {
    if (!busca.prefixarMarketplace) return [];
    return valores.map((v) => ({ original: v, final: normalizarNumpok(v) })).filter((c) => identificarMarketplace(c.final));
  }, [busca, valores]);

  return (
    <section className="painel animate-subir px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold whitespace-nowrap" title="Digite o número, copie o SQL, rode no MySQL e cole o resultado abaixo">
          Montar consulta
        </h3>
        <select className="campo" value={id} onChange={(e) => setId(e.target.value)} aria-label="Tipo de busca">
          {BUSCAS_RAPIDAS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.rotulo}
            </option>
          ))}
        </select>
        <input
          className="campo min-w-56 flex-1 font-mono"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`${busca.exemplo} (vários: separe por vírgula)`}
          aria-label="Valores"
        />
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
