import { PERFIS, type Perfil } from "@/config/perfis";

/**
 * Mapa das relações entre tabelas, montado a partir dos perfis: cada perfil é
 * uma caixa, cada `relacao` (e, opcionalmente, cada `cadastro`) uma seta.
 * O desenho é em camadas da esquerda para a direita: a tabela de partida
 * (ninguém aponta para ela) à esquerda, as ligadas a ela na coluna seguinte…
 */

export type NoMapa = {
  id: string;
  /** nome da tabela no banco */
  tabela: string;
  nome: string;
  banco?: string;
  /** tabela de cadastro sem perfil (só citada em `cadastros`) */
  cadastro: boolean;
  x: number;
  y: number;
};

export type LigacaoColunas = {
  rotulo: string;
  /** pares origem = destino (a chave composta tem mais de um) */
  pares: { origem: string; destino: string }[];
  tipo: "relacao" | "cadastro";
};

export type ArestaMapa = { de: string; para: string; ligacoes: LigacaoColunas[] };

export type Mapa = { nos: NoMapa[]; arestas: ArestaMapa[]; largura: number; altura: number };

export const NO_LARGURA = 200;
export const NO_ALTURA = 52;
const ESPACO_X = 110;
const ESPACO_Y = 18;
const ESPACO_GRUPO = 50;
const MARGEM = 20;

const tabelaDo = (p: Perfil) => p.tabela ?? p.id;

