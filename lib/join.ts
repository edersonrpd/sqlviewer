import type { Perfil } from "@/config/perfis";
import { inferirTipo } from "./parser";
import { buscarPerfil, chaveRelacao, ligacoesDoPerfil } from "./perfis";
import type { Coluna, ResultadoParse, Valor } from "./tipos";

/**
 * JOIN "com marcadores": antes das colunas de cada tabela vai uma coluna vazia
 * chamada `>>TABELA`. Ao colar o resultado, `separarPorMarcadores` usa esses
 * marcadores para devolver cada tabela na sua própria aba, sem as linhas
 * repetidas que o JOIN produz (ex.: itens × adiantamentos).
 */

export const PREFIXO_MARCADOR = ">>";

const tabelaDe = (p: Perfil | undefined, id: string) => p?.tabela ?? id;

/** Coluna que identifica um único registro do perfil (para o WHERE do JOIN). */
function colunaChave(p: Perfil): string | undefined {
  return p.chave ?? p.colunaTitulo;
}

const literal = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** `= 'x'` para um valor, `IN ('x', 'y')` para vários. */
export function condicaoValores(valores: string[]): string {
  return valores.length === 1 ? `= ${literal(valores[0])}` : `IN (${valores.map(literal).join(", ")})`;
}

/**
 * JOIN de um registro com todas as tabelas relacionadas no perfil e, um nível
 * abaixo, com as relações declaradas nessas tabelas (ex.: cadastro dos itens).
 * Retorna null quando não há relações ou o registro não tem chave.
 */
export function sqlJoin(dados: ResultadoParse, registro: number, perfilId: string | null): string | null {
  const perfil = buscarPerfil(perfilId);
  if (!perfil) return null;
  const nomeChave = colunaChave(perfil);
  const jChave = nomeChave ? dados.colunas.findIndex((c) => c.nome === nomeChave) : -1;
  const valorChave = jChave >= 0 ? chaveRelacao(dados.linhas[registro]?.[jChave] ?? null) : null;
  if (!nomeChave || valorChave === null) return null;
  return sqlJoinPor(perfil.id, nomeChave, [valorChave], (nome) => dados.colunas.some((c) => c.nome === nome));
}

/**
 * JOIN "com marcadores" filtrando a tabela principal por `coluna` (um ou vários
 * valores). `existe` diz quais colunas da tabela principal podem ser usadas nas
 * ligações (sem resultado colado, todas as declaradas no perfil).
 */
export function sqlJoinPor(
  perfilId: string,
  coluna: string,
  valores: string[],
  existe: (coluna: string) => boolean = () => true,
): string | null {
  const perfil = buscarPerfil(perfilId);
  if (!perfil || valores.length === 0) return null;
  const ligacoes = ligacoesDoPerfil(perfil.id).filter((l) => existe(l.colunaOrigem));
  if (ligacoes.length === 0) return null;

  const selects = [`'' AS \`${PREFIXO_MARCADOR}${perfil.id}\`, t0.*`];
  const joins: string[] = [];
  const incluidos = new Set([perfil.id, ...ligacoes.map((l) => l.perfilDestino)]);
  const juntar = (destinoId: string, colunaDestino: string, origem: string, colunaOrigem: string) => {
    const a = `t${joins.length + 1}`;
    selects.push(`'' AS \`${PREFIXO_MARCADOR}${destinoId}\`, ${a}.*`);
    // a condição "<> ''" evita ligar registros pela chave vazia (ex.: pedido sem NUMPOK)
    joins.push(
      `LEFT JOIN ${tabelaDe(buscarPerfil(destinoId), destinoId)} ${a}\n       ON ${a}.${colunaDestino} = ${origem}.${colunaOrigem} AND ${origem}.${colunaOrigem} <> ''`,
    );
    return a;
  };
  ligacoes.forEach((l) => {
    const a = juntar(l.perfilDestino, l.colunaDestino, "t0", l.colunaOrigem);
    // desce um nível pelas relações declaradas na tabela ligada (ex.: FATGOR → FATDOR → CADITE);
    // só quando a ligação também desce, para não subir de volta e puxar tudo do pai
    if (!perfil.relacoes?.some((r) => r.perfil === l.perfilDestino)) return;
    for (const r of buscarPerfil(l.perfilDestino)?.relacoes ?? []) {
      if (incluidos.has(r.perfil)) continue;
      incluidos.add(r.perfil);
      juntar(r.perfil, r.colunaDestino, a, r.colunaOrigem);
    }
  });

  return [
    `SELECT ${selects.join(",\n       ")}`,
    `  FROM ${tabelaDe(perfil, perfil.id)} t0`,
    ...joins.map((j) => `  ${j}`),
    ` WHERE t0.${coluna} ${condicaoValores(valores)};`,
  ].join("\n");
}

export type ParteSeparada = { tabela: string; dados: ResultadoParse };

/**
 * Separa um resultado com marcadores `>>TABELA` em um resultado por tabela.
 * Linhas totalmente NULL (LEFT JOIN sem correspondência) e repetidas são removidas.
 * Retorna null quando o resultado não tem marcadores.
 */
export function separarPorMarcadores(dados: ResultadoParse): ParteSeparada[] | null {
  const marcadores = dados.colunas
    .map((c, j) => ({ j, nome: c.original }))
    .filter((m) => m.nome.startsWith(PREFIXO_MARCADOR));
  if (marcadores.length === 0) return null;

  return marcadores.map((m, k) => {
    const fim = k + 1 < marcadores.length ? marcadores[k + 1].j : dados.colunas.length;
    const js = Array.from({ length: fim - m.j - 1 }, (_, x) => m.j + 1 + x);
    const vistas = new Set<string>();
    const linhas: Valor[][] = [];
    let repetidas = 0;
    for (const l of dados.linhas) {
      const parte = js.map((j) => l[j]);
      if (parte.every((v) => v === null)) continue;
      const assinatura = JSON.stringify(parte);
      if (vistas.has(assinatura)) {
        repetidas++;
        continue;
      }
      vistas.add(assinatura);
      linhas.push(parte);
    }
    // nomes originais da tabela (o "(2)" só existia por causa do JOIN)
    const usados = new Map<string, number>();
    const colunas: Coluna[] = js.map((j, x) => {
      const original = dados.colunas[j].original;
      const n = (usados.get(original) ?? 0) + 1;
      usados.set(original, n);
      const { tipo, casas } = inferirTipo(linhas.map((l) => l[x]));
      return { nome: n === 1 ? original : `${original} (${n})`, original, tipo, casas };
    });
    const tabela = m.nome.slice(PREFIXO_MARCADOR.length).trim() || `Parte ${k + 1}`;
    return {
      tabela,
      dados: {
        colunas,
        linhas,
        avisos: [
          ...dados.avisos.filter((a) => a.tipo !== "colunas-duplicadas"),
          {
            tipo: "separacao" as const,
            mensagem:
              `Separada de um resultado combinado (JOIN com marcadores): tabela ${tabela}, ` +
              `${linhas.length} registro(s)${repetidas ? `, ${repetidas} linha(s) repetida(s) removida(s)` : ""}.`,
          },
        ],
      },
    };
  });
}
