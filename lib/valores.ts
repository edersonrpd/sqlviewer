import type { TermoConciliacao } from "@/config/perfis";
import type { Aba } from "./estado";
import { linhasDoRelacionado } from "./fluxo";
import { buscarPerfil } from "./perfis";
import { relacionadosDoRegistro, type Relacionado } from "./relacionados";
import { valorJson } from "./tela";
import type { Valor } from "./tipos";

/**
 * Visão Valores: contas do perfil (conciliações) e valores em dinheiro que se
 * repetem entre o registro e as abas ligadas.
 */

export type TermoMontado = {
  rotulo: string;
  /** de onde veio: "FATGOR.FGO_TOTPRO", "Σ FATDOR.FDO_TOTITE", "HUBCIT_LOGPED.LOG_JSON → totalPrice" */
  origem: string;
  sinal: 1 | -1;
  valor: number | null;
  /** motivo quando não deu para obter o valor (aba não aberta, sem registro ligado...) */
  falta?: string;
};

export type LadoConciliacao = { termos: TermoMontado[]; total: number | null };

export type ConciliacaoMontada = {
  rotulo: string;
  esperado: LadoConciliacao;
  comparado: LadoConciliacao;
  /** comparado − esperado */
  diferenca: number | null;
  estado: "bate" | "diferente" | "incompleta";
  dica?: string;
};

/** Soma os números de um valor (um por linha quando veio de um caminho com `*`). */
function numeroDe(v: Valor | undefined): number | null {
  if (v === null || v === undefined) return null;
  const partes = v
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return null;
  let soma = 0;
  for (const p of partes) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    soma += n;
  }
  return soma;
}

const centavos = (n: number) => Math.round(n * 100);

function montarTermo(t: TermoConciliacao, aba: Aba, registro: number, abas: Aba[], rels: Relacionado[]): TermoMontado {
  const sinal = t.sinal ?? 1;
  const base = { rotulo: t.rotulo, sinal };
  const ler = (linha: Valor[], j: number) => (t.json ? numeroDe(valorJson(linha[j], t.json)) : numeroDe(linha[j]));
  const sufixo = t.json ? ` → ${t.json}` : "";

  if (!t.perfil || t.perfil === aba.perfilId) {
    const j = aba.dados.colunas.findIndex((c) => c.nome === t.coluna);
    if (j < 0) return { ...base, origem: `${aba.nome}.${t.coluna}${sufixo}`, valor: null, falta: `${t.coluna} não está na consulta` };
    const v = ler(aba.dados.linhas[registro], j);
    return { ...base, origem: `${aba.nome}.${t.coluna}${sufixo}`, valor: v ?? 0 };
  }

  const origemTab = `${t.perfil}.${t.coluna}${sufixo}`;
  const r = rels.find((x) => abas.find((a) => a.id === x.abaId)?.perfilId === t.perfil);
  if (!r) return { ...base, origem: origemTab, valor: null, falta: `abra a aba ${t.perfil}` };
  const destino = abas.find((a) => a.id === r.abaId)!;
  const j = destino.dados.colunas.findIndex((c) => c.nome === t.coluna);
  if (j < 0) return { ...base, origem: origemTab, valor: null, falta: `${t.coluna} não está na aba ${destino.nome}` };
  const linhas = linhasDoRelacionado(r, abas);
  if (linhas.length === 0) return { ...base, origem: origemTab, valor: null, falta: `nenhum registro ligado em ${destino.nome}` };
  let soma = 0;
  for (const i of linhas) soma += ler(destino.dados.linhas[i], j) ?? 0;
  return { ...base, origem: `${linhas.length > 1 ? "Σ " : ""}${destino.nome}.${t.coluna}${sufixo}`, valor: soma };
}

function montarLado(termos: TermoConciliacao[], aba: Aba, registro: number, abas: Aba[], rels: Relacionado[]): LadoConciliacao {
  const m = termos.map((t) => montarTermo(t, aba, registro, abas, rels));
  const total = m.some((t) => t.valor === null) ? null : m.reduce((s, t) => s + t.sinal * t.valor!, 0);
  return { termos: m, total };
}

export function montarConciliacoes(aba: Aba, registro: number, abas: Aba[]): ConciliacaoMontada[] {
  const perfil = buscarPerfil(aba.perfilId);
  if (!perfil?.conciliacoes) return [];
  const rels = relacionadosDoRegistro(aba, registro, abas);
  return perfil.conciliacoes.map((c) => {
    const esperado = montarLado(c.esperado, aba, registro, abas, rels);
    const comparado = montarLado(c.comparado, aba, registro, abas, rels);
    const diferenca = esperado.total === null || comparado.total === null ? null : (centavos(comparado.total) - centavos(esperado.total)) / 100;
    const estado = diferenca === null ? "incompleta" : diferenca === 0 ? "bate" : "diferente";
    return { rotulo: c.rotulo, esperado, comparado, diferenca, estado, dica: c.dica };
  });
}

export type GrupoValor = { valor: number; origens: string[] };

/**
 * Valores em dinheiro (colunas decimais com 2 casas, diferentes de zero) que aparecem
 * em mais de um lugar: no registro e nas linhas ligadas das outras abas (somadas
 * quando são várias). Ajuda a ver de relance o que bate entre as tabelas.
 */
export function valoresRepetidos(aba: Aba, registro: number, abas: Aba[]): { grupos: GrupoValor[]; avulsos: GrupoValor[] } {
  const fontes: { origem: string; valor: number }[] = [];
  const doRegistro = (nome: string, a: Aba, linhas: number[]) => {
    a.dados.colunas.forEach((c, j) => {
      if (c.tipo !== "decimal" || c.casas !== 2) return;
      let soma = 0;
      let algum = false;
      for (const i of linhas) {
        const n = numeroDe(a.dados.linhas[i][j]);
        if (n !== null) {
          soma += n;
          algum = true;
        }
      }
      if (algum && centavos(soma) !== 0) fontes.push({ origem: `${linhas.length > 1 ? "Σ " : ""}${nome}.${c.nome}`, valor: soma });
    });
  };
  doRegistro(aba.nome, aba, [registro]);
  for (const r of relacionadosDoRegistro(aba, registro, abas)) {
    const destino = abas.find((a) => a.id === r.abaId);
    const linhas = linhasDoRelacionado(r, abas);
    if (destino && linhas.length > 0) doRegistro(destino.nome, destino, linhas);
  }

  const porValor = new Map<number, GrupoValor>();
  for (const f of fontes) {
    const k = centavos(f.valor);
    const g = porValor.get(k) ?? { valor: k / 100, origens: [] };
    if (!g.origens.includes(f.origem)) g.origens.push(f.origem);
    porValor.set(k, g);
  }
  const todos = [...porValor.values()].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  return { grupos: todos.filter((g) => g.origens.length > 1), avulsos: todos.filter((g) => g.origens.length === 1) };
}
