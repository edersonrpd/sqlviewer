import { PERFIS } from "@/config/perfis";
import type { Aba, Estado } from "./estado";
import { listaOrdenacao } from "./filtragem";
import { buscarPerfil, detectarPerfil } from "./perfis";

/**
 * Sessão salva em arquivo: as abas abertas, com os dados e o layout de cada uma.
 * Nada é guardado no navegador; o arquivo fica com quem baixou.
 */

const APP = "sql-viewer";
const VERSAO = 1;

type AbaSalva = Omit<Aba, "deteccao" | "selecionadas"> & { selecionadas: number[] };
type ArquivoSessao = { app: string; versao: number; salvoEm: string; ativa: string | null; abas: AbaSalva[] };

export function serializarSessao(estado: Pick<Estado, "abas" | "ativa">, agora = new Date()): string {
  const abas: AbaSalva[] = estado.abas.map((a) => {
    const { deteccao: _d, selecionadas, ...resto } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { ...resto, selecionadas: [...selecionadas] };
  });
  const arquivo: ArquivoSessao = { app: APP, versao: VERSAO, salvoEm: agora.toISOString(), ativa: estado.ativa, abas };
  return JSON.stringify(arquivo);
}

export type SessaoLida = { abas: Aba[]; ativa: string | null; salvoEm: string };

/** Lê o arquivo de sessão. Lança um Error com mensagem para o usuário se o arquivo não servir. */
export function lerSessao(texto: string): SessaoLida {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é uma sessão do SQL Viewer (JSON inválido).");
  }
  const arq = bruto as Partial<ArquivoSessao>;
  if (!arq || arq.app !== APP || !Array.isArray(arq.abas)) throw new Error("O arquivo não é uma sessão do SQL Viewer.");
  if ((arq.versao ?? 0) > VERSAO) throw new Error("Sessão salva por uma versão mais nova do SQL Viewer.");
  const abas = arq.abas.map((a, k): Aba => {
    if (!a?.dados || !Array.isArray(a.dados.colunas) || !Array.isArray(a.dados.linhas)) {
      throw new Error(`Aba ${k + 1} da sessão está incompleta.`);
    }
    // a detecção é refeita: os perfis podem ter mudado desde que a sessão foi salva
    const deteccao = detectarPerfil(a.dados.colunas.map((c) => c.nome), PERFIS);
    return {
      ...a,
      // sessões salvas antes destes campos existirem
      ordenacao: listaOrdenacao(a.ordenacao as Aba["ordenacao"] | null),
      filtrosValores: a.filtrosValores ?? {},
      transposta: a.transposta ?? false,
      perfilId: buscarPerfil(a.perfilId) ? a.perfilId : null,
      deteccao,
      selecionadas: new Set(a.selecionadas ?? []),
    };
  });
  return { abas, ativa: arq.ativa ?? null, salvoEm: arq.salvoEm ?? "" };
}

export function nomeArquivoSessao(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `sqlviewer-sessao-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.json`;
}
