import type { Perfil } from "@/config/perfis";
import { paraNumero } from "./formatacao";
import type { ResultadoParse } from "./tipos";

export type ModoGrafico = "contagem" | "soma";
export type ConfigGrafico = { modo: ModoGrafico; categoria: number | null; valor: number | null };

export const MIN_CATEGORIAS = 2;
export const MAX_CATEGORIAS = 50;
export const TOP_CATEGORIAS = 15;

export const ROTULO_NULL = "NULL";
export const ROTULO_VAZIO = "(vazio)";
export const ROTULO_OUTROS = "Outros";

function distintos(dados: ResultadoParse, j: number, limite: number): number {
  const s = new Set<string | null>();
  for (const l of dados.linhas) {
    s.add(l[j]);
    if (s.size > limite) break;
  }
  return s.size;
}

/** Colunas texto/código com entre 2 e 50 valores distintos (códigos com zero à esquerda são texto). */
export function candidatasCategoria(dados: ResultadoParse): number[] {
  const res: number[] = [];
  dados.colunas.forEach((c, j) => {
    if (c.tipo !== "texto") return;
    const d = distintos(dados, j, MAX_CATEGORIAS);
    if (d >= MIN_CATEGORIAS && d <= MAX_CATEGORIAS) res.push(j);
  });
  return res;
}

/** Apenas colunas decimal/inteiro. Códigos (zero à esquerda, > 15 dígitos) já são texto. */
export function candidatasValor(dados: ResultadoParse): number[] {
  const res: number[] = [];
  dados.colunas.forEach((c, j) => {
    if (c.tipo === "decimal" || c.tipo === "inteiro") res.push(j);
  });
  return res;
}

function somaAbsoluta(dados: ResultadoParse, j: number): number {
  let s = 0;
  for (const l of dados.linhas) s += Math.abs(paraNumero(l[j]) ?? 0);
  return s;
}

/** Configuração inicial: o gráfico sugerido do perfil (se as colunas existirem) ou uma sugestão automática. */
export function sugerirGrafico(dados: ResultadoParse, perfil?: Perfil): ConfigGrafico {
  const cats = candidatasCategoria(dados);
  const vals = candidatasValor(dados);
  const indice = (nome?: string) => (nome ? dados.colunas.findIndex((c) => c.nome === nome) : -1);

  const sug = perfil?.graficoSugerido;
  if (sug) {
    const cat = indice(sug.categoria);
    const val = indice(sug.valor);
    if (cat >= 0 && (sug.modo === "contagem" || vals.includes(val))) {
      return { modo: sug.modo, categoria: cat, valor: sug.modo === "soma" ? val : (vals[0] ?? null) };
    }
  }

  // prefere categorias que agrupam (valores repetidos) a identificadores únicos
  const n = dados.linhas.length;
  const categoria = cats.find((j) => distintos(dados, j, n) < n) ?? cats[0] ?? null;
  let valor: number | null = null;
  let melhor = 0;
  for (const j of vals) {
    const s = somaAbsoluta(dados, j);
    if (s > melhor) {
      melhor = s;
      valor = j;
    }
  }
  return { modo: valor !== null ? "soma" : "contagem", categoria, valor: valor ?? vals[0] ?? null };
}

/** Explica por que não há gráfico possível, ou null se há. */
export function motivoSemGrafico(dados: ResultadoParse, config: ConfigGrafico): string | null {
  if (dados.linhas.length === 0) return "A consulta não tem linhas.";
  if (candidatasCategoria(dados).length === 0) {
    return (
      `Nenhuma coluna serve como categoria: é preciso uma coluna de texto/código com entre ` +
      `${MIN_CATEGORIAS} e ${MAX_CATEGORIAS} valores distintos.`
    );
  }
  if (config.modo === "soma" && candidatasValor(dados).length === 0) {
    return "Nenhuma coluna numérica (inteiro ou decimal) para somar. Use o modo Contagem por categoria.";
  }
  return null;
}

export type ItemGrafico = { categoria: string; valor: number; percentual: number };

export function agregar(
  dados: ResultadoParse,
  indices: number[],
  config: ConfigGrafico,
): { itens: ItemGrafico[]; total: number } {
  const { categoria, valor, modo } = config;
  if (categoria === null || (modo === "soma" && valor === null)) return { itens: [], total: 0 };
  const grupos = new Map<string, number>();
  for (const i of indices) {
    const l = dados.linhas[i];
    const c = l[categoria];
    const chave = c === null ? ROTULO_NULL : c === "" ? ROTULO_VAZIO : c;
    const v = modo === "contagem" ? 1 : (paraNumero(l[valor!]) ?? 0);
    grupos.set(chave, (grupos.get(chave) ?? 0) + v);
  }
  let lista = [...grupos.entries()].map(([categoria, valor]) => ({ categoria, valor }));
  lista.sort((a, b) => b.valor - a.valor || a.categoria.localeCompare(b.categoria, "pt-BR"));
  if (lista.length > TOP_CATEGORIAS) {
    const outros = lista.slice(TOP_CATEGORIAS).reduce((s, x) => s + x.valor, 0);
    lista = [...lista.slice(0, TOP_CATEGORIAS), { categoria: ROTULO_OUTROS, valor: outros }];
  }
  const total = lista.reduce((s, x) => s + x.valor, 0);
  return {
    itens: lista.map((x) => ({ ...x, percentual: total !== 0 ? x.valor / total : 0 })),
    total,
  };
}
