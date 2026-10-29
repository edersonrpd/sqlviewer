import { DESTAQUES_GLOBAIS, type Perfil } from "@/config/perfis";
import type { Coluna } from "./tipos";

export type ColunaDestaque = { j: number; nome: string; rotulo: string };

/**
 * Coluna-chave destacada nas visões (ex.: NUMPOK). Usa a do perfil quando ela
 * existe no resultado; senão, a primeira coluna que casar com DESTAQUES_GLOBAIS.
 */
export function colunaDestaque(colunas: Coluna[], perfil?: Perfil): ColunaDestaque | null {
  if (perfil?.destaque) {
    const j = colunas.findIndex((c) => c.nome === perfil.destaque!.coluna);
    if (j >= 0) return { j, nome: colunas[j].nome, rotulo: perfil.destaque.rotulo };
  }
  for (const g of DESTAQUES_GLOBAIS) {
    const j = colunas.findIndex((c) => g.padrao.test(c.nome));
    if (j >= 0) return { j, nome: colunas[j].nome, rotulo: g.rotulo };
  }
  return null;
}
