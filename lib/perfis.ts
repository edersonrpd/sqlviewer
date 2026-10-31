import { PERFIS, type Perfil } from "@/config/perfis";
import type { Valor } from "./tipos";

export type Deteccao =
  | { tipo: "perfil"; perfil: Perfil }
  | { tipo: "combinada"; perfis: Perfil[] }
  | { tipo: "generica" };

/**
 * Um perfil casa quando todas as colunas da assinatura existem no cabeçalho.
 * Se vários casarem, vence o de assinatura mais longa — a não ser que algum dos
 * outros tenha colunas de assinatura fora da vencedora: aí são tabelas
 * diferentes no mesmo resultado (JOIN) e a consulta é "combinada".
 */
export function detectarPerfil(colunas: string[], perfis: Perfil[] = PERFIS): Deteccao {
  const nomes = new Set(colunas);
  const casados = perfis
    .filter((p) => p.assinatura.length > 0 && p.assinatura.every((c) => nomes.has(c)))
    .sort((a, b) => b.assinatura.length - a.assinatura.length);
  if (casados.length === 0) return { tipo: "generica" };
  const [vencedor, ...outros] = casados;
  const daVencedora = new Set(vencedor.assinatura);
  const diferentes = outros.filter((p) => p.assinatura.some((c) => !daVencedora.has(c)));
  if (diferentes.length > 0) return { tipo: "combinada", perfis: [vencedor, ...diferentes] };
  return { tipo: "perfil", perfil: vencedor };
}

export function buscarPerfil(id: string | null | undefined, perfis: Perfil[] = PERFIS): Perfil | undefined {
  return id ? perfis.find((p) => p.id === id) : undefined;
}

/** Chave normalizada para ligar registros: raw com trim, comparado como string. Nunca vira número. */
export function chaveRelacao(v: Valor): string | null {
  if (v === null) return null;
  const k = v.trim();
  return k === "" ? null : k;
}

export function chavesIguais(a: Valor, b: Valor): boolean {
  const ka = chaveRelacao(a);
  return ka !== null && ka === chaveRelacao(b);
}

/** Uma ligação entre o perfil atual e outro perfil, em qualquer sentido. */
export type LigacaoPerfil = {
  perfilDestino: string;
  colunaOrigem: string;
  colunaDestino: string;
  /** demais colunas da chave composta (já no sentido desta ligação) */
  extras: { origem: string; destino: string }[];
  rotulo: string;
};

/**
 * Relações que partem de `perfilId`: as declaradas nele e as declaradas em
 * outros perfis apontando para ele (a relação vale nos dois sentidos).
 */
export function ligacoesDoPerfil(perfilId: string, perfis: Perfil[] = PERFIS): LigacaoPerfil[] {
  const atual = buscarPerfil(perfilId, perfis);
  const ligacoes: LigacaoPerfil[] = [];
  for (const r of atual?.relacoes ?? []) {
    ligacoes.push({ perfilDestino: r.perfil, colunaOrigem: r.colunaOrigem, colunaDestino: r.colunaDestino, extras: r.extras ?? [], rotulo: r.rotulo });
  }
  for (const p of perfis) {
    if (p.id === perfilId) continue;
    for (const r of p.relacoes ?? []) {
      if (r.perfil !== perfilId) continue;
      ligacoes.push({
        perfilDestino: p.id,
        colunaOrigem: r.colunaDestino,
        colunaDestino: r.colunaOrigem,
        extras: (r.extras ?? []).map((e) => ({ origem: e.destino, destino: e.origem })),
        rotulo: atual?.rotulosInversos?.[p.id] ?? p.nome,
      });
    }
  }
  return ligacoes;
}

/** Parte adicional de uma chave composta: coluna no destino e valor esperado. */
export type ChaveExtra = { j: number; valor: Valor };

/**
 * Índices das linhas de `destino` cuja coluna `jDestino` tem a mesma chave que `valor`
 * (e, numa chave composta, as mesmas chaves nas colunas `extras`).
 */
export function linhasLigadas(valor: Valor, destino: Valor[][], jDestino: number, extras: readonly ChaveExtra[] = []): number[] {
  const k = chaveRelacao(valor);
  if (k === null) return [];
  const ks = extras.map((e) => ({ j: e.j, k: chaveRelacao(e.valor) }));
  const res: number[] = [];
  for (let i = 0; i < destino.length; i++) {
    const l = destino[i];
    if (chaveRelacao(l[jDestino]) === k && ks.every((e) => chaveRelacao(l[e.j]) === e.k)) res.push(i);
  }
  return res;
}
