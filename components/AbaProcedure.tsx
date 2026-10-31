"use client";

import { useMemo, useState } from "react";
import { conferirProcedure, type ConferenciaProcedure } from "@/lib/conferirProcedure";
import type { Aba, Acao } from "@/lib/estado";
import { buscarPerfil } from "@/lib/perfis";
import { analisarProcedure, type Condicao, type Etapa, type ResultadoRegra } from "@/lib/procedure";
import { CodigoSql, SqlEmLinha } from "./CodigoSql";
import { IconeAlerta, IconeBanco, IconeSeta } from "./Icones";

const TITULO: Record<Etapa["tipo"], string> = { monta: "Monta", retira: "Retira pedidos de", insere: "Insere em", atualiza: "Atualiza" };

/**
 * Aba de uma procedure colada (ex.: esp_InserePedidosFATAUT): lista as regras lidas do
 * próprio código e, com o pedido aberto em outra aba, confere cada uma com ele.
 * Nada é executado: é só leitura do texto.
 */
export function AbaProcedure({ aba, abas }: { aba: Aba; abas: Aba[]; dispatch: React.Dispatch<Acao> }) {
  const analise = useMemo(() => analisarProcedure(aba.procedure ?? ""), [aba.procedure]);
  const [verCodigo, setVerCodigo] = useState(false);

  // pedidos abertos para conferir (abas com o perfil FATGOR)
  const pedidos = abas.filter((a) => a.perfilId === "FATGOR" && a.dados.linhas.length > 0);
  const [escolha, setEscolha] = useState<{ abaId: string; registro: number } | null>(null);
  const atual = escolha && pedidos.some((p) => p.id === escolha.abaId) ? escolha : pedidos[0] ? { abaId: pedidos[0].id, registro: pedidos[0].registroTela ?? 0 } : null;
  const abaPedido = atual ? pedidos.find((p) => p.id === atual.abaId)! : null;
  const registro = atual?.registro ?? 0;
  const conferencia = useMemo(
    () => (abaPedido ? conferirProcedure(analise, abaPedido, registro, abas) : null),
    [analise, abaPedido, registro, abas],
  );

  const rotuloPedido = (p: Aba, i: number) => {
    const perfil = buscarPerfil(p.perfilId);
    const j = p.dados.colunas.findIndex((c) => c.nome === (perfil?.colunaTitulo ?? "FGO_NUMDOC"));
    const je = p.dados.colunas.findIndex((c) => c.nome === "FGO_CODEMP");
    return `${p.nome} · ${j >= 0 ? p.dados.linhas[i][j] : `linha ${i + 1}`}${je >= 0 ? ` (empresa ${p.dados.linhas[i][je]})` : ""}`;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-5">
        <section className="painel animate-subir p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_0_20px_rgb(139_92_246/0.45)]" aria-hidden>
              <IconeBanco className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Procedure · só leitura das regras</p>
              <h2 className="truncate font-mono text-xl font-bold">{analise.nome}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Regras lidas do código colado (nada é executado). Cada cliente tem a sua procedure: o que aparece aqui é o que está escrito nesta.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {analise.grava.length > 0 && <Lista rotulo="Grava em" itens={analise.grava} destaque />}
            {analise.le.length > 0 && <Lista rotulo="Lê" itens={analise.le} />}
            {analise.variaveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-500">Parâmetros fixos</span>
                {analise.variaveis.map((v) => (
                  <span key={v.nome} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs dark:border-white/10 dark:bg-white/5" title={v.nota ?? v.tipo}>
                    {v.nome} = <strong>{v.valor}</strong>
                    {v.nota && <span className="ml-1 text-zinc-400">({v.nota})</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel animate-subir p-4 [animation-delay:60ms]">
          <h3 className="text-sm font-semibold">Conferir com um pedido</h3>
          {pedidos.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Abra o pedido (FATGOR) em outra aba para conferir as regras com ele. Para conferir também extensão, itens e a FATAUT, use o
              “Tudo de uma vez (JOIN)” do Montar consulta.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="campo max-w-full"
                  value={`${atual!.abaId}|${atual!.registro}`}
                  onChange={(e) => {
                    const [abaId, r] = e.target.value.split("|");
                    setEscolha({ abaId, registro: Number(r) });
                  }}
                  aria-label="Pedido para conferir"
                >
                  {pedidos.flatMap((p) =>
                    p.dados.linhas.slice(0, 500).map((_, i) => (
                      <option key={`${p.id}|${i}`} value={`${p.id}|${i}`}>
                        {rotuloPedido(p, i)}
                      </option>
                    )),
                  )}
                </select>
                {conferencia && <Veredito c={conferencia} />}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                Confere com o que está nas abas abertas. Regras que dependem de tabelas não abertas ou de cálculo da procedure (ex.: saldo) ficam com “?”.
              </p>
            </>
          )}
        </section>

        {analise.etapas.map((e, k) => (
          <EtapaCard key={k} n={k + 1} etapa={e} conf={conferencia?.etapas[k] ?? null} />
        ))}

        {analise.blocosDesativados.map((b, k) => (
          <section key={k} className="painel animate-subir border-dashed p-4 opacity-90">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">Bloco desativado</span>
              <span className="font-medium">{b.titulo || "Trecho comentado"}</span>
              <Reqs reqs={b.requisitos} />
            </p>
            <Recolhivel rotulo="Ver SQL desativado">
              <CodigoSql sql={b.sql} formatar={false} className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-100 p-2.5 dark:bg-zinc-950" />
            </Recolhivel>
          </section>
        ))}

        <section className="painel p-4">
          <button className="inline-flex items-center gap-1 text-sm font-medium" onClick={() => setVerCodigo(!verCodigo)} aria-expanded={verCodigo}>
            <IconeSeta className={`h-4 w-4 transition ${verCodigo ? "" : "-rotate-90"}`} /> Código completo
          </button>
          {verCodigo && <CodigoSql sql={aba.procedure ?? ""} formatar={false} className="mt-2 max-h-[70vh] overflow-auto rounded-lg bg-zinc-100 p-2.5 dark:bg-zinc-950" />}
        </section>
      </div>
    </div>
  );
}

function Lista({ rotulo, itens, destaque }: { rotulo: string; itens: string[]; destaque?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500">{rotulo}</span>
      {itens.map((t) => (
        <span
          key={t}
          className={`rounded-md px-2 py-0.5 font-mono text-xs ${
            destaque ? "bg-violet-100 font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" : "bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-300"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Veredito({ c }: { c: ConferenciaProcedure }) {
  const cls =
    c.barrou > 0
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
      : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  return (
    <span className={`inline-flex animate-surgir flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5 text-sm ${cls}`} role="status">
      <strong>{c.barrou > 0 ? `${c.barrou} regra(s) barram o pedido` : "Nenhuma regra conferida barra o pedido"}</strong>
      <span className="text-xs opacity-80">
        {c.passou} atendida(s) · {c.semDados} sem dados para conferir
      </span>
    </span>
  );
}

function Status({ r }: { r: ResultadoRegra | null | undefined }) {
  if (r === undefined) return null;
  const [txt, cls, titulo] =
    !r || r.ok === null
      ? ["?", "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300", "Não dá para conferir com as abas abertas"]
      : r.ok
        ? ["✓", "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", "Atende"]
        : ["✗", "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", "Barra o pedido"];
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${cls}`} title={titulo} aria-label={titulo}>
      {txt}
    </span>
  );
}

function Reqs({ reqs }: { reqs: string[] }) {
  return (
    <>
      {reqs.map((r) => (
        <span key={r} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title="Requisito citado no comentário">
          REQ {r}
        </span>
      ))}
    </>
  );
}

function Regra({ c, r, prefixo }: { c: Condicao; r?: ResultadoRegra | null; prefixo?: string }) {
  return (
    <li className="flex gap-2.5 py-2">
      <Status r={r} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {prefixo}
          <span className="font-medium">{c.descricao ?? "Condição"}</span>
        </p>
        <SqlEmLinha sql={c.sql} className="mt-0.5 block truncate rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800/80" />
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          <Reqs reqs={c.requisitos} />
          {c.nota && <span>{c.nota}</span>}
          {r && <span className={r.ok === false ? "font-medium text-red-600 dark:text-red-400" : ""}>→ {r.motivo}</span>}
        </div>
      </div>
    </li>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{titulo}</p>
      <ul className="divide-y divide-zinc-100 dark:divide-white/5">{children}</ul>
    </div>
  );
}

function Recolhivel({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mt-1">
      <button className="text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => setAberto(!aberto)}>
        {aberto ? "Ocultar" : rotulo}
      </button>
      {aberto && children}
    </div>
  );
}

function EtapaCard({ n, etapa: e, conf }: { n: number; etapa: Etapa; conf: ConferenciaProcedure["etapas"][number] | null }) {
  const inner = e.juncoes.map((j, k) => ({ j, r: conf?.juncoes[k] })).filter((x) => x.j.tipo === "INNER" && e.tipo !== "retira");
  const left = e.juncoes.filter((j) => j.tipo !== "INNER");
  return (
    <section className="painel animate-subir p-4">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-100 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">{n}</span>
        {TITULO[e.tipo]} <span className="font-mono">{e.alvo}</span>
        {e.de && <span className="font-normal text-zinc-500">a partir de <span className="font-mono">{e.de}</span></span>}
      </h3>
      {e.quando && (
        <p className="mt-1 text-xs text-zinc-500">
          Só quando: <SqlEmLinha sql={e.quando} />
        </p>
      )}
      {e.notas.map((t) => (
        <p key={t} className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <Reqs reqs={[...t.matchAll(/\bREQ(?:UISITO)?\b\s*[:.]?\s*(\d{4,})/gi)].map((m) => m[1])} /> {t}
        </p>
      ))}

      {inner.length > 0 && (
        <Grupo titulo="Precisa existir (INNER JOIN)">
          {inner.map(({ j, r }) => (
            <Regra key={j.tabela + j.on} c={{ sql: j.on, descricao: `${j.tabela}${j.descricao ? ` — ${j.descricao}` : ""}`, nota: j.nota, requisitos: j.requisitos }} r={conf ? (r ?? null) : undefined} />
          ))}
        </Grupo>
      )}
      {e.condicoes.length > 0 && (
        <Grupo titulo="Condições (todas precisam ser verdadeiras)">
          {e.condicoes.map((c, k) => (
            <Regra key={k} c={c} r={conf ? conf.condicoes[k] : undefined} />
          ))}
        </Grupo>
      )}
      {e.retiraSe.length > 0 && (
        <Grupo titulo="Retira o pedido quando">
          {e.retiraSe.map((c, k) => (
            <Regra key={k} c={c} r={conf ? conf.retiraSe[k] : undefined} prefixo="Algum item com " />
          ))}
        </Grupo>
      )}
      {(e.agrupamento || e.having) && (
        <Grupo titulo="Agrupamento">
          {e.agrupamento && (
            <li className="py-2 text-sm">
              Agrupa por <SqlEmLinha sql={e.agrupamento} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800/80" />
            </li>
          )}
          {e.having && <Regra c={e.having} r={conf ? conf.having : undefined} prefixo="Mantém só quando: " />}
        </Grupo>
      )}
      {e.calculadas.length > 0 && (
        <Grupo titulo="Colunas calculadas">
          {e.calculadas.map((c) => (
            <li key={c.nome} className="py-2 text-sm">
              <span className="font-mono font-semibold">{c.nome}</span>
              <CodigoSql sql={c.sql.replace(/\s+(WHEN|ELSE|END)\b/g, "\n  $1").replace(/\s+THEN\b/g, "\n    THEN")} formatar={false} className="mt-1 rounded bg-zinc-100 p-2 dark:bg-zinc-800/80" />
            </li>
          ))}
        </Grupo>
      )}
      {left.length > 0 && (
        <Grupo titulo="Consulta também, sem exigir registro (LEFT JOIN)">
          {left.map((j) => (
            <li key={j.tabela + j.on} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
              <span className="font-mono font-medium">{j.tabela}</span>
              <SqlEmLinha sql={j.on} className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800/80" />
              <Reqs reqs={j.requisitos} />
            </li>
          ))}
        </Grupo>
      )}
      {e.desativadas.length > 0 && (
        <Grupo titulo="Regras desativadas (comentadas no código)">
          {e.desativadas.map((d, k) => (
            <li key={k} className="flex gap-2.5 py-2 opacity-80">
              <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <SqlEmLinha sql={d.sql} className="block truncate rounded bg-zinc-100 px-2 py-0.5 line-through decoration-zinc-400 dark:bg-zinc-800/80" />
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-medium dark:bg-white/10">não vale</span>
                  <Reqs reqs={d.requisitos} />
                  {d.nota && <span>{d.nota}</span>}
                </div>
              </div>
            </li>
          ))}
        </Grupo>
      )}
    </section>
  );
}
