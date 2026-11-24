"use client";

import { useMemo, useState } from "react";
import type { Aba, Acao } from "@/lib/estado";
import { formatarNumero, formatarValor } from "@/lib/formatacao";
import { buscarNoJson, correspondencias, fontesJson, indiceDeValores, juntarCaminho, lerJson, type Correspondencia } from "@/lib/jsonVisao";
import { montarConciliacoes, valoresRepetidos, type ConciliacaoMontada, type LadoConciliacao } from "@/lib/valores";
import { IconeCopiar, IconeSeta } from "./Icones";
import { MolduraRegistro, type PropsVisao } from "./VisoesRegistro";
import { copiarTexto } from "./util";

const moeda = (n: number) => formatarNumero(n, 2);

/* ---------------------------------------------------------------- Valores */

export function ValoresRegistro(props: PropsVisao) {
  const { aba, abas, dispatch } = props;
  return (
    <MolduraRegistro {...props}>
      {(registro, avisar) => <ConteudoValores aba={aba} abas={abas} registro={registro} dispatch={dispatch} avisar={avisar} />}
    </MolduraRegistro>
  );
}

function ConteudoValores({ aba, abas, registro, avisar }: { aba: Aba; abas: Aba[]; registro: number; dispatch: (a: Acao) => void; avisar: (t: string) => void }) {
  const conciliacoes = useMemo(() => montarConciliacoes(aba, registro, abas), [aba, registro, abas]);
  const repetidos = useMemo(() => valoresRepetidos(aba, registro, abas), [aba, registro, abas]);
  const [verAvulsos, setVerAvulsos] = useState(false);

  const bate = conciliacoes.filter((c) => c.estado === "bate").length;
  const diferentes = conciliacoes.filter((c) => c.estado === "diferente").length;
  const incompletas = conciliacoes.filter((c) => c.estado === "incompleta").length;

  const copiarConciliacao = async () => {
    const linhas = conciliacoes.flatMap((c) => [
      `${c.rotulo}: ${c.estado === "bate" ? "bate" : c.estado === "diferente" ? (c.modo === "cada" ? "diverge" : `diferença ${moeda(c.diferenca!)}`) : "incompleta"}`,
      ...[...c.esperado.termos, ...c.comparado.termos].map(
        (t) =>
          `  ${t.sinal < 0 ? "− " : ""}${t.rotulo} (${t.origem}): ${t.valor === null ? t.falta : moeda(t.valor)}${t.bate === undefined ? "" : t.bate ? " ✓" : " ≠"}`,
      ),
    ]);
    avisar((await copiarTexto(linhas.join("\n"))) ? "Conciliação copiada" : "Não foi possível copiar");
  };

  const painelRepetidos = (
    <section className="painel p-4" aria-label="Mesmo valor em várias tabelas">
      <h3 className="text-sm font-semibold">Mesmo valor em várias tabelas</h3>
      <p className="mt-0.5 text-xs text-zinc-500">Valores em dinheiro do registro e das abas ligadas que se repetem.</p>
      {repetidos.grupos.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Nenhum valor se repete entre as tabelas abertas.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {repetidos.grupos.map((g) => (
            <li key={g.valor} className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-800 dark:bg-white/[0.03]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[15px] font-semibold tabular-nums">{moeda(g.valor)}</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400">{g.origens.length} lugares</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.origens.map((o) => (
                  <span key={o} className="rounded bg-zinc-100 px-1.5 py-px font-mono text-[10.5px] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                    {o}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {repetidos.avulsos.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <button className="flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200" onClick={() => setVerAvulsos(!verAvulsos)} aria-expanded={verAvulsos}>
            <IconeSeta className={`h-3.5 w-3.5 transition ${verAvulsos ? "" : "-rotate-90"}`} /> Valores que aparecem uma vez ({repetidos.avulsos.length})
          </button>
          {verAvulsos && (
            <ul className="mt-2 space-y-1 text-xs">
              {repetidos.avulsos.map((g) => (
                <li key={g.valor} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-zinc-600 dark:text-zinc-400">{g.origens[0]}</span>
                  <span className="font-mono tabular-nums">{moeda(g.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );

  if (conciliacoes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Este perfil não tem contas de conciliação configuradas; abaixo, os valores que se repetem entre as tabelas abertas.</p>
        {painelRepetidos}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Conciliação</h3>
          {bate > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{bate} batem</span>}
          {diferentes > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">{diferentes} com diferença</span>}
          {incompletas > 0 && <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-300">{incompletas} incompleta(s)</span>}
          <button className="btn ml-auto" onClick={copiarConciliacao}>
            <IconeCopiar className="h-3.5 w-3.5" /> Copiar conciliação
          </button>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {conciliacoes.map((c) => (
            <CartaoConciliacao key={c.rotulo} c={c} />
          ))}
        </div>
      </div>
      <aside className="lg:sticky lg:top-5">{painelRepetidos}</aside>
    </div>
  );
}

const ESTILO_CONC = {
  bate: { borda: "border-emerald-300 dark:border-emerald-900", selo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  diferente: { borda: "border-amber-300 dark:border-amber-800", selo: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  incompleta: { borda: "border-dashed border-zinc-300 dark:border-zinc-700", selo: "bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:text-zinc-300" },
} as const;

function CartaoConciliacao({ c }: { c: ConciliacaoMontada }) {
  const estilo = ESTILO_CONC[c.estado];
  const maior = Math.max(Math.abs(c.esperado.total ?? 0), Math.abs(c.comparado.total ?? 0), 0.01);
  const pct = (n: number | null) => `${Math.max(0, Math.min(100, ((n ?? 0) / maior) * 100))}%`;
  const lado = (titulo: string, l: LadoConciliacao, simbolo: string) => (
    <>
      {l.termos.map((t, k) => (
        <tr key={titulo + k} className="border-t border-zinc-100 dark:border-zinc-800">
          <td className="w-5 py-1.5 pr-1 text-center font-mono text-zinc-500">{t.sinal < 0 ? "−" : k > 0 ? "+" : ""}</td>
          <td className="py-1.5 pr-2">
            <span className="block">{t.rotulo}</span>
            <span className="block font-mono text-[10.5px] text-zinc-500">{t.origem}</span>
          </td>
          <td className={`py-1.5 text-right font-mono tabular-nums ${t.sinal < 0 && t.valor ? "text-red-700 dark:text-red-400" : ""}`}>
            {t.valor === null ? <span className="font-sans text-xs text-amber-800 dark:text-amber-300">{t.falta}</span> : `${t.sinal < 0 ? "−" : ""}${moeda(t.valor)}`}
            {t.bate !== undefined && (
              <span
                className={`ml-2 rounded-full px-1.5 font-sans text-[11px] font-semibold ${t.bate ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"}`}
              >
                {t.bate ? "✓" : "≠"}
              </span>
            )}
          </td>
        </tr>
      ))}
      {(c.modo === "soma" || titulo === "Esperado") && (
        <tr className="border-t border-zinc-300 font-semibold dark:border-zinc-700">
          <td className="py-1.5 text-center font-mono text-zinc-500">{simbolo}</td>
          <td className="py-1.5">{titulo}</td>
          <td className="py-1.5 text-right font-mono tabular-nums">{l.total === null ? "—" : moeda(l.total)}</td>
        </tr>
      )}
    </>
  );
  const divergentes = c.comparado.termos.filter((t) => t.bate === false).length;

  return (
    <section className={`painel border ${estilo.borda} p-4`}>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{c.rotulo}</h4>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${estilo.selo}`}>
          {c.estado === "bate"
            ? "✓ bate"
            : c.estado === "diferente"
              ? c.modo === "cada"
                ? `${divergentes} tabela(s) diverge(m)`
                : `diferença ${c.diferenca! > 0 ? "+" : ""}${moeda(c.diferenca!)}`
              : "incompleta"}
        </span>
      </div>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {lado("Esperado", c.esperado, "=")}
          {c.modo === "cada" && (
            <tr>
              <td colSpan={3} className="pt-3 pb-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Cada tabela deve ter o mesmo valor
              </td>
            </tr>
          )}
          {lado("Encontrado", c.comparado, "=")}
        </tbody>
      </table>
      {c.modo === "soma" && c.esperado.total !== null && c.comparado.total !== null && (
        <div className="mt-3 space-y-1.5" aria-hidden>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-zinc-500">Esperado</span>
            <div className="h-3 flex-1 rounded bg-zinc-100 dark:bg-white/5">
              <div className="h-full rounded bg-indigo-400" style={{ width: pct(c.esperado.total) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-zinc-500">Encontrado</span>
            <div className="h-3 flex-1 rounded bg-zinc-100 dark:bg-white/5">
              <div className={`h-full rounded ${c.estado === "bate" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: pct(c.comparado.total) }} />
            </div>
          </div>
        </div>
      )}
      {c.estado === "diferente" && c.dica && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{c.dica}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------- JSON */

export function JsonRegistro(props: PropsVisao) {
  const { aba, abas } = props;
  return (
    <MolduraRegistro {...props}>
      {(registro, avisar) => <ConteudoJson aba={aba} abas={abas} registro={registro} avisar={avisar} />}
    </MolduraRegistro>
  );
}

/** Caminhos de todos os objetos/listas (para "Expandir tudo"). */
function caminhosInternos(dado: unknown, caminho = "$", res: string[] = []): string[] {
  if (dado === null || typeof dado !== "object") return res;
  res.push(caminho);
  const filhos: [string | number, unknown][] = Array.isArray(dado) ? dado.map((x, k) => [k, x]) : Object.entries(dado as object);
  for (const [k, x] of filhos) caminhosInternos(x, juntarCaminho(caminho, k), res);
  return res;
}

/** Abertos de início: até o 2º nível, menos listas grandes. */
function abertosIniciais(dado: unknown): Set<string> {
  const res = new Set<string>();
  const visitar = (v: unknown, caminho: string, nivel: number) => {
    if (v === null || typeof v !== "object" || nivel > 2) return;
    if (Array.isArray(v) && v.length > 20) return;
    res.add(caminho);
    const filhos: [string | number, unknown][] = Array.isArray(v) ? v.map((x, k) => [k, x]) : Object.entries(v as object);
    for (const [k, x] of filhos) visitar(x, juntarCaminho(caminho, k), nivel + 1);
  };
  visitar(dado, "$", 0);
  return res;
}

function valorNoCaminho(dado: unknown, caminho: string): unknown {
  let atual: unknown = dado;
  const partes = caminho.slice(1).match(/\.[A-Za-z_$][\w$]*|\[\d+\]|\["(?:[^"\\]|\\.)*"\]/g) ?? [];
  for (const p of partes) {
    if (atual === null || typeof atual !== "object") return undefined;
    const chave = p.startsWith(".") ? p.slice(1) : p.startsWith('["') ? JSON.parse(p.slice(1, -1)) : Number(p.slice(1, -1));
    atual = (atual as Record<string | number, unknown>)[chave];
  }
  return atual;
}

function ConteudoJson({ aba, abas, registro, avisar }: { aba: Aba; abas: Aba[]; registro: number; avisar: (t: string) => void }) {
  const fontes = useMemo(() => fontesJson(aba, registro, abas), [aba, registro, abas]);
  const indice = useMemo(() => indiceDeValores(aba, registro, abas), [aba, registro, abas]);
  const [fonteId, setFonteId] = useState<string | null>(null);
  const fonte = fontes.find((f) => f.id === fonteId) ?? fontes[0];
  const [abertosPor, setAbertosPor] = useState<Record<string, Set<string>>>({});
  const abertos = fonte ? (abertosPor[fonte.id] ?? abertosIniciais(fonte.dado)) : new Set<string>();
  const setAbertos = (s: Set<string>) => fonte && setAbertosPor((m) => ({ ...m, [fonte.id]: s }));
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const resultado = useMemo(() => (fonte ? buscarNoJson(fonte.dado, busca) : { achados: new Set<string>(), abrir: new Set<string>() }), [fonte, busca]);

  const copiar = async (t: string, msg: string) => avisar((await copiarTexto(t)) ? msg : "Não foi possível copiar");

  if (!fonte) {
    return (
      <div className="painel p-8 text-center text-sm text-zinc-500">
        Nenhuma coluna com JSON neste registro nem nas abas ligadas a ele.
        <span className="mt-1 block text-xs">No pedido (FATGOR), o JSON vem do log do HUB: cole a consulta da HUBCIT_LOGPED para ver aqui.</span>
      </div>
    );
  }

  const valorSel = selecionado ? valorNoCaminho(fonte.dado, selecionado) : undefined;
  const corrSel = selecionado ? correspondencias(indice, valorSel) : [];
  const colunasSel = new Set(corrSel.map((c) => c.coluna));
  const linha = aba.dados.linhas[registro];
  const colunasRegistro = aba.dados.colunas
    .map((c, j) => ({ c, v: linha[j] }))
    .filter(({ v }) => v !== null && v.trim() !== "" && lerJson(v) === undefined);
  const abertosEfetivos = busca.trim() ? new Set([...abertos, ...resultado.abrir]) : abertos;

  return (
    <div className="space-y-3">
      {fontes.length > 1 && (
        <div role="tablist" aria-label="JSON" className="flex flex-wrap gap-1.5">
          {fontes.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={f.id === fonte.id}
              onClick={() => {
                setFonteId(f.id);
                setSelecionado(null);
              }}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${f.id === fonte.id ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-white/5"}`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="painel p-3.5 lg:sticky lg:top-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" aria-label="Colunas do registro">
          <h3 className="text-[13px] font-semibold">Colunas · {aba.nome}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Clique num valor do JSON: as colunas com o mesmo valor ficam marcadas.</p>
          <dl className="m-0 mt-2.5 divide-y divide-zinc-100 dark:divide-zinc-800">
            {colunasRegistro.map(({ c, v }) => {
              const marcada = colunasSel.has(c.nome);
              return (
                <div key={c.nome} className={`flex items-baseline justify-between gap-3 py-1.5 ${marcada ? "-mx-2 rounded-md bg-indigo-100 px-2 dark:bg-indigo-950/60" : ""}`}>
                  <dt className={`shrink-0 font-mono text-[10.5px] ${marcada ? "font-semibold text-indigo-800 dark:text-indigo-200" : "text-zinc-500"}`}>{c.nome}</dt>
                  <dd className="m-0 truncate text-right font-mono text-xs" title={v ?? ""}>
                    {formatarValor(v!, c.tipo)}
                  </dd>
                </div>
              );
            })}
          </dl>
          {[...colunasSel].some((n) => n.includes(".")) && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Também em: {[...colunasSel].filter((n) => n.includes(".")).join(", ")}
            </p>
          )}
        </section>

        <section className="painel overflow-hidden" aria-label="Árvore do JSON">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
            <label className="flex h-8 w-64 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 dark:border-zinc-700 dark:bg-zinc-950">
              <span className="sr-only">Buscar chave ou valor</span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar chave ou valor" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            </label>
            {busca.trim() && <span className="text-xs text-zinc-500">{resultado.achados.size} achado(s)</span>}
            <span className="ml-auto flex flex-wrap gap-1.5">
              <button className="btn" onClick={() => setAbertos(new Set(caminhosInternos(fonte.dado)))}>
                Expandir tudo
              </button>
              <button className="btn" onClick={() => setAbertos(new Set(["$"]))}>
                Recolher
              </button>
              <button className="btn" onClick={() => copiar(JSON.stringify(fonte.dado, null, 2), "JSON copiado")}>
                <IconeCopiar className="h-3.5 w-3.5" /> Copiar JSON
              </button>
            </span>
          </div>
          {selecionado && (
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-3.5 py-2 text-xs dark:border-zinc-800 dark:bg-white/[0.02]">
              <span className="font-mono font-semibold break-all">{selecionado}</span>
              <button className="font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => copiar(selecionado, "Caminho copiado")}>
                Copiar caminho
              </button>
              <button
                className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                onClick={() => copiar(typeof valorSel === "string" ? valorSel : JSON.stringify(valorSel, null, 2), "Valor copiado")}
              >
                Copiar valor
              </button>
            </div>
          )}
          <div className="max-h-[calc(100vh-14rem)] overflow-auto px-2 py-2 font-mono text-[13px] leading-7">
            <NoJson
              nome={null}
              valor={fonte.dado}
              caminho="$"
              nivel={0}
              abertos={abertosEfetivos}
              alternar={(c) => {
                const s = new Set(abertos);
                if (s.has(c)) s.delete(c);
                else s.add(c);
                setAbertos(s);
              }}
              achados={resultado.achados}
              selecionado={selecionado}
              selecionar={setSelecionado}
              indice={indice}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function NoJson({
  nome,
  valor,
  caminho,
  nivel,
  abertos,
  alternar,
  achados,
  selecionado,
  selecionar,
  indice,
}: {
  nome: string | number | null;
  valor: unknown;
  caminho: string;
  nivel: number;
  abertos: Set<string>;
  alternar: (c: string) => void;
  achados: Set<string>;
  selecionado: string | null;
  selecionar: (c: string) => void;
  indice: Map<string, Correspondencia[]>;
}) {
  const recuo = { paddingLeft: nivel * 18 + 6 };
  const achado = achados.has(caminho);
  const sel = selecionado === caminho;
  const fundo = sel ? "bg-indigo-100 dark:bg-indigo-950/60" : achado ? "bg-amber-100 dark:bg-amber-900/40" : "hover:bg-zinc-100 dark:hover:bg-white/5";
  const rotulo =
    nome === null ? null : typeof nome === "number" ? <span className="text-zinc-500">{nome}:</span> : <span className="text-violet-700 dark:text-violet-300">&quot;{nome}&quot;:</span>;

  if (valor !== null && typeof valor === "object") {
    const lista = Array.isArray(valor);
    const filhos: [string | number, unknown][] = lista ? (valor as unknown[]).map((x, k) => [k, x]) : Object.entries(valor as object);
    const aberto = abertos.has(caminho);
    return (
      <div>
        <button type="button" onClick={() => alternar(caminho)} aria-expanded={aberto} style={recuo} className={`flex w-full items-center gap-1.5 rounded text-left ${fundo}`}>
          <IconeSeta className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition ${aberto ? "" : "-rotate-90"}`} />
          {rotulo}
          <span className="text-zinc-500">
            {lista ? `[${filhos.length}]` : `{${filhos.length}}`}
            {!aberto && (lista ? " …" : ` ${filhos.slice(0, 3).map(([k]) => k).join(", ")}${filhos.length > 3 ? ", …" : ""}`)}
          </span>
        </button>
        {aberto &&
          filhos.map(([k, x]) => (
            <NoJson
              key={String(k)}
              nome={k}
              valor={x}
              caminho={juntarCaminho(caminho, k)}
              nivel={nivel + 1}
              abertos={abertos}
              alternar={alternar}
              achados={achados}
              selecionado={selecionado}
              selecionar={selecionar}
              indice={indice}
            />
          ))}
      </div>
    );
  }

  const corr = correspondencias(indice, valor);
  const cor =
    valor === null
      ? "text-red-700 dark:text-red-400"
      : typeof valor === "string"
        ? "text-emerald-700 dark:text-emerald-400"
        : typeof valor === "number"
          ? "text-amber-700 dark:text-amber-300"
          : "text-sky-700 dark:text-sky-300";
  return (
    <button type="button" onClick={() => selecionar(caminho)} style={recuo} className={`flex w-full flex-wrap items-center gap-x-1.5 rounded text-left ${fundo}`}>
      <span className="w-3.5 shrink-0" />
      {rotulo}
      <span className={`break-all ${cor}`}>{valor === null ? "null" : typeof valor === "string" ? `"${valor}"` : String(valor)}</span>
      {corr.slice(0, 2).map((c) => (
        <span
          key={c.coluna}
          title={`${c.coluna} = ${c.valor}`}
          className={`rounded-full px-1.5 font-sans text-[10.5px] leading-[18px] font-semibold ${c.aproximado ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}
        >
          {c.aproximado ? "≈" : "="} {c.coluna}
        </span>
      ))}
      {corr.length > 2 && <span className="font-sans text-[10.5px] text-zinc-500">+{corr.length - 2}</span>}
    </button>
  );
}
