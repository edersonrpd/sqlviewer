import { formatarValor } from "./formatacao";
import type { Coluna, ResultadoParse, Valor } from "./tipos";

/**
 * Saídas da aba atual. Sempre recebem os índices das linhas (já filtradas e
 * ordenadas) e das colunas visíveis. Valores saem como o raw original; NULL sai como "NULL".
 */

const texto = (v: Valor) => (v === null ? "NULL" : v);

function campoCSV(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV com separador ";" e BOM UTF-8, para o Excel pt-BR abrir corretamente. */
export function gerarCSV(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  const out: string[] = [colunas.map((j) => campoCSV(dados.colunas[j].nome)).join(";")];
  for (const i of linhas) {
    const l = dados.linhas[i];
    out.push(colunas.map((j) => campoCSV(texto(l[j]))).join(";"));
  }
  return "﻿" + out.join("\r\n") + "\r\n";
}

/** "COLUNA: valor", um campo por linha, registros separados por linha em branco. */
export function gerarLista(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  return linhas
    .map((i) => colunas.map((j) => `${dados.colunas[j].nome}: ${texto(dados.linhas[i][j])}`).join("\n"))
    .join("\n\n");
}

function campoTabulado(v: string): string {
  return /[\t"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Cabeçalho + linhas separadas por TAB, para colar no Excel. Sem cabeçalho: só as células (Ctrl+C na tabela). */
export function gerarTabulado(dados: ResultadoParse, linhas: number[], colunas: number[], cabecalho = true): string {
  const out = cabecalho ? [colunas.map((j) => campoTabulado(dados.colunas[j].nome)).join("\t")] : [];
  for (const i of linhas) out.push(colunas.map((j) => campoTabulado(texto(dados.linhas[i][j]))).join("\t"));
  return out.join("\n");
}

export type CelulaPlanilha = { t: "s"; v: string } | { t: "n"; v: number; z?: string };

/**
 * Células para o .xlsx: inteiros e decimais como número; todo o resto (códigos
 * com zero à esquerda, chaves longas, datas, NULL) como texto, sem conversão.
 */
export function celulasPlanilha(dados: ResultadoParse, linhas: number[], colunas: number[]): CelulaPlanilha[][] {
  const cab: CelulaPlanilha[] = colunas.map((j) => ({ t: "s", v: dados.colunas[j].nome }));
  const corpo = linhas.map((i) =>
    colunas.map((j): CelulaPlanilha => {
      const v = dados.linhas[i][j];
      const c = dados.colunas[j];
      if (v !== null && v !== "" && (c.tipo === "inteiro" || c.tipo === "decimal")) {
        const n = Number(v);
        if (Number.isFinite(n)) {
          return c.tipo === "decimal" ? { t: "n", v: n, z: c.casas > 0 ? "#,##0." + "0".repeat(c.casas) : "0" } : { t: "n", v: n };
        }
      }
      return { t: "s", v: texto(v) };
    }),
  );
  return [cab, ...corpo];
}

export function nomeArquivo(base: string, extensao: string): string {
  const limpo = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "consulta";
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${limpo}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${extensao}`;
}

/** Valor numérico que pode sair sem aspas (JSON/INSERT): só números "limpos", sem zero à esquerda. */
function numeroLiteral(v: string, c: Coluna): boolean {
  return (c.tipo === "inteiro" || c.tipo === "decimal") && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && v.length < 16;
}

/** Lista de objetos { COLUNA: valor }; números limpos como número, NULL como null, o resto como texto. */
export function gerarJSON(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  const objs = linhas.map((i) => {
    const o: Record<string, string | number | null> = {};
    for (const j of colunas) {
      const v = dados.linhas[i][j];
      const c = dados.colunas[j];
      o[c.nome] = v === null ? null : numeroLiteral(v, c) ? Number(v) : v;
    }
    return o;
  });
  return JSON.stringify(objs, null, 2);
}

const celulaMd = (v: string) => v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

/** Tabela Markdown (cola formatada em chamados, wikis e no GitHub). Valores exibidos como na tela. */
export function gerarMarkdown(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  const cols = colunas.map((j) => dados.colunas[j]);
  const alinh = cols.map((c) => (c.tipo === "inteiro" || c.tipo === "decimal" ? "---:" : "---"));
  const out = [`| ${cols.map((c) => celulaMd(c.nome)).join(" | ")} |`, `| ${alinh.join(" | ")} |`];
  for (const i of linhas) {
    out.push(`| ${colunas.map((j) => { const v = dados.linhas[i][j]; return v === null ? "NULL" : celulaMd(formatarValor(v, dados.colunas[j].tipo)); }).join(" | ")} |`);
  }
  return out.join("\n");
}

const literalSql = (v: string) => `'${v.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

/** Um INSERT por linha, com os valores originais (para reproduzir o registro em outra base). */
export function gerarInsert(dados: ResultadoParse, linhas: number[], colunas: number[], tabela: string): string {
  const nomes = colunas.map((j) => dados.colunas[j].nome).join(", ");
  return linhas
    .map((i) => {
      const vals = colunas.map((j) => {
        const v = dados.linhas[i][j];
        return v === null ? "NULL" : numeroLiteral(v, dados.colunas[j]) ? v : literalSql(v);
      });
      return `INSERT INTO ${tabela} (${nomes}) VALUES (${vals.join(", ")});`;
    })
    .join("\n");
}

/** Tabela em texto com colunas alinhadas (como o resultado do cliente mysql no terminal). */
export function gerarTextoTabela(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  const cols = colunas.map((j) => dados.colunas[j]);
  const corpo = linhas.map((i) =>
    colunas.map((j) => {
      const v = dados.linhas[i][j];
      return v === null ? "NULL" : formatarValor(v, dados.colunas[j].tipo).replace(/\r?\n/g, " ");
    }),
  );
  const larg = cols.map((c, k) => Math.max(c.nome.length, ...corpo.map((l) => l[k].length)));
  const direita = cols.map((c) => c.tipo === "inteiro" || c.tipo === "decimal");
  const borda = "+" + larg.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const linha = (vals: string[], cab: boolean) =>
    "| " + vals.map((v, k) => (direita[k] && !cab ? v.padStart(larg[k]) : v.padEnd(larg[k]))).join(" | ") + " |";
  return [borda, linha(cols.map((c) => c.nome), true), borda, ...corpo.map((l) => linha(l, false)), borda].join("\n");
}

export type FormatoCopia = "tabulado" | "csv" | "json" | "markdown" | "insert" | "texto" | "lista";

export const FORMATOS_COPIA: { id: FormatoCopia; rotulo: string; descricao: string }[] = [
  { id: "tabulado", rotulo: "Tabulado (Excel)", descricao: "Cabeçalho + linhas separadas por TAB" },
  { id: "csv", rotulo: "CSV", descricao: "Separado por ;" },
  { id: "json", rotulo: "JSON", descricao: "Lista de objetos { COLUNA: valor }" },
  { id: "markdown", rotulo: "Markdown", descricao: "Tabela para chamados, wikis e GitHub" },
  { id: "insert", rotulo: "SQL INSERT", descricao: "Um INSERT por linha, valores originais" },
  { id: "texto", rotulo: "Texto alinhado", descricao: "Como o cliente mysql no terminal" },
  { id: "lista", rotulo: "Lista", descricao: "COLUNA: valor, um campo por linha" },
];

/** Texto da seleção/resultado no formato escolhido. */
export function gerarFormato(formato: FormatoCopia, dados: ResultadoParse, linhas: number[], colunas: number[], tabela: string): string {
  switch (formato) {
    case "tabulado":
      return gerarTabulado(dados, linhas, colunas);
    case "csv":
      return gerarCSV(dados, linhas, colunas).replace(/^\uFEFF/, "");
    case "json":
      return gerarJSON(dados, linhas, colunas);
    case "markdown":
      return gerarMarkdown(dados, linhas, colunas);
    case "insert":
      return gerarInsert(dados, linhas, colunas, tabela);
    case "texto":
      return gerarTextoTabela(dados, linhas, colunas);
    case "lista":
      return gerarLista(dados, linhas, colunas);
  }
}
