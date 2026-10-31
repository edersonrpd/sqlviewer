import { formatarNumero, paraNumero } from "./formatacao";
import { chaveValor } from "./filtragem";
import type { ResultadoParse } from "./tipos";

/**
 * Seleção de células da tabela, como numa planilha. `r` é a posição da linha na
 * ordem exibida (índice em `indices`) e `c` a posição da coluna entre as exibidas.
 */
export type Celula = { r: number; c: number };
export type Selecao = { ancora: Celula; foco: Celula };
export type Retangulo = { r0: number; r1: number; c0: number; c1: number };

export function retangulo(s: Selecao): Retangulo {
  return {
    r0: Math.min(s.ancora.r, s.foco.r),
    r1: Math.max(s.ancora.r, s.foco.r),
    c0: Math.min(s.ancora.c, s.foco.c),
    c1: Math.max(s.ancora.c, s.foco.c),
  };
}

/** Mantém a seleção dentro da grade (as linhas/colunas exibidas podem ter mudado). */
export function limitarSelecao(s: Selecao | null, linhas: number, colunas: number): Selecao | null {
  if (!s || linhas === 0 || colunas === 0) return null;
  const lim = (x: Celula): Celula => ({ r: Math.min(Math.max(0, x.r), linhas - 1), c: Math.min(Math.max(0, x.c), colunas - 1) });
  return { ancora: lim(s.ancora), foco: lim(s.foco) };
}

export type Agregados = {
  celulas: number;
  linhas: number;
  colunas: number;
  /** células com valor (nem NULL nem vazio) */
  preenchidas: number;
  nulos: number;
  distintos: number;
  /** só quando há valores numéricos na seleção */
  numeros: number;
  soma: number | null;
  media: number | null;
  min: number | null;
  max: number | null;
  /** casas decimais para exibir soma/média (as da coluna decimal mais precisa) */
  casas: number;
};

/** Contagem, soma, média, mínimo, máximo e distintos das células selecionadas. */
export function agregarSelecao(dados: ResultadoParse, indices: readonly number[], colunas: readonly number[], ret: Retangulo): Agregados {
  let preenchidas = 0;
  let nulos = 0;
  let numeros = 0;
  let soma = 0;
  let min = Infinity;
  let max = -Infinity;
  let casas = 0;
  const distintos = new Set<string>();
  const cols = colunas.slice(ret.c0, ret.c1 + 1);
  const numericas = cols.map((j) => dados.colunas[j].tipo === "inteiro" || dados.colunas[j].tipo === "decimal");
  for (const j of cols) if (dados.colunas[j].tipo === "decimal") casas = Math.max(casas, dados.colunas[j].casas);
  for (let r = ret.r0; r <= ret.r1; r++) {
    const linha = dados.linhas[indices[r]];
    if (!linha) continue;
    cols.forEach((j, k) => {
      const v = linha[j];
      distintos.add(chaveValor(v));
      if (v === null) nulos++;
      else if (v !== "") preenchidas++;
      if (!numericas[k]) return;
      const n = paraNumero(v);
      if (n === null) return;
      numeros++;
      soma += n;
      if (n < min) min = n;
      if (n > max) max = n;
    });
  }
  const linhas = Math.max(0, Math.min(ret.r1, indices.length - 1) - ret.r0 + 1);
  return {
    celulas: linhas * cols.length,
    linhas,
    colunas: cols.length,
    preenchidas,
    nulos,
    distintos: distintos.size,
    numeros,
    soma: numeros ? soma : null,
    media: numeros ? soma / numeros : null,
    min: numeros ? min : null,
    max: numeros ? max : null,
    casas,
  };
}

/** Número em pt-BR com as casas informadas (até 6), sem notação científica. */
export function numeroAgregado(n: number, casas: number): string {
  return formatarNumero(n, Math.min(6, casas));
}
