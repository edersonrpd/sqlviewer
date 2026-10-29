import type { Aba } from "./estado";
import { chaveRelacao, ligacoesDoPerfil, linhasLigadas } from "./perfis";

export type Relacionado = {
  rotulo: string;
  abaId: string;
  abaNome: string;
  /** coluna da aba destino usada no filtro */
  colunaDestino: number;
  colunaDestinoNome: string;
  /** chave normalizada (raw com trim); null quando o registro não tem chave */
  chave: string | null;
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
      res.push({
        rotulo: destinos.length > 1 ? `${lig.rotulo} — ${destino.nome}` : lig.rotulo,
        abaId: destino.id,
        abaNome: destino.nome,
        colunaDestino: jDestino,
        colunaDestinoNome: lig.colunaDestino,
        chave: chaveRelacao(valor),
        quantidade: linhasLigadas(valor, destino.dados.linhas, jDestino).length,
      });
    }
  }
  return res;
}
