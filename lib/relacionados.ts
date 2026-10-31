import type { Aba } from "./estado";
import { buscarPerfil, chaveRelacao, ligacoesDoPerfil, linhasLigadas, type ChaveExtra } from "./perfis";

/** Extras de um Relacionado no formato de `linhasLigadas`. */
export function extrasLigacao(extras: Relacionado["extras"]): ChaveExtra[] {
  return extras.map((e) => ({ j: e.coluna, valor: e.chave }));
}

export type Relacionado = {
  rotulo: string;
  abaId: string;
  abaNome: string;
  /** coluna da aba destino usada no filtro */
  colunaDestino: number;
  colunaDestinoNome: string;
  /** chave normalizada (raw com trim); null quando o registro não tem chave */
  chave: string | null;
  /** demais colunas da chave composta, na aba destino, com o valor deste registro */
  extras: { coluna: number; nome: string; chave: string | null }[];
  quantidade: number;
};

/**
 * Relações ativas para um registro: só aparecem quando há outra aba aberta com
 * o perfil declarado e as duas colunas da ligação existem nos resultados.
 */
export function relacionadosDoRegistro(aba: Aba, registro: number, abas: Aba[]): Relacionado[] {
  if (!aba.perfilId) return [];
  const res: Relacionado[] = [];
  for (const lig of ligacoesDoPerfil(aba.perfilId)) {
    const jOrigem = aba.dados.colunas.findIndex((c) => c.nome === lig.colunaOrigem);
    if (jOrigem < 0) continue;
    const destinos = abas.filter((a) => a.id !== aba.id && a.perfilId === lig.perfilDestino);
    for (const destino of destinos) {
      const jDestino = destino.dados.colunas.findIndex((c) => c.nome === lig.colunaDestino);
      if (jDestino < 0) continue;
      const valor = aba.dados.linhas[registro]?.[jOrigem] ?? null;
      // partes da chave composta presentes nos dois resultados (as ausentes não restringem)
      const extras = lig.extras.flatMap((e) => {
        const jo = aba.dados.colunas.findIndex((c) => c.nome === e.origem);
        const jd = destino.dados.colunas.findIndex((c) => c.nome === e.destino);
        return jo < 0 || jd < 0 ? [] : [{ coluna: jd, nome: e.destino, chave: chaveRelacao(aba.dados.linhas[registro]?.[jo] ?? null) }];
      });
      res.push({
        rotulo: destinos.length > 1 ? `${lig.rotulo} — ${destino.nome}` : lig.rotulo,
        abaId: destino.id,
        abaNome: destino.nome,
        colunaDestino: jDestino,
        colunaDestinoNome: lig.colunaDestino,
        chave: chaveRelacao(valor),
        extras,
        quantidade: linhasLigadas(valor, destino.dados.linhas, jDestino, extrasLigacao(extras)).length,
      });
    }
  }
  return res;
}

export type RelacaoPendente = {
  rotulo: string;
  perfilDestino: string;
  /** nome da tabela para o SQL sugerido */
  tabela: string;
  colunaDestino: string;
  /** coluna deste registro usada como chave */
  colunaOrigem: string;
  /** null quando a coluna de origem está vazia/NULL (ex.: pedido sem fatura) */
  chave: string | null;
  /** demais colunas da chave composta (nome no destino) com o valor deste registro */
  extras: { coluna: string; chave: string | null }[];
};

/** Relações declaradas no perfil cuja aba ainda não foi aberta (para sugerir a consulta). */
export function relacoesPendentes(aba: Aba, registro: number, abas: Aba[]): RelacaoPendente[] {
  if (!aba.perfilId) return [];
  const res: RelacaoPendente[] = [];
  for (const lig of ligacoesDoPerfil(aba.perfilId)) {
    if (abas.some((a) => a.id !== aba.id && a.perfilId === lig.perfilDestino)) continue;
    const j = aba.dados.colunas.findIndex((c) => c.nome === lig.colunaOrigem);
    if (j < 0) continue;
    const chave = chaveRelacao(aba.dados.linhas[registro]?.[j] ?? null);
    const destino = buscarPerfil(lig.perfilDestino);
    res.push({
      rotulo: lig.rotulo,
      perfilDestino: lig.perfilDestino,
      tabela: destino?.tabela ?? lig.perfilDestino,
      colunaDestino: lig.colunaDestino,
      colunaOrigem: lig.colunaOrigem,
      chave,
      extras: lig.extras.flatMap((e) => {
        const jo = aba.dados.colunas.findIndex((c) => c.nome === e.origem);
        return jo < 0 ? [] : [{ coluna: e.destino, chave: chaveRelacao(aba.dados.linhas[registro]?.[jo] ?? null) }];
      }),
    });
  }
  return res;
}

export type CadastroPendente = {
  /** rótulo da coluna, ou o `grupo` quando várias colunas apontam para o mesmo registro */
  rotulo: string;
  /** rótulos de todas as colunas que apontam para o registro (para a dica) */
  papeis: string[];
  tabela: string;
  colunaTabela: string;
  colunas: string[];
  chave: string;
};

/**
 * Cadastros apontados pelo registro (chaves estrangeiras), para o SELECT individual.
 * Colunas vazias ficam de fora; colunas que apontam para o mesmo registro viram uma linha só.
 */
export function cadastrosPendentes(aba: Aba, registro: number): CadastroPendente[] {
  const res: CadastroPendente[] = [];
  for (const c of buscarPerfil(aba.perfilId)?.cadastros ?? []) {
    const j = aba.dados.colunas.findIndex((col) => col.nome === c.coluna);
    if (j < 0) continue;
    const chave = chaveRelacao(aba.dados.linhas[registro]?.[j] ?? null);
    if (chave === null) continue;
    const igual = res.find((r) => r.tabela === c.tabela && r.colunaTabela === c.colunaTabela && r.chave === chave);
    if (igual) {
      igual.rotulo = c.grupo ?? igual.rotulo;
      igual.papeis.push(c.rotulo);
      igual.colunas.push(c.coluna);
    } else {
      res.push({ rotulo: c.rotulo, papeis: [c.rotulo], tabela: c.tabela, colunaTabela: c.colunaTabela, colunas: [c.coluna], chave });
    }
  }
  return res;
}
