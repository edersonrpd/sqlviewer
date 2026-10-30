import type { Perfil } from "@/config/perfis";
import type { ResultadoParse, Valor } from "./tipos";

export type Diferenca = {
  j: number;
  nome: string;
  /** rótulo da Tela do perfil, quando a coluna tem um */
  rotulo: string | null;
  a: Valor;
  b: Valor;
  igual: boolean;
};

/** Rótulos da Tela do perfil por coluna (o primeiro que aparecer). */
function rotulosDoPerfil(perfil?: Perfil): Map<string, string> {
  const m = new Map<string, string>();
  const t = perfil?.tela;
  if (!t) return m;
  for (const c of [...(t.destaques ?? []), ...(t.indicadores ?? []), ...t.secoes.flatMap((s) => s.campos)]) {
    if (!m.has(c.coluna)) m.set(c.coluna, c.rotulo);
  }
  return m;
}

/**
 * Compara dois registros coluna a coluna, na ordem das colunas do resultado.
 * Valores são comparados como texto (com trim); NULL só é igual a NULL.
 */
export function compararRegistros(dados: ResultadoParse, a: number, b: number, perfil?: Perfil): Diferenca[] {
  const rotulos = rotulosDoPerfil(perfil);
  const la = dados.linhas[a] ?? [];
  const lb = dados.linhas[b] ?? [];
  return dados.colunas.map((c, j) => {
    const va = la[j] ?? null;
    const vb = lb[j] ?? null;
    const igual = va === null || vb === null ? va === vb : va.trim() === vb.trim();
    return { j, nome: c.nome, rotulo: rotulos.get(c.nome) ?? null, a: va, b: vb, igual };
  });
}
