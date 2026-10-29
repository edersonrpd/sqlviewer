import type { ResultadoParse, Valor } from "./tipos";

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

/** Cabeçalho + linhas separadas por TAB, para colar no Excel. */
export function gerarTabulado(dados: ResultadoParse, linhas: number[], colunas: number[]): string {
  const out = [colunas.map((j) => campoTabulado(dados.colunas[j].nome)).join("\t")];
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
