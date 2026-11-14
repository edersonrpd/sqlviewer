import type { Perfil } from "@/config/perfis";
import { paraNumero } from "./formatacao";
import type { Coluna, ResultadoParse, Valor } from "./tipos";

/**
 * Comparação de duas abas com a mesma tabela (ex.: produção × homologação, ou antes ×
 * depois de uma correção): os registros são casados por uma chave e comparados coluna
 * a coluna, nas colunas que existem nas duas.
 */

export type ColunaComum = { nome: string; ja: number; jb: number };

const nomeDe = (c: Coluna) => (c.original ?? c.nome).trim();

/** Colunas presentes nas duas abas (pelo nome do cabeçalho, sem diferenciar maiúsculas), na ordem da aba A. */
export function colunasComuns(a: ResultadoParse, b: ResultadoParse): { comuns: ColunaComum[]; soA: string[]; soB: string[] } {
  const emB = new Map<string, number>();
  b.colunas.forEach((c, j) => {
    const k = nomeDe(c).toUpperCase();
    if (!emB.has(k)) emB.set(k, j);
  });
  const comuns: ColunaComum[] = [];
  const soA: string[] = [];
  const usadas = new Set<string>();
  a.colunas.forEach((c, j) => {
    const nome = nomeDe(c);
    const k = nome.toUpperCase();
    if (usadas.has(k)) return;
    usadas.add(k);
    const jb = emB.get(k);
    if (jb === undefined) soA.push(nome);
    else comuns.push({ nome, ja: j, jb });
  });
  const soB = [...new Set(b.colunas.map(nomeDe).filter((n) => !usadas.has(n.toUpperCase())))];
  return { comuns, soA, soB };
}

const parteChave = (v: Valor) => (v === null ? "" : v.trim());

function semRepeticao(dados: ResultadoParse, j: number): boolean {
  const vistos = new Set<string>();
  for (const l of dados.linhas) {
    const k = parteChave(l[j]);
    if (k === "" || vistos.has(k)) return false;
    vistos.add(k);
  }
  return true;
}

/**
 * Chave sugerida para casar os registros: a do perfil, se estiver nas duas abas; senão a
 * primeira coluna comum sem valores repetidos nem vazios nas duas; senão a primeira comum.
 */
export function sugerirChave(a: ResultadoParse, b: ResultadoParse, comuns: ColunaComum[], perfil?: Perfil): string | null {
  for (const nome of [perfil?.chave, perfil?.colunaTitulo]) {
    const c = nome ? comuns.find((x) => x.nome.toUpperCase() === nome.toUpperCase()) : undefined;
    if (c) return c.nome;
  }
  return (comuns.find((c) => semRepeticao(a, c.ja) && semRepeticao(b, c.jb)) ?? comuns[0])?.nome ?? null;
}

/** Texto igual (sem contar espaços nas pontas) ou o mesmo número escrito diferente (10.5 × 10.50). NULL só é igual a NULL. */
export function valoresIguais(a: Valor, b: Valor): boolean {
  if (a === null || b === null) return a === b;
  const x = a.trim();
  const y = b.trim();
  if (x === y) return true;
  const re = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;
  return re.test(x) && re.test(y) && paraNumero(x) === paraNumero(y);
}

export type ColunaDiferente = { nome: string; ja: number; jb: number; a: Valor; b: Valor };
export type LinhaDiferente = { chave: string[]; ia: number; ib: number; colunas: ColunaDiferente[] };

export type ComparacaoAbas = {
  chave: ColunaComum[];
  /** colunas comparadas (comuns, fora a chave e as ignoradas) */
  comparadas: ColunaComum[];
  iguais: number;
  diferentes: LinhaDiferente[];
  /** linhas de A cuja chave não existe em B, e vice-versa */
  apenasA: number[];
  apenasB: number[];
  /** linhas com chave repetida (só a primeira de cada chave é comparada) */
  repetidasA: number;
  repetidasB: number;
};

/**
 * Casa os registros pela `chave` (uma ou mais colunas comuns) e compara as demais.
 * `ignorar`: trechos de nome de coluna que ficam fora (ex.: datas de alteração).
 */
export function compararAbas(a: ResultadoParse, b: ResultadoParse, chave: string[], ignorar: string[] = []): ComparacaoAbas {
  const { comuns } = colunasComuns(a, b);
  const colsChave = chave
    .map((n) => comuns.find((c) => c.nome.toUpperCase() === n.toUpperCase()))
    .filter((c): c is ColunaComum => c !== undefined);
  const fora = ignorar.map((t) => t.trim().toUpperCase()).filter(Boolean);
  const comparadas = comuns.filter((c) => !colsChave.includes(c) && !fora.some((t) => c.nome.toUpperCase().includes(t)));
  const vazio: ComparacaoAbas = { chave: colsChave, comparadas, iguais: 0, diferentes: [], apenasA: [], apenasB: [], repetidasA: 0, repetidasB: 0 };
  if (colsChave.length === 0) return vazio;

  const chaveDe = (l: Valor[], lado: "ja" | "jb") => colsChave.map((c) => parteChave(l[c[lado]]));
  const indiceB = new Map<string, number>();
  let repetidasB = 0;
  b.linhas.forEach((l, i) => {
    const k = chaveDe(l, "jb").join("\u0000");
    if (indiceB.has(k)) repetidasB++;
    else indiceB.set(k, i);
  });

  const res: ComparacaoAbas = { ...vazio, repetidasB };
  const vistasA = new Set<string>();
  a.linhas.forEach((la, ia) => {
    const partes = chaveDe(la, "ja");
    const k = partes.join("\u0000");
    if (vistasA.has(k)) {
      res.repetidasA++;
      return;
    }
    vistasA.add(k);
    const ib = indiceB.get(k);
    if (ib === undefined) {
      res.apenasA.push(ia);
      return;
    }
    const lb = b.linhas[ib];
    const colunas = comparadas
      .filter((c) => !valoresIguais(la[c.ja], lb[c.jb]))
      .map((c) => ({ nome: c.nome, ja: c.ja, jb: c.jb, a: la[c.ja], b: lb[c.jb] }));
    if (colunas.length === 0) res.iguais++;
    else res.diferentes.push({ chave: partes, ia, ib, colunas });
  });
  for (const [k, ib] of indiceB) if (!vistasA.has(k)) res.apenasB.push(ib);
  res.apenasB.sort((x, y) => x - y);
  return res;
}

/** Quantas linhas diferem em cada coluna, da mais frequente para a menos. */
export function colunasMaisDiferentes(c: ComparacaoAbas): { nome: string; qtd: number }[] {
  const m = new Map<string, number>();
  for (const l of c.diferentes) for (const col of l.colunas) m.set(col.nome, (m.get(col.nome) ?? 0) + 1);
  return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((x, y) => y.qtd - x.qtd || x.nome.localeCompare(y.nome));
}
