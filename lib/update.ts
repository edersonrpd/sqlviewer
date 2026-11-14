import type { ComparacaoAbas } from "./compararAbas";
import { condicaoSql, numeroLiteral } from "./exportar";
import { identSql, literalSql } from "./sql";
import type { Coluna, ResultadoParse, Valor } from "./tipos";

/**
 * UPDATE de correção: grava os valores de um registro (origem) em outro (destino).
 * Sai da comparação de 2 linhas da mesma aba ou da comparação de duas abas.
 * O SQL é só um rascunho para revisar: quem roda decide.
 */

export type ValorColuna = { nome: string; valor: Valor; coluna: Coluna };

const AVISO = "-- Gerado pelo SQL Viewer a partir de uma comparação. Revise e rode o SELECT antes de executar.";

const valorSql = (v: Valor, c: Coluna) => (v === null ? "NULL" : numeroLiteral(v, c) ? v : literalSql(v));
const nomeDe = (c: Coluna) => (c.original ?? c.nome).trim();

/** `UPDATE T SET … WHERE …;` (null quando não há o que alterar ou como identificar o registro). */
export function gerarUpdate(tabela: string, alterar: ValorColuna[], onde: ValorColuna[]): string | null {
  if (alterar.length === 0 || onde.length === 0) return null;
  const sets = alterar.map((s) => `${identSql(s.nome)} = ${valorSql(s.valor, s.coluna)}`);
  const conds = onde.map((w) => condicaoSql(identSql(w.nome), w.valor, w.coluna));
  return `UPDATE ${identSql(tabela)}\n   SET ${sets.join(",\n       ")}\n WHERE ${conds.join("\n   AND ")};`;
}

export type UpdateGerado = { sql: string; /** como o registro é identificado no WHERE */ por: "chave" | "valores"; colunas: number };

/**
 * UPDATE que deixa o registro `destino` com os valores do registro `origem`, nas `colunas`
 * informadas (índices; as que já são iguais ficam de fora). O destino é identificado pela
 * coluna-chave; sem ela, pelos valores atuais das próprias colunas alteradas e das demais curtas.
 */
export function updateEntreRegistros(
  dados: ResultadoParse,
  origem: number,
  destino: number,
  colunas: number[],
  tabela: string,
  chave?: string,
): UpdateGerado | null {
  const lo = dados.linhas[origem];
  const ld = dados.linhas[destino];
  if (!lo || !ld) return null;
  const jChave = chave ? dados.colunas.findIndex((c) => nomeDe(c).toUpperCase() === chave.toUpperCase()) : -1;
  const temChave = jChave >= 0 && (ld[jChave] ?? "").trim() !== "";
  const vistos = new Set<string>();
  const unicas = (js: number[]) =>
    js.filter((j) => {
      const n = nomeDe(dados.colunas[j]).toUpperCase();
      if (vistos.has(n)) return false;
      vistos.add(n);
      return true;
    });
  const alterar = unicas(colunas.filter((j) => j !== jChave && lo[j] !== ld[j])).map((j) => ({ nome: nomeDe(dados.colunas[j]), valor: lo[j], coluna: dados.colunas[j] }));
  vistos.clear();
  const onde = temChave
    ? [jChave]
    : unicas(dados.colunas.map((_, j) => j).filter((j) => (ld[j] ?? "").length <= 100));
  const sql = gerarUpdate(tabela, alterar, onde.map((j) => ({ nome: nomeDe(dados.colunas[j]), valor: ld[j], coluna: dados.colunas[j] })));
  return sql ? { sql: `${AVISO}\n${sql}`, por: temChave ? "chave" : "valores", colunas: alterar.length } : null;
}

/**
 * Um UPDATE por registro diferente na comparação de abas, levando os valores de um lado
 * para o outro. `para`: a aba que recebe os valores ("b" = B fica igual a A).
 */
export function updatesDaComparacao(c: ComparacaoAbas, a: ResultadoParse, b: ResultadoParse, para: "a" | "b", tabela: string): string | null {
  const [origem, destino] = para === "b" ? [a, b] : [b, a];
  const [jo, jd] = para === "b" ? (["ja", "jb"] as const) : (["jb", "ja"] as const);
  const [io, id] = para === "b" ? (["ia", "ib"] as const) : (["ib", "ia"] as const);
  const sqls = c.diferentes.flatMap((l) => {
    const alterar = l.colunas.map((col) => ({ nome: col.nome, valor: origem.linhas[l[io]][col[jo]], coluna: destino.colunas[col[jd]] }));
    const onde = c.chave.map((k) => ({ nome: k.nome, valor: destino.linhas[l[id]][k[jd]], coluna: destino.colunas[k[jd]] }));
    const sql = gerarUpdate(tabela, alterar, onde);
    return sql ? [sql] : [];
  });
  return sqls.length ? `${AVISO}\n${sqls.join("\n\n")}` : null;
}
