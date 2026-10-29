import type { Coluna, TipoColuna, Valor } from "./tipos";

/** "1234.50" → "1.234,50", mantendo as casas do valor original e sem passar por Number. */
export function formatarDecimal(raw: string): string {
  const neg = raw.startsWith("-");
  const [int, frac] = (neg ? raw.slice(1) : raw).split(".");
  const agrupado = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + agrupado + (frac !== undefined ? "," + frac : "");
}

/** "2024-10-14" → "14/10/2024" */
export function formatarData(raw: string): string {
  return `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}`;
}

/** Texto exibido para um valor não nulo. Inteiros não são agrupados (podem ser IDs). */
export function formatarValor(v: string, tipo: TipoColuna): string {
  switch (tipo) {
    case "decimal":
      return formatarDecimal(v);
    case "data":
      return formatarData(v);
    case "datahora":
      return `${formatarData(v)} ${v.slice(11)}`;
    default:
      return v;
  }
}

/** Número para cálculo/ordenação de colunas inteiro/decimal. */
export function paraNumero(v: Valor): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const nf = new Map<number, Intl.NumberFormat>();
/** Formata um número calculado (soma, total) em pt-BR. */
export function formatarNumero(n: number, casas = 2): string {
  let f = nf.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    nf.set(casas, f);
  }
  return f.format(n);
}

export function formatarPercentual(p: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p);
}

export function ehNumerica(c: Coluna): boolean {
  return c.tipo === "inteiro" || c.tipo === "decimal";
}

export const NOMES_TIPOS: Record<TipoColuna, string> = {
  inteiro: "Inteiro",
  decimal: "Decimal",
  data: "Data",
  hora: "Hora",
  datahora: "Data-hora",
  texto: "Texto/código",
};
