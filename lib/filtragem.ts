import { formatarValor, paraNumero } from "./formatacao";
import { chaveRelacao } from "./perfis";
import type { ResultadoParse, Valor } from "./tipos";

export type FiltroRelacao = { coluna: number; valor: string; rotulo: string };
export type ChaveOrdenacao = { coluna: number; desc: boolean };
export type Ordenacao = ChaveOrdenacao | null;

/** Chave do NULL nos filtros por valor (o valor vazio "" tem chave própria: ""). */
export const CHAVE_NULL = "\u0000NULL";
export const chaveValor = (v: Valor): string => (v === null ? CHAVE_NULL : v);

/** Ordenação como lista (aceita o formato antigo, de uma coluna só). */
export function listaOrdenacao(o: Ordenacao | readonly ChaveOrdenacao[] | undefined): ChaveOrdenacao[] {
  if (!o) return [];
  return Array.isArray(o) ? [...o] : [o as ChaveOrdenacao];
}

/**
 * Clique no cabeçalho: sem Shift, ordena só pela coluna (crescente → decrescente → sem ordem);
 * com Shift, acrescenta a coluna como critério seguinte ou alterna/remove a que já estava.
 */
export function alternarOrdenacao(atual: readonly ChaveOrdenacao[], j: number, acumular: boolean): ChaveOrdenacao[] {
  const k = atual.findIndex((o) => o.coluna === j);
  if (!acumular) {
    if (k < 0 || atual.length > 1) return [{ coluna: j, desc: false }];
    return atual[0].desc ? [] : [{ coluna: j, desc: true }];
  }
  if (k < 0) return [...atual, { coluna: j, desc: false }];
  if (!atual[k].desc) return atual.map((o, x) => (x === k ? { coluna: j, desc: true } : o));
  return atual.filter((_, x) => x !== k);
}
export type Criterios = {
  busca: string;
  /** coluna → texto que precisa estar contido */
  filtros: Record<number, string>;
  relacoes: FiltroRelacao[];
  /** um critério (formato antigo) ou vários, em ordem de prioridade */
  ordenacao: Ordenacao | readonly ChaveOrdenacao[];
  /** coluna → valores aceitos (chaves de `chaveValor`); coluna ausente = sem filtro */
  valores?: Record<number, readonly string[]>;
  /** colunas consideradas pela busca global */
  visiveis: number[];
};

// Índices de busca por coluna, calculados sob demanda e reaproveitados enquanto os dados existirem.
const cacheBusca = new WeakMap<ResultadoParse, (string[] | undefined)[]>();

/** Texto pesquisável de cada célula: o raw e a forma exibida, em minúsculas. NULL pesquisa como "null". */
function indiceBusca(dados: ResultadoParse, j: number): string[] {
  let cols = cacheBusca.get(dados);
  if (!cols) {
    cols = [];
    cacheBusca.set(dados, cols);
  }
  let idx = cols[j];
  if (!idx) {
    const tipo = dados.colunas[j].tipo;
    idx = dados.linhas.map((l) => {
      const v = l[j];
      if (v === null) return "null";
      const exibido = formatarValor(v, tipo);
      return (exibido === v ? v : v + "\u0001" + exibido).toLowerCase();
    });
    cols[j] = idx;
  }
  return idx;
}

const collator = new Intl.Collator("pt-BR", { numeric: false, sensitivity: "base" });

