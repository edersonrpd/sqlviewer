import { BUSCAS_RAPIDAS, type BuscaRapida } from "@/config/perfis";
import { condicaoValores, condicoesExtras, sqlJoinPor } from "./join";
import { normalizarNumpok, removerPrefixoMarketplace } from "./marketplace";
import { buscarPerfil } from "./perfis";

/** Separa os valores digitados/colados (vírgula, ponto e vírgula, espaço ou quebra de linha), sem aspas e sem repetição. */
export function separarValores(texto: string): string[] {
  const vistos = new Set<string>();
  for (const bruto of texto.split(/[\s,;]+/)) {
    const v = bruto.replace(/^['"]+|['"]+$/g, "").trim();
    if (v) vistos.add(v);
  }
  return [...vistos];
}

export function buscaRapida(id: string): BuscaRapida | undefined {
  return BUSCAS_RAPIDAS.find((b) => b.id === id);
}

/** A busca tem JOIN disponível (o perfil tem relações)? */
export function temJoin(b: BuscaRapida): boolean {
  return sqlJoinPor(b.perfil, b.coluna, ["x"]) !== null;
}

/**
 * SQL da busca rápida: só a tabela, ou o JOIN com as relacionadas.
 * `extras`: valores do filtro adicional da busca (ex.: domínio no HUB); vazio = sem filtro.
 */
export function montarConsulta(b: BuscaRapida, valores: string[], comJoin: boolean, extras: string[] = []): string | null {
  if (valores.length === 0) return null;
  valores = valoresDaBusca(b, valores);
  const filtros = b.filtroExtra ? [{ coluna: b.filtroExtra.coluna, valores: extras }] : [];
  if (comJoin) {
    const sql = sqlJoinPor(b.perfil, b.coluna, valores, undefined, filtros);
    if (sql) return sql;
  }
  const tabela = buscarPerfil(b.perfil)?.tabela ?? b.perfil;
  return `SELECT * FROM ${tabela} WHERE ${b.coluna} ${condicaoValores(valores)}${condicoesExtras(filtros)};`;
}

/** Valores como vão para o SQL (ex.: NUMPOK com o prefixo do marketplace, order_id do HUB sem ele). */
export function valoresDaBusca(b: BuscaRapida, valores: string[]): string[] {
  const converter = conversaoDaBusca(b);
  return converter ? [...new Set(valores.map(converter))] : valores;
}

/** Conversão aplicada a cada valor digitado, quando a busca tem uma. */
export function conversaoDaBusca(b: BuscaRapida): ((v: string) => string) | null {
  if (b.prefixarMarketplace) return normalizarNumpok;
  if (b.removerPrefixoMarketplace) return removerPrefixoMarketplace;
  return null;
}
