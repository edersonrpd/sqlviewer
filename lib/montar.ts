import { BUSCAS_RAPIDAS, type BuscaRapida } from "@/config/perfis";
import { condicaoValores, sqlJoinPor } from "./join";
import { normalizarNumpok } from "./marketplace";
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

/** SQL da busca rápida: só a tabela, ou o JOIN com as relacionadas. */
export function montarConsulta(b: BuscaRapida, valores: string[], comJoin: boolean): string | null {
  if (valores.length === 0) return null;
  valores = valoresDaBusca(b, valores);
  if (comJoin) {
    const sql = sqlJoinPor(b.perfil, b.coluna, valores);
    if (sql) return sql;
  }
  const tabela = buscarPerfil(b.perfil)?.tabela ?? b.perfil;
  return `SELECT * FROM ${tabela} WHERE ${b.coluna} ${condicaoValores(valores)};`;
}

/** Valores como vão para o SQL (ex.: NUMPOK com o prefixo do marketplace). */
export function valoresDaBusca(b: BuscaRapida, valores: string[]): string[] {
  return b.prefixarMarketplace ? [...new Set(valores.map(normalizarNumpok))] : valores;
}