/** Comparador de linhas para a coluna `j` de acordo com o tipo. NULL e vazio vão sempre para o fim. */
export function comparadorColuna(dados: ResultadoParse, j: number, desc: boolean, desempatar = true): (a: number, b: number) => number {
  const { tipo } = dados.colunas[j];
  const linhas = dados.linhas;
  const sinal = desc ? -1 : 1;
  // empate: mantém a ordem original (ou devolve 0 para o próximo critério decidir)
  const empate = (a: number, b: number) => (desempatar ? a - b : 0);
  if (tipo === "inteiro" || tipo === "decimal") {
    const chaves = linhas.map((l) => paraNumero(l[j]));
    return (a, b) => {
      const x = chaves[a];
      const y = chaves[b];
      if (x === null || y === null) return x === y ? empate(a, b) : x === null ? 1 : -1;
      return x === y ? empate(a, b) : (x - y) * sinal;
    };
  }
  // datas, horas e data-hora em ISO ordenam corretamente como string
  const textual = tipo === "texto";
  return (a, b) => {
    const x = linhas[a][j];
    const y = linhas[b][j];
    const xv = x === null || x === "";
    const yv = y === null || y === "";
    if (xv || yv) return xv && yv ? empate(a, b) : xv ? 1 : -1;
    const c = textual ? collator.compare(x, y) : x < y ? -1 : x > y ? 1 : 0;
    return c === 0 ? empate(a, b) : c * sinal;
  };
}

/** Índices (na ordem de exibição) das linhas que passam pelos filtros. */
export function filtrarOrdenar(dados: ResultadoParse, c: Criterios): number[] {
  const n = dados.linhas.length;
  let indices: number[] = Array.from({ length: n }, (_, i) => i);

  for (const r of c.relacoes) {
    indices = indices.filter((i) => chaveRelacao(dados.linhas[i][r.coluna]) === r.valor);
  }

  for (const [jStr, texto] of Object.entries(c.filtros)) {
    const t = texto.trim().toLowerCase();
    if (!t) continue;
    const idx = indiceBusca(dados, Number(jStr));
    indices = indices.filter((i) => idx[i].includes(t));
  }

  for (const [jStr, aceitos] of Object.entries(c.valores ?? {})) {
    const j = Number(jStr);
    const set = new Set(aceitos);
    indices = indices.filter((i) => set.has(chaveValor(dados.linhas[i][j])));
  }

  const busca = c.busca.trim().toLowerCase();
  if (busca) {
    const idxs = c.visiveis.map((j) => indiceBusca(dados, j));
    indices = indices.filter((i) => idxs.some((idx) => idx[i].includes(busca)));
  }

  const criterios = listaOrdenacao(c.ordenacao);
  if (criterios.length === 1) indices.sort(comparadorColuna(dados, criterios[0].coluna, criterios[0].desc));
  else if (criterios.length > 1) {
    const cmps = criterios.map((o) => comparadorColuna(dados, o.coluna, o.desc, false));
    indices.sort((a, b) => {
      for (const cmp of cmps) {
        const r = cmp(a, b);
        if (r !== 0) return r;
      }
      return a - b;
    });
  }
  return indices;
}

export type ValorDistinto = { chave: string; valor: Valor; qtd: number };

/** Valores distintos da coluna nas linhas informadas, do mais frequente ao menos (empate: ordem alfabética). */
export function valoresDistintos(dados: ResultadoParse, j: number, linhas: readonly number[]): ValorDistinto[] {
  const mapa = new Map<string, ValorDistinto>();
  for (const i of linhas) {
    const v = dados.linhas[i][j];
    const k = chaveValor(v);
    const d = mapa.get(k);
    if (d) d.qtd++;
    else mapa.set(k, { chave: k, valor: v, qtd: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.qtd - a.qtd || collator.compare(a.chave, b.chave));
}

/**
 * Colunas cujo nome contém o texto buscado (ex.: "NUMLOT" → FDO_NUMLOT), para
 * levar o usuário até a coluna quando ele procura pelo nome e não pelo valor.
 */
export function colunasPorNome(dados: ResultadoParse, termo: string, limite = 8): number[] {
  const t = termo.trim().toLowerCase();
  if (t.length < 3) return [];
  const res: number[] = [];
  dados.colunas.forEach((c, j) => {
    if (res.length < limite && c.nome.toLowerCase().includes(t)) res.push(j);
  });
  return res;
}
