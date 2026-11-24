import type { Aba } from "./estado";
import { linhasDoRelacionado } from "./fluxo";
import { relacionadosDoRegistro } from "./relacionados";
import type { Valor } from "./tipos";

/**
 * Visão JSON: JSONs do registro (e das linhas ligadas, ex.: LOG_JSON do log do HUB
 * na Tela do pedido) e o índice de valores das colunas, para marcar na árvore os
 * valores que também aparecem em alguma coluna.
 */

export type FonteJson = {
  id: string;
  /** "HUBCIT_LOGPED.LOG_JSON" */
  rotulo: string;
  aba: string;
  coluna: string;
  /** veio de uma aba ligada (não do próprio registro) */
  ligada: boolean;
  dado: unknown;
};

/** JSON de objeto/lista num texto; undefined quando não é JSON. */
export function lerJson(v: Valor): unknown {
  const t = v?.trim();
  if (!t || !((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")))) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/** Máximo de linhas ligadas por aba lidas como fonte de JSON. */
const MAX_LINHAS = 3;

export function fontesJson(aba: Aba, registro: number, abas: Aba[]): FonteJson[] {
  const res: FonteJson[] = [];
  const daLinha = (a: Aba, i: number, ligada: boolean, sufixo: string) =>
    a.dados.colunas.forEach((c, j) => {
      if (c.tipo !== "texto") return;
      const dado = lerJson(a.dados.linhas[i][j]);
      if (dado === undefined) return;
      res.push({ id: `${a.id}:${i}:${j}`, rotulo: `${a.nome}.${c.nome}${sufixo}`, aba: a.nome, coluna: c.nome, ligada, dado });
    });
  daLinha(aba, registro, false, "");
  for (const r of relacionadosDoRegistro(aba, registro, abas)) {
    const destino = abas.find((a) => a.id === r.abaId);
    const linhas = linhasDoRelacionado(r, abas);
    if (!destino) continue;
    linhas.slice(0, MAX_LINHAS).forEach((i, k) => daLinha(destino, i, true, linhas.length > 1 ? ` (${k + 1})` : ""));
  }
  return res;
}

export type Correspondencia = { coluna: string; valor: string; aproximado: boolean };

/** Chaves de comparação: número em centavos ou texto em maiúsculas (zeros e textos curtos ficam de fora). */
function chavesDoJson(v: unknown): string[] {
  if (typeof v === "number") return Number.isFinite(v) && Math.round(v * 100) !== 0 ? [`n:${Math.round(v * 100)}`] : [];
  if (typeof v === "string") {
    const t = v.trim();
    return t.length >= 3 ? [`s:${t.toUpperCase()}`] : [];
  }
  return [];
}

/**
 * Índice "valor → colunas" com as colunas do registro e das linhas ligadas.
 * Texto com prefixo (ex.: "MLB_SHML4856...") também casa sem o prefixo, como aproximado.
 */
export function indiceDeValores(aba: Aba, registro: number, abas: Aba[]): Map<string, Correspondencia[]> {
  const indice = new Map<string, Correspondencia[]>();
  const registrar = (k: string, c: Correspondencia) => {
    const l = indice.get(k) ?? [];
    if (!l.some((x) => x.coluna === c.coluna)) l.push(c);
    indice.set(k, l);
  };
  const daLinha = (a: Aba, i: number, prefixo: string) =>
    a.dados.colunas.forEach((c, j) => {
      const v = a.dados.linhas[i][j]?.trim();
      if (!v || lerJson(v) !== undefined) return;
      const coluna = `${prefixo}${c.nome}`;
      // inteiros pequenos (flags, códigos curtos) casariam com qualquer quantidade ou id do JSON
      const numero = c.tipo === "decimal" || (c.tipo === "inteiro" && !/^-?0\d/.test(v) && Math.abs(Number(v)) >= 1000);
      if (numero && Number.isFinite(Number(v))) {
        const n = Math.round(Number(v) * 100);
        if (n !== 0) registrar(`n:${n}`, { coluna, valor: v, aproximado: false });
      }
      if (v.length >= 3) registrar(`s:${v.toUpperCase()}`, { coluna, valor: v, aproximado: false });
      const k = v.indexOf("_");
      if (k > 0 && v.length - k - 1 >= 6) registrar(`s:${v.slice(k + 1).toUpperCase()}`, { coluna, valor: v, aproximado: true });
    });
  daLinha(aba, registro, "");
  for (const r of relacionadosDoRegistro(aba, registro, abas)) {
    const destino = abas.find((a) => a.id === r.abaId);
    const linhas = linhasDoRelacionado(r, abas);
    if (destino && linhas.length === 1) daLinha(destino, linhas[0], `${destino.nome}.`);
  }
  return indice;
}

export function correspondencias(indice: Map<string, Correspondencia[]>, v: unknown): Correspondencia[] {
  return chavesDoJson(v).flatMap((k) => indice.get(k) ?? []);
}

/** Caminho legível: $.products[0].saleFee */
export function juntarCaminho(pai: string, chave: string | number): string {
  return typeof chave === "number" ? `${pai}[${chave}]` : /^[A-Za-z_$][\w$]*$/.test(chave) ? `${pai}.${chave}` : `${pai}[${JSON.stringify(chave)}]`;
}

/** Caminhos (com os ancestrais) cujo nome ou valor contém o termo. */
export function buscarNoJson(dado: unknown, termo: string): { achados: Set<string>; abrir: Set<string> } {
  const t = termo.trim().toLowerCase();
  const achados = new Set<string>();
  const abrir = new Set<string>();
  if (!t) return { achados, abrir };
  const visitar = (v: unknown, caminho: string, ancestrais: string[], nome: string) => {
    const folha = v === null || typeof v !== "object";
    if (nome.toLowerCase().includes(t) || (folha && String(v).toLowerCase().includes(t))) {
      achados.add(caminho);
      ancestrais.forEach((a) => abrir.add(a));
    }
    if (folha) return;
    const filhos: [string | number, unknown][] = Array.isArray(v) ? v.map((x, k) => [k, x]) : Object.entries(v as object);
    for (const [k, x] of filhos) visitar(x, juntarCaminho(caminho, k), [...ancestrais, caminho], String(k));
  };
  visitar(dado, "$", [], "");
  return { achados, abrir };
}
