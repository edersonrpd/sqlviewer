"use client";

import { useMemo } from "react";
import type { Aba, Acao } from "@/lib/estado";
import { montarEstruturas, sqlEstrutura, type Aviso, type EstruturaItem, type NoEstrutura } from "@/lib/estrutura";
import { IconeCopiar } from "./Icones";
import { MolduraRegistro, type PropsVisao } from "./VisoesRegistro";
import { copiarTexto } from "./util";

const moeda = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qtd = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
const vezes = (a: number | null, b: number | null) => (a === null || b === null ? null : a * b);

/** Estrutura de produto (KIT): o item (ou cada item do pedido) com seus componentes, custos e saldo. */
export function EstruturaRegistro(props: PropsVisao) {
  const { aba, abas, dispatch } = props;
  return (
    <MolduraRegistro {...props}>
      {(registro, avisar) => <ConteudoEstrutura aba={aba} abas={abas} registro={registro} dispatch={dispatch} avisar={avisar} />}
    </MolduraRegistro>
  );
}

function ConteudoEstrutura({
  aba,
  abas,
  registro,
  dispatch,
  avisar,
}: {
  aba: Aba;
  abas: Aba[];
  registro: number;
  dispatch: (a: Acao) => void;
  avisar: (t: string) => void;
}) {
  const estruturas = useMemo(() => montarEstruturas(aba, registro, abas), [aba, registro, abas]);
  const germatAberta = abas.some((a) => a.perfilId === "GERMAT");
  const itegerAberta = abas.some((a) => a.perfilId === "ITEGER");
  const empresa = estruturas.find((e) => e.raiz.empresa)?.raiz.empresa ?? null;
  const sql = sqlEstrutura(
    estruturas.map((e) => e.raiz.codigo),
    empresa,
  );
  const copiarSql = async () => sql && avisar((await copiarTexto(sql)) ? "Consulta da estrutura copiada" : "Não foi possível copiar");

  const kits = estruturas.filter((e) => e.raiz.kit);
  const semKit = estruturas.filter((e) => !e.raiz.kit);

  if (estruturas.length === 0) {
    return (
      <div className="painel p-8 text-center text-sm text-zinc-500">
        A estrutura (KIT) é mostrada a partir de um item: pedido (FATGOR), item do pedido (FATDOR), cadastro (CADITE), preços (ITEGER) ou a própria estrutura
        (GERMAT/DETMAT).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Estrutura de produto (KIT)</h3>
        <span className="text-xs text-zinc-500">
          {estruturas.length === 1 ? "1 item" : `${estruturas.length} itens`}
          {germatAberta && ` · ${kits.length} KIT(s)`}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          {sql && (
            <button className="btn-destaque" onClick={copiarSql} title="KIT, componentes, cadastro e preços/saldo numa consulta só; ao colar, cada tabela abre na sua aba">
              <IconeCopiar className="h-3.5 w-3.5" /> Copiar consulta da estrutura
            </button>
          )}
          <button className="btn" onClick={() => dispatch({ tipo: "ativar", id: null })}>
            Colar resultado
          </button>
        </span>
      </div>

      {!germatAberta && (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400">
          Estrutura ainda não consultada. Copie a consulta acima, execute no MySQL e cole o resultado: a GERMAT, a DETMAT, a CADITE e a ITEGER abrem cada uma na sua
          aba e a estrutura aparece aqui.
        </p>
      )}

      {kits.map((e) => (
        <CartaoKit key={`${e.raiz.codigo}-${e.raiz.empresa}`} e={e} itegerAberta={itegerAberta} />
      ))}

      {germatAberta && semKit.length > 0 && (
        <section className="painel px-4 py-3 text-sm" aria-label="Itens sem estrutura">
          <span className="font-medium">Sem estrutura (não são KIT):</span>{" "}
          {semKit.map((e, k) => (
            <span key={e.raiz.codigo + k} className="mr-2 inline-flex items-baseline gap-1">
              <span className="font-mono">{e.raiz.codigo}</span>
              {e.raiz.descricao && <span className="text-xs text-zinc-500">{e.raiz.descricao}</span>}
            </span>
          ))}
        </section>
      )}
    </div>
  );
}

const ESTILO_AVISO: Record<Aviso["nivel"], string> = {
  erro: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  atencao: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  info: "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
};

function CartaoKit({ e, itegerAberta }: { e: EstruturaItem; itegerAberta: boolean }) {
  const r = e.raiz;
  const pedido = e.quantidadePedido !== null;
  const base = "px-2.5 py-1.5 font-mono text-[10.5px] font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400";
  const th = `${base} text-right`;
  const thTexto = `${base} text-left`;

  const linhas = (nos: NoEstrutura[], nivel: number): React.ReactNode[] =>
    nos.flatMap((n, k) => [
      <tr key={`${nivel}-${k}-${n.codigo}`} className="border-t border-zinc-100 dark:border-zinc-800">
        <td className="py-1.5 pr-2.5 whitespace-nowrap" style={{ paddingLeft: 12 + nivel * 18 }}>
          <span className="font-mono font-semibold">{n.codigo}</span>
          {n.kit && <span className="ml-1.5 rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">KIT</span>}
          {n.ciclo && <span className="ml-1.5 rounded bg-red-100 px-1 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">ciclo</span>}
        </td>
        <td className="max-w-80 truncate px-2.5" title={n.descricao ?? ""}>
          {n.descricao ?? <span className="text-xs text-zinc-500">{n.temCadastro === false ? "sem cadastro" : "—"}</span>}
        </td>
        <td className="px-2.5 font-mono text-xs whitespace-nowrap">{n.referencia || "—"}</td>
        <td className="px-2.5 font-mono text-xs whitespace-nowrap">{n.codFabrica || "—"}</td>
        <td className="px-2.5 text-right font-mono tabular-nums">{qtd(n.quantidade)}</td>
        {pedido && <td className="px-2.5 text-right font-mono font-semibold tabular-nums">{qtd(n.necessario)}</td>}
        <td className="px-2.5 text-right font-mono tabular-nums">{moeda(n.custoEstrutura)}</td>
        <td className="px-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{moeda(vezes(n.custoEstrutura, n.quantidade))}</td>
        <td
          className={`px-2.5 text-right font-mono tabular-nums ${
            n.custoEstrutura !== null && n.ultimaCompra !== null && Math.round(n.custoEstrutura * 100) !== Math.round(n.ultimaCompra * 100)
              ? "font-semibold text-amber-800 dark:text-amber-300"
              : ""
          }`}
        >
          {moeda(n.ultimaCompra)}
        </td>
        <td className="px-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{moeda(vezes(n.ultimaCompra, n.quantidade))}</td>
        <td className="px-2.5 text-right font-mono tabular-nums">{moeda(n.custo)}</td>
        <td className="px-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{moeda(vezes(n.custo, n.quantidade))}</td>
        <td
          className={`px-2.5 text-right font-mono tabular-nums ${
            n.saldo !== null && n.necessario !== null && n.saldo < n.necessario ? "font-semibold text-red-700 dark:text-red-400" : ""
          }`}
        >
          {qtd(n.saldo)}
        </td>
        <td className="px-2.5 pr-3 text-right font-mono tabular-nums">{n.saldo !== null && n.quantidade ? qtd(n.saldo / n.quantidade) : "—"}</td>
      </tr>,
      ...(n.kit && !n.ciclo ? linhas(n.kit.componentes, nivel + 1) : []),
    ]);

  return (
    <section className="painel overflow-hidden" aria-label={`Estrutura do KIT ${r.codigo}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">KIT</span>
        <span className="font-mono text-[15px] font-semibold">{r.codigo}</span>
        <span className="text-sm font-medium">{r.descricao ?? ""}</span>
        <span className="flex flex-wrap gap-1.5 text-xs">
          {r.empresa && <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-white/10">Empresa {r.empresa}</span>}
          {pedido && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
              Vendido: {qtd(e.quantidadePedido)}
            </span>
          )}
          {r.saldo !== null && <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-white/10">Saldo do KIT: {qtd(r.saldo)}</span>}
          {r.kitsPossiveis !== null && (
            <span
              className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              title="Quantidade de estruturas disponíveis com o saldo atual dos componentes"
            >
              Dá para montar: {qtd(Math.round(r.kitsPossiveis * 100) / 100)}
            </span>
          )}
          {r.precoCompra !== null && <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-white/10">Preço de compra do KIT: {moeda(r.precoCompra)}</span>}
        </span>
      </div>

      {r.kit && r.kit.componentes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={`${thTexto} pl-3`}>Código</th>
                <th className={thTexto}>Descrição</th>
                <th className={thTexto}>Referência</th>
                <th className={thTexto}>Cód. fábrica</th>
                <th className={th} title="DMT_QTDITE">
                  Qtd./KIT
                </th>
                {pedido && <th className={th}>Necessário</th>}
                <th className={th} title="DMT_CUSITE">
                  Custo gravado
                </th>
                <th className={th}>Total</th>
                <th className={th} title="ITE_PREULT">
                  Últ. compra
                </th>
                <th className={th}>Total</th>
                <th className={th} title="ITE_PRECUS">
                  Custo
                </th>
                <th className={th}>Total</th>
                <th className={th} title="ITE_SALDOS">
                  Saldo
                </th>
                <th className={`${th} pr-3`} title="Saldo ÷ quantidade por KIT">
                  KITs
                </th>
              </tr>
            </thead>
            <tbody>{linhas(r.kit.componentes, 0)}</tbody>
            <tfoot className="border-t border-zinc-300 bg-zinc-50 font-semibold dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <td className="py-1.5 pl-3" colSpan={4}>
                  Total do KIT
                </td>
                <td />
                {pedido && <td />}
                <td />
                <td className="px-2.5 text-right font-mono tabular-nums">{moeda(e.totais.custoEstrutura)}</td>
                <td />
                <td className="px-2.5 text-right font-mono tabular-nums">{moeda(e.totais.ultimaCompra)}</td>
                <td />
                <td className="px-2.5 text-right font-mono tabular-nums">{moeda(e.totais.custo)}</td>
                <td />
                <td className="px-2.5 pr-3 text-right font-mono tabular-nums">{r.kitsPossiveis === null ? "—" : qtd(Math.round(r.kitsPossiveis * 100) / 100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          {r.kit?.componentesConsultados ? "KIT sem componentes na DETMAT." : "Componentes ainda não consultados (DETMAT)."}
        </p>
      )}

      {(e.avisos.length > 0 || !itegerAberta) && (
        <ul className="space-y-1.5 border-t border-zinc-100 px-4 py-3 text-[13px] dark:border-zinc-800">
          {e.avisos.map((a, k) => (
            <li key={k} className={`rounded-lg px-3 py-1.5 ${ESTILO_AVISO[a.nivel]}`}>
              {a.texto}
            </li>
          ))}
          {!itegerAberta && (
            <li className="rounded-lg bg-zinc-100 px-3 py-1.5 text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
              Custos e saldo vêm da ITEGER: ela já vem na consulta da estrutura.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