export function montarMapa(perfis: Perfil[] = PERFIS, opcoes: { cadastros?: boolean } = {}): Mapa {
  const nos = new Map<string, Omit<NoMapa, "x" | "y">>();
  for (const p of perfis) nos.set(p.id, { id: p.id, tabela: tabelaDo(p), nome: p.nome, banco: p.banco, cadastro: false });
  // cadastro que já tem perfil (ex.: CADCLI) aponta para a caixa do perfil
  const porTabela = new Map(perfis.map((p) => [tabelaDo(p).toUpperCase(), p.id]));

  const arestas = new Map<string, ArestaMapa>();
  const ligar = (de: string, para: string, l: LigacaoColunas) => {
    const k = `${de}>${para}`;
    const a = arestas.get(k) ?? { de, para, ligacoes: [] };
    // mesma ligação declarada como relação e como cadastro: fica uma só
    const igual = a.ligacoes.find((x) => x.pares.map((p) => `${p.origem}=${p.destino}`).join() === l.pares.map((p) => `${p.origem}=${p.destino}`).join());
    if (!igual) a.ligacoes.push(l);
    arestas.set(k, a);
  };

  for (const p of perfis) {
    for (const r of p.relacoes ?? []) {
      if (!nos.has(r.perfil)) continue;
      ligar(p.id, r.perfil, {
        rotulo: r.rotulo,
        tipo: "relacao",
        pares: [{ origem: r.colunaOrigem, destino: r.colunaDestino }, ...(r.extras ?? [])],
      });
    }
  }
  if (opcoes.cadastros) {
    for (const p of perfis) {
      for (const c of p.cadastros ?? []) {
        const id = porTabela.get(c.tabela.toUpperCase()) ?? c.tabela;
        if (!nos.has(id)) nos.set(id, { id, tabela: c.tabela, nome: c.grupo ?? c.rotulo, cadastro: true });
        ligar(p.id, id, { rotulo: c.rotulo, tipo: "cadastro", pares: [{ origem: c.coluna, destino: c.colunaTabela }] });
      }
    }
  }

  const lista = [...arestas.values()];
  const saidas = new Map<string, string[]>();
  const entradas = new Map<string, string[]>();
  for (const a of lista) {
    saidas.set(a.de, [...(saidas.get(a.de) ?? []), a.para]);
    entradas.set(a.para, [...(entradas.get(a.para) ?? []), a.de]);
  }

  // grupos ligados (ex.: Autcom e banco do HUB), o maior primeiro
  const ids = [...nos.keys()];
  const grupo = new Map<string, number>();
  const grupos: string[][] = [];
  for (const id of ids) {
    if (grupo.has(id)) continue;
    const g: string[] = [];
    const pilha = [id];
    grupo.set(id, grupos.length);
    while (pilha.length) {
      const n = pilha.pop()!;
      g.push(n);
      for (const v of [...(saidas.get(n) ?? []), ...(entradas.get(n) ?? [])]) {
        if (!grupo.has(v)) {
          grupo.set(v, grupos.length);
          pilha.push(v);
        }
      }
    }
    grupos.push(g);
  }
  grupos.sort((a, b) => b.length - a.length);

  const posicionados: NoMapa[] = [];
  let topo = MARGEM;
  let largura = 0;
  for (const g of grupos) {
    const ordem = ids.filter((id) => g.includes(id));
    // camada: caminho mais longo a partir das tabelas de partida (sem entradas), para
    // as setas irem sempre para a direita (ex.: CADCLI depois de FATDOR, que também aponta para ele)
    const raizes = ordem.filter((id) => !(entradas.get(id) ?? []).length);
    const camada = new Map<string, number>((raizes.length ? raizes : [ordem[0]]).map((r) => [r, 0]));
    // ciclos: no máximo uma volta por tabela
    for (let volta = 0; volta < ordem.length; volta++) {
      let mudou = false;
      for (const a of lista) {
        const c = camada.get(a.de);
        if (c === undefined || !g.includes(a.para)) continue;
        if ((camada.get(a.para) ?? -1) < c + 1 && c + 1 < ordem.length) {
          camada.set(a.para, c + 1);
          mudou = true;
        }
      }
      if (!mudou) break;
    }
    const colunas: string[][] = [];
    for (const id of ordem) (colunas[camada.get(id) ?? 0] ??= []).push(id);

    // dentro da coluna, perto de quem aponta para ela (menos cruzamentos); cadastros por último
    const linha = new Map<string, number>();
    colunas.forEach((col, c) => {
      if (c > 0) {
        const media = (id: string) => {
          const pais = (entradas.get(id) ?? []).filter((p) => linha.has(p));
          return pais.length ? pais.reduce((s, p) => s + linha.get(p)!, 0) / pais.length : 0;
        };
        const cad = (id: string) => (nos.get(id)!.cadastro ? 1 : 0);
        col.sort((a, b) => cad(a) - cad(b) || media(a) - media(b));
      }
      col.forEach((id, k) => linha.set(id, k));
    });

    const maiorColuna = Math.max(...colunas.map((c) => c?.length ?? 0));
    const alturaGrupo = maiorColuna * (NO_ALTURA + ESPACO_Y) - ESPACO_Y;
    colunas.forEach((col, c) => {
      // colunas mais curtas ficam centralizadas na altura do grupo
      const desloc = (alturaGrupo - (col.length * (NO_ALTURA + ESPACO_Y) - ESPACO_Y)) / 2;
      col.forEach((id, k) => {
        posicionados.push({ ...nos.get(id)!, x: MARGEM + c * (NO_LARGURA + ESPACO_X), y: topo + desloc + k * (NO_ALTURA + ESPACO_Y) });
      });
      largura = Math.max(largura, MARGEM * 2 + (c + 1) * NO_LARGURA + c * ESPACO_X);
    });
    topo += alturaGrupo + ESPACO_GRUPO;
  }

  return { nos: posicionados, arestas: lista, largura, altura: topo - ESPACO_GRUPO + MARGEM };
}

/** Condição do JOIN de uma ligação, com os nomes das tabelas (ex.: FATGOR.AUTOINCREM = FATDOR.FDO_SEQGER). */
export function condicaoJoin(de: NoMapa, para: NoMapa, l: LigacaoColunas): string {
  return l.pares.map((p) => `${de.tabela}.${p.origem} = ${para.tabela}.${p.destino}`).join(" AND ");
}
