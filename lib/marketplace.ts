/**
 * Marketplaces de origem do pedido, identificados pelo NUMPOK.
 *
 * No banco o NUMPOK fica gravado com o prefixo do marketplace (ex.: MLB_SHML48393430410).
 * O suporte costuma ter em mãos só o número do marketplace (SHML48393430410), então
 * o "Montar consulta" acrescenta o prefixo e as visões mostram de qual marketplace é o pedido.
 */
export type IdMarketplace = "mercadolivre" | "shopee" | "amazon" | "magalu";

export type Marketplace = {
  id: IdMarketplace;
  nome: string;
  /** prefixo gravado no NUMPOK */
  prefixo: string;
  /** formato do número como vem do marketplace (sem prefixo) */
  padrao: RegExp;
  exemplo: string;
};

export const MARKETPLACES: Marketplace[] = [
  { id: "mercadolivre", nome: "Mercado Livre", prefixo: "MLB_", padrao: /^SHML[0-9A-Z]+$/i, exemplo: "SHML48393430410" },
  { id: "amazon", nome: "Amazon", prefixo: "AMZ_", padrao: /^\d{3}-\d{7}-\d{7}$/, exemplo: "702-8724657-3393834" },
  { id: "magalu", nome: "Magalu", prefixo: "MGL_", padrao: /^LU-[0-9A-Z-]+$/i, exemplo: "LU-1582670110102560-1" },
  // Shopee: 14 caracteres, começando pela data (AAMMDD) e seguidos de 8 letras/números
  { id: "shopee", nome: "Shopee", prefixo: "SHP_", padrao: /^\d{6}[0-9A-Z]{8}$/i, exemplo: "2610314CV1MKT2" },
];

/** Marketplace de um NUMPOK, já gravado com prefixo (MLB_…) ou só com o número do marketplace (SHML…). */
export function identificarMarketplace(valor: string | null | undefined): Marketplace | null {
  const v = valor?.trim();
  if (!v) return null;
  const maiusculo = v.toUpperCase();
  for (const m of MARKETPLACES) if (maiusculo.startsWith(m.prefixo)) return m;
  for (const m of MARKETPLACES) if (m.padrao.test(v)) return m;
  return null;
}

/**
 * NUMPOK como está gravado no banco: acrescenta o prefixo do marketplace quando o
 * número digitado é reconhecido e ainda não tem prefixo. Os demais ficam como estão.
 */
export function normalizarNumpok(valor: string): string {
  const v = valor.trim();
  const maiusculo = v.toUpperCase();
  if (MARKETPLACES.some((m) => maiusculo.startsWith(m.prefixo))) return maiusculo;
  const m = MARKETPLACES.find((x) => x.padrao.test(v));
  return m ? m.prefixo + maiusculo : v;
}
