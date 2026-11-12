/**
 * Marketplaces de origem do pedido, identificados pelo NUMPOK.
 *
 * No banco o NUMPOK fica gravado com o prefixo do marketplace (ex.: MLB_SHML48393430410).
 * O suporte costuma ter em mãos só o número do marketplace (SHML48393430410), então
 * o "Montar consulta" acrescenta o prefixo e as visões mostram de qual marketplace é o pedido.
 */
export type IdMarketplace = "mercadolivre" | "shopee" | "amazon" | "magalu" | "ifood";

export type Marketplace = {
  id: IdMarketplace;
  nome: string;
  /** prefixo gravado no NUMPOK */
  prefixo: string;
  /** formato do número como vem do marketplace (sem prefixo) */
  padrao: RegExp;
  exemplo: string;
  /** o número fica em minúsculas (ex.: UUID do iFood); os demais vão em maiúsculas */
  minusculo?: boolean;
};

export const MARKETPLACES: Marketplace[] = [
  { id: "mercadolivre", nome: "Mercado Livre", prefixo: "MLB_", padrao: /^SHML[0-9A-Z]+$/i, exemplo: "SHML48393430410" },
  { id: "amazon", nome: "Amazon", prefixo: "AMZ_", padrao: /^\d{3}-\d{7}-\d{7}$/, exemplo: "702-8724657-3393834" },
  { id: "magalu", nome: "Magalu", prefixo: "MGL_", padrao: /^LU-[0-9A-Z-]+$/i, exemplo: "LU-1582670110102560-1" },
  // Shopee: 14 caracteres, começando pela data (AAMMDD) e seguidos de 8 letras/números
  // iFood: o id do pedido é um UUID (8-4-4-4-12 hexadecimais), gravado em minúsculas
  {
    id: "ifood",
    nome: "iFood",
    prefixo: "IFD_",
    padrao: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    exemplo: "2b349cf8-4ada-45c8-8002-009f87698874",
    minusculo: true,
  },
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
  const comPrefixo = MARKETPLACES.find((x) => v.toUpperCase().startsWith(x.prefixo));
  if (comPrefixo) return comPrefixo.prefixo + formatarNumero(comPrefixo, v.slice(comPrefixo.prefixo.length));
  const m = MARKETPLACES.find((x) => x.padrao.test(v));
  return m ? m.prefixo + formatarNumero(m, v) : v;
}

function formatarNumero(m: Marketplace, numero: string): string {
  return m.minusculo ? numero.toLowerCase() : numero.toUpperCase();
}

/**
 * Número como o marketplace envia, sem o prefixo do NUMPOK (MLB_SHML… → SHML…),
 * ex.: order_id do HUBCitel. Valores sem prefixo conhecido ficam como estão.
 */
export function removerPrefixoMarketplace(valor: string): string {
  const v = valor.trim();
  const m = MARKETPLACES.find((x) => v.toUpperCase().startsWith(x.prefixo));
  return m ? formatarNumero(m, v.slice(m.prefixo.length)) : v;
}
