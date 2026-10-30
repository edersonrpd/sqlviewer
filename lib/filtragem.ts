import { formatarValor, paraNumero } from "./formatacao";
import { chaveRelacao } from "./perfis";
import type { ResultadoParse } from "./tipos";

export type FiltroRelacao = { coluna: number; valor: string; rotulo: string };
export type Ordenacao = { coluna: number; desc: boolean } | null;

export type Criterios = {
  busca: string;
  /** coluna → texto que precisa estar contido */
  filtros: Record<number, string>;
  relacoes: FiltroRelacao[];
  ordenacao: Ordenacao;
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
export function comparadorColuna(dados: ResultadoParse, j: number, desc: boolean): (a: number, b: number) => number {
  const { tipo } = dados.colunas[j];
  const linhas = dados.linhas;
  const sinal = desc ? -1 : 1;
  if (tipo === "inteiro" || tipo === "decimal") {
    const chaves = linhas.map((l) => paraNumero(l[j]));
    return (a, b) => {
      const x = chaves[a];
      const y = chaves[b];
      if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;
      return x === y ? a - b : (x - y) * sinal;
    };
  }
  // datas, horas e data-hora em ISO ordenam corretamente como string
  const textual = tipo === "texto";
  return (a, b) => {
    const x = linhas[a][j];
    const y = linhas[b][j];
    const xv = x === null || x === "";
    const yv = y === null || y === "";
    if (xv || yv) return xv && yv ? a - b : xv ? 1 : -1;
    const c = textual ? collator.compare(x, y) : x < y ? -1 : x > y ? 1 : 0;
    return c === 0 ? a - b : c * sinal;
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

  const busca = c.busca.trim().toLowerCase();
  if (busca) {
    const idxs = c.visiveis.map((j) => indiceBusca(dados, j));
    indices = indices.filter((i) => idxs.some((idx) => idx[i].includes(busca)));
  }

  if (c.ordenacao) indices.sort(comparadorColuna(dados, c.ordenacao.coluna, c.ordenacao.desc));
  return indices;
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
