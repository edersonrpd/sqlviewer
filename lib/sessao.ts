import { PERFIS } from "@/config/perfis";
import { layoutColunas, type Aba, type Estado, type Visao } from "./estado";
import { listaOrdenacao, type FiltroRelacao } from "./filtragem";
import { sugerirGrafico, type ConfigGrafico } from "./graficos";
import { buscarPerfil, detectarPerfil } from "./perfis";
import type { Aviso, Coluna, ResultadoParse, TipoColuna, Valor } from "./tipos";

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

const TIPOS: readonly TipoColuna[] = ["inteiro", "decimal", "data", "hora", "datahora", "texto"];
const VISOES: readonly Visao[] = ["tela", "tabela", "graficos"];

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Uma aba do arquivo, conferida campo a campo: os dados precisam existir; o layout
 * (ordem, colunas visíveis, filtros, seleção…) que não bater com os dados — arquivo
 * editado à mão, cortado ou de outra versão — volta ao padrão em vez de quebrar a tela.
 */
function normalizarAba(bruta: unknown, k: number): Aba {
  const a = objeto(bruta);
  const d = objeto(a.dados);
  if (!Array.isArray(d.colunas) || !Array.isArray(d.linhas)) throw new Error(`Aba ${k + 1} da sessão está incompleta.`);

  const colunas: Coluna[] = d.colunas.map((c, j) => {
    const o = objeto(c);
    const nome = typeof o.nome === "string" && o.nome !== "" ? o.nome : `(coluna ${j + 1})`;
    return {
      nome,
      original: typeof o.original === "string" ? o.original : nome,
      tipo: TIPOS.includes(o.tipo as TipoColuna) ? (o.tipo as TipoColuna) : "texto",
      casas: Number.isInteger(o.casas) && (o.casas as number) >= 0 ? (o.casas as number) : 0,
    };
  });
  const n = colunas.length;
  const linhas: Valor[][] = d.linhas.map((l) => {
    const campos = lista(l);
    return Array.from({ length: n }, (_, j): Valor => {
      const v = campos[j];
      return v === null || v === undefined ? null : typeof v === "string" ? v : String(v);
    });
  });
  const avisos = lista(d.avisos).filter((x): x is Aviso => typeof objeto(x).mensagem === "string" && typeof objeto(x).tipo === "string");
  const dados: ResultadoParse = { colunas, linhas, avisos };

  const coluna = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const linha = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < linhas.length;

  // a detecção é refeita: os perfis podem ter mudado desde que a sessão foi salva
  const deteccao = detectarPerfil(colunas.map((c) => c.nome), PERFIS);
  const perfilId = typeof a.perfilId === "string" && buscarPerfil(a.perfilId) ? a.perfilId : null;
  const padrao = layoutColunas(dados, buscarPerfil(perfilId));

  const ordemLida = lista(a.ordem);
  const ordemValida = ordemLida.length === n && new Set(ordemLida).size === n && ordemLida.every(coluna);
  const visiveisLidas = lista(a.visiveis);
  const largurasLidas = lista(a.larguras);
  const grafico = objeto(a.grafico);
  const graficoValido =
    (grafico.modo === "contagem" || grafico.modo === "soma") &&
    (grafico.categoria === null || coluna(grafico.categoria)) &&
    (grafico.valor === null || coluna(grafico.valor));

  const filtros: Aba["filtros"] = {};
  for (const [j, t] of Object.entries(objeto(a.filtros))) if (coluna(Number(j)) && typeof t === "string") filtros[Number(j)] = t;
  const filtrosValores: Aba["filtrosValores"] = {};
  for (const [j, vs] of Object.entries(objeto(a.filtrosValores))) {
    if (coluna(Number(j)) && Array.isArray(vs)) filtrosValores[Number(j)] = vs.filter((x): x is string => typeof x === "string");
  }

  return {
    id: typeof a.id === "string" ? a.id : `sessao-${k + 1}`,
    nome: typeof a.nome === "string" && a.nome.trim() ? a.nome : `Consulta ${k + 1}`,
    dados,
    deteccao,
    perfilId,
    ordem: ordemValida ? (ordemLida as number[]) : padrao.ordem,
    visiveis: visiveisLidas.length === n ? visiveisLidas.map(Boolean) : padrao.visiveis,
    fixas: [...new Set(lista(a.fixas).filter(coluna))],
    larguras: Array.from({ length: n }, (_, j) => {
      const w = largurasLidas[j];
      return typeof w === "number" && Number.isFinite(w) ? Math.min(2000, Math.max(40, w)) : 140;
    }),
    busca: typeof a.busca === "string" ? a.busca : "",
    filtros,
    filtrosValores,
    relacoes: lista(a.relacoes).filter((r): r is FiltroRelacao => {
      const o = objeto(r);
      const extras = o.extras === undefined ? [] : o.extras;
      return (
        coluna(o.coluna) &&
        typeof o.valor === "string" &&
        typeof o.rotulo === "string" &&
        Array.isArray(extras) &&
        extras.every((e) => coluna(objeto(e).coluna) && (objeto(e).valor === null || typeof objeto(e).valor === "string"))
      );
    }),
    // aceita o formato antigo (um critério só, ou null)
    ordenacao: listaOrdenacao(a.ordenacao as Aba["ordenacao"] | null)
      .filter((o) => coluna(objeto(o).coluna))
      .map((o) => ({ coluna: o.coluna, desc: !!o.desc })),
    transposta: a.transposta === true,
    selecionadas: new Set(lista(a.selecionadas).filter(linha)),
    grafico: graficoValido ? (grafico as ConfigGrafico) : sugerirGrafico(dados, buscarPerfil(perfilId)),
    visao: VISOES.includes(a.visao as Visao) ? (a.visao as Visao) : "tabela",
    registro: linha(a.registro) ? a.registro : null,
    registroTela: linha(a.registroTela) ? a.registroTela : null,
    ...(typeof a.procedure === "string" ? { procedure: a.procedure } : {}),
  };
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
  const abas = arq.abas.map((a, k) => normalizarAba(a, k));
  return { abas, ativa: arq.ativa ?? null, salvoEm: arq.salvoEm ?? "" };
}

export function nomeArquivoSessao(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `sqlviewer-sessao-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.json`;
}

/**
 * Nome digitado para o arquivo da sessão: sem caracteres inválidos em nome de arquivo,
 * sempre terminando em .json; vazio = nome padrão com data e hora.
 */
export function nomeArquivoEscolhido(texto: string, agora = new Date()): string {
  const base = texto
    .trim()
    .replace(/\.json$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");
  return base ? `${base}.json` : nomeArquivoSessao(agora);
}
