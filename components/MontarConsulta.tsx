"use client";

import { useMemo, useState } from "react";
import { BUSCAS_RAPIDAS } from "@/config/perfis";
import { montarConsulta, separarValores, temJoin } from "@/lib/montar";
import { IconeCopiar } from "./Icones";
import { copiarTexto, useAviso } from "./util";

/** Gera o SELECT (ou o JOIN completo) a partir de um ou mais números, para rodar no MySQL e colar o resultado. */
export function MontarConsulta() {
  const [id, setId] = useState(BUSCAS_RAPIDAS[0].id);
  const [texto, setTexto] = useState("");
  const [comJoin, setComJoin] = useState(true);
  const [aviso, setAviso] = useAviso();

  const busca = BUSCAS_RAPIDAS.find((b) => b.id === id) ?? BUSCAS_RAPIDAS[0];
  const podeJoin = useMemo(() => temJoin(busca), [busca]);
  const valores = useMemo(() => separarValores(texto), [texto]);
  const sql = montarConsulta(busca, valores, podeJoin && comJoin);

  return (
    <section className="painel animate-subir p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Montar consulta</h3>
        <span className="text-xs text-zinc-500">digite o número, copie o SQL, rode no MySQL e cole o resultado abaixo</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
          placeholder={`${busca.exemplo} (vários: separe por vírgula ou espaço)`}
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
        {aviso && <span className="text-xs text-emerald-600">{aviso}</span>}
      </div>
      {sql && (
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs leading-relaxed dark:bg-zinc-950">{sql}</pre>
      )}
      {valores.length > 1 && <p className="mt-1.5 text-xs text-zinc-500">{valores.length} valores</p>}
    </section>
  );
}
