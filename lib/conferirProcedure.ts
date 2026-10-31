import type { Aba } from "./estado";
import { buscarPerfil, linhasLigadas } from "./perfis";
import {
  algumRegistroBate,
  apelidosDaEtapa,
  avaliarCondicao,
  type AnaliseProcedure,
  type BuscarValores,
  type Etapa,
  type ResultadoRegra,
} from "./procedure";
import { extrasLigacao, relacionadosDoRegistro } from "./relacionados";
import type { Valor } from "./tipos";

const nomeTabela = (a: Aba) => (buscarPerfil(a.perfilId)?.tabela ?? a.perfilId ?? "").toUpperCase();

/**
 * Valores do pedido conferido e dos registros ligados a ele nas outras abas abertas
 * (ex.: EXTGOR, FATDOR, FATAUT), no formato que a conferência das regras usa.
 */
export function buscadorDoPedido(pedido: Aba, registro: number, abas: Aba[]) {
  const ligadas = relacionadosDoRegistro(pedido, registro, abas).map((r) => {
    const aba = abas.find((a) => a.id === r.abaId)!;
    return { aba, linhas: r.chave === null ? [] : linhasLigadas(r.chave, aba.dados.linhas, r.colunaDestino, extrasLigacao(r.extras)) };
  });
  const tabelaPedido = nomeTabela(pedido);
  const doPedido = (coluna: string): Valor[] | undefined => {
    const j = pedido.dados.colunas.findIndex((c) => c.nome === coluna);
    return j < 0 ? undefined : [pedido.dados.linhas[registro]?.[j] ?? null];
  };
  const dasLigadas = (tabela: string | null, coluna: string): Valor[] | undefined => {
    for (const l of ligadas) {
      if (tabela && nomeTabela(l.aba) !== tabela.toUpperCase()) continue;
      const j = l.aba.dados.colunas.findIndex((c) => c.nome === coluna);
      if (j >= 0) return l.linhas.map((i) => l.aba.dados.linhas[i][j]);
    }
    return undefined;
  };
  const buscar: BuscarValores = (tabela, coluna) => {
    // temporárias da procedure (TMP_…) carregam as colunas do pedido/itens
    const t = tabela && !/^TMP_|^TEMP_/i.test(tabela) ? tabela : null;
    if (!t || t.toUpperCase() === tabelaPedido) return doPedido(coluna) ?? (t ? undefined : dasLigadas(null, coluna));
    return dasLigadas(t, coluna);
  };
  /** registros ligados ao pedido na tabela (undefined = aba não aberta) */
  const ligados = (tabela: string): number | undefined => ligadas.find((l) => nomeTabela(l.aba) === tabela.toUpperCase())?.linhas.length;
  return { buscar, ligados };
}

export type ConferenciaEtapa = {
  juncoes: (ResultadoRegra | null)[];
  condicoes: ResultadoRegra[];
  retiraSe: ResultadoRegra[];
  having: ResultadoRegra | null;
};
export type ConferenciaProcedure = { etapas: ConferenciaEtapa[]; barrou: number; passou: number; semDados: number };

/** Confere cada regra da procedure com o pedido (ok: true = atende, false = barra, null = sem dados nas abas). */
export function conferirProcedure(analise: AnaliseProcedure, pedido: Aba, registro: number, abas: Aba[]): ConferenciaProcedure {
  const { buscar, ligados } = buscadorDoPedido(pedido, registro, abas);
  const etapas = analise.etapas.map((e: Etapa): ConferenciaEtapa => {
    const apelidos = apelidosDaEtapa(e);
    return {
      // INNER JOIN com tabela ligada ao pedido: precisa existir registro
      juncoes: e.juncoes.map((j) => {
        if (j.tipo !== "INNER" || e.tipo === "retira") return null;
        const n = ligados(j.tabela);
        if (n === undefined) return null;
        return { ok: n > 0, motivo: n > 0 ? `${n} registro(s) em ${j.tabela}` : `nenhum registro em ${j.tabela} ligado ao pedido` };
      }),
      condicoes: e.condicoes.map((c) => avaliarCondicao(c.sql, buscar, apelidos)),
      // "retira": a regra barra quando algum registro bate (ex.: item com lote 'A DEFINIR')
      retiraSe: e.retiraSe.map((c) => {
        const r = algumRegistroBate(c.sql, buscar, apelidos);
        return { ok: r.ok === null ? null : !r.ok, motivo: r.motivo };
      }),
      having: e.having ? { ok: null, motivo: "calculado pela procedure ao rodar (ex.: saldo de estoque)" } : null,
    };
  });
  const todos = etapas.flatMap((e) => [...e.juncoes.filter((x): x is ResultadoRegra => x !== null), ...e.condicoes, ...e.retiraSe, ...(e.having ? [e.having] : [])]);
  return {
    etapas,
    barrou: todos.filter((r) => r.ok === false).length,
    passou: todos.filter((r) => r.ok === true).length,
    semDados: todos.filter((r) => r.ok === null).length,
  };
}
