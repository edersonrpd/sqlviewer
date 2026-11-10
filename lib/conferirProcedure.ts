import type { Aba } from "./estado";
import { buscarPerfil, linhasLigadas } from "./perfis";
import {
  algumRegistroBate,
  apelidosDaEtapa,
  avaliarCondicao,
  type AnaliseProcedure,
  type BuscarRegistros,
  type BuscarValores,
  type Etapa,
  type RegistroLigado,
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
  /** cada registro ligado ao pedido na tabela (ex.: cada item da FATDOR), com os registros ligados a ele (ex.: CADITE) */
  const registros: BuscarRegistros = (tabela) => {
    const l = ligadas.find((x) => nomeTabela(x.aba) === tabela.toUpperCase());
    return l?.linhas.map((i) => registroDaAba(l.aba, i, abas, pedido));
  };
  return { buscar, ligados, registros };
}

/** Valores de um registro de uma aba e dos registros ligados a ele nas outras abas (fora o pedido). */
function registroDaAba(aba: Aba, i: number, abas: Aba[], pedido: Aba): RegistroLigado {
  const ligadas = relacionadosDoRegistro(aba, i, abas)
    .filter((r) => r.abaId !== pedido.id)
    .map((r) => {
      const destino = abas.find((a) => a.id === r.abaId)!;
      return { aba: destino, linhas: r.chave === null ? [] : linhasLigadas(r.chave, destino.dados.linhas, r.colunaDestino, extrasLigacao(r.extras)) };
    });
  const tabela = nomeTabela(aba);
  const proprio = (coluna: string): Valor[] | undefined => {
    const j = aba.dados.colunas.findIndex((c) => c.nome === coluna);
    return j < 0 ? undefined : [aba.dados.linhas[i]?.[j] ?? null];
  };
  // identifica o registro pelo código do item, quando houver (ex.: FDO_CODITE)
  const jItem = aba.dados.colunas.findIndex((c) => /_CODITE$/i.test(c.nome));
  const codItem = jItem >= 0 ? aba.dados.linhas[i]?.[jItem] : null;
  return {
    rotulo: codItem ? `item ${codItem}` : undefined,
    buscar: (t, coluna) => {
      if (!t || t.toUpperCase() === tabela) return proprio(coluna);
      const l = ligadas.find((x) => nomeTabela(x.aba) === t.toUpperCase());
      if (!l) return undefined;
      const j = l.aba.dados.colunas.findIndex((c) => c.nome === coluna);
      return j < 0 ? undefined : l.linhas.map((x) => l.aba.dados.linhas[x][j]);
    },
    ligados: (t) => ligadas.find((x) => nomeTabela(x.aba) === t.toUpperCase())?.linhas.length,
  };
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
  const { buscar, ligados, registros } = buscadorDoPedido(pedido, registro, abas);
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
      condicoes: e.condicoes.map((c) => avaliarCondicao(c.sql, buscar, apelidos, registros)),
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
