import { PERFIS, type Perfil } from "@/config/perfis";
import type { FiltroRelacao, Ordenacao } from "./filtragem";
import { formatarValor } from "./formatacao";
import { sugerirGrafico, type ConfigGrafico } from "./graficos";
import { colunaDestaque } from "./destaque";
import { buscarPerfil, detectarPerfil, type Deteccao } from "./perfis";
import type { ResultadoParse } from "./tipos";

export type Visao = "tela" | "tabela" | "graficos";

export type Aba = {
  id: string;
  nome: string;
  dados: ResultadoParse;
  deteccao: Deteccao;
  /** perfil em uso (sugerido pela detecção ou escolhido no select); null = genérica */
  perfilId: string | null;
  /** ordem das colunas (índices em dados.colunas) */
  ordem: number[];
  visiveis: boolean[];
  /** colunas fixadas à esquerda, nesta ordem */
  fixas: number[];
  larguras: number[];
  busca: string;
  filtros: Record<number, string>;
  relacoes: FiltroRelacao[];
  ordenacao: Ordenacao;
  selecionadas: ReadonlySet<number>;
  grafico: ConfigGrafico;
  visao: Visao;
  /** linha aberta na ficha do registro */
  registro: number | null;
  /** linha exibida na visão Tela (null = primeira do filtro) */
  registroTela: number | null;
};

export type Estado = {
  abas: Aba[];
  /** null = área de colar uma nova consulta */
  ativa: string | null;
  contadores: Record<string, number>;
  proximoId: number;
};

export const estadoInicial: Estado = { abas: [], ativa: null, contadores: {}, proximoId: 1 };

export type Acao =
  | { tipo: "criar"; dados: ResultadoParse }
  /** várias abas de uma vez (ex.: resultado de JOIN separado); ativa a primeira */
  | { tipo: "criarVarias"; dados: ResultadoParse[] }
  | { tipo: "fechar"; id: string }
  | { tipo: "ativar"; id: string | null }
  | { tipo: "renomear"; id: string; nome: string }
  | { tipo: "atualizar"; id: string; patch: Partial<Omit<Aba, "id" | "dados">> }
  | { tipo: "trocarPerfil"; id: string; perfilId: string | null }
  | { tipo: "abrirRelacao"; destino: string; coluna: number; valor: string; rotulo: string };

const CHAVE_GENERICA = "__generica__";

/** Colunas visíveis, ordem e fixas iniciais de acordo com o perfil (colunas ausentes são ignoradas). */
export function layoutColunas(dados: ResultadoParse, perfil?: Perfil): Pick<Aba, "ordem" | "visiveis" | "fixas"> {
  const n = dados.colunas.length;
  const porNome = new Map(dados.colunas.map((c, j) => [c.nome, j]));
  const natural = Array.from({ length: n }, (_, j) => j);
  const padrao = (perfil?.colunasPadrao ?? []).map((c) => porNome.get(c)).filter((j): j is number => j !== undefined);
  const fixas = (perfil?.colunasFixas ?? []).map((c) => porNome.get(c)).filter((j): j is number => j !== undefined);
  // a coluna destacada (ex.: NUMPOK) fica sempre visível e fixada
  const destaque = colunaDestaque(dados.colunas, perfil);
  if (destaque && !fixas.includes(destaque.j)) fixas.push(destaque.j);
  if (padrao.length === 0) {
    return { ordem: natural, visiveis: Array(n).fill(true), fixas };
  }
  const visiveis = Array<boolean>(n).fill(false);
  for (const j of [...padrao, ...fixas]) visiveis[j] = true;
  const emPadrao = new Set(padrao);
  return { ordem: [...padrao, ...natural.filter((j) => !emPadrao.has(j))], visiveis, fixas };
}

/** Largura inicial de cada coluna a partir do nome e de uma amostra dos valores. */
function calcularLarguras(dados: ResultadoParse): number[] {
  const amostra = dados.linhas.slice(0, 300);
  return dados.colunas.map((c, j) => {
    let max = c.nome.length + 3;
    for (const l of amostra) {
      const v = l[j];
      const len = v === null ? 4 : formatarValor(v, c.tipo).length;
      if (len > max) max = len;
    }
    return Math.round(Math.min(360, Math.max(72, max * 8.4 + 24)));
  });
}

/** Colunas exibidas na tabela e usadas nas saídas: fixas primeiro, depois as demais visíveis. */
export function colunasExibidas(aba: Pick<Aba, "ordem" | "visiveis" | "fixas">): number[] {
  const fixas = aba.fixas.filter((j) => aba.visiveis[j]);
  const set = new Set(fixas);
  return [...fixas, ...aba.ordem.filter((j) => aba.visiveis[j] && !set.has(j))];
}

function perfilDaDeteccao(d: Deteccao): string | null {
  return d.tipo === "perfil" ? d.perfil.id : null;
}

function atualizarAba(estado: Estado, id: string, f: (a: Aba) => Aba): Estado {
  return { ...estado, abas: estado.abas.map((a) => (a.id === id ? f(a) : a)) };
}

export function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case "criar": {
      const { dados } = acao;
      const deteccao = detectarPerfil(dados.colunas.map((c) => c.nome), PERFIS);
      const perfilId = perfilDaDeteccao(deteccao);
      const perfil = buscarPerfil(perfilId);
      const chave = perfilId ?? CHAVE_GENERICA;
      const k = (estado.contadores[chave] ?? 0) + 1;
      const nome = perfilId ? (k === 1 ? perfilId : `${perfilId} ${k}`) : `Consulta ${k}`;
      const id = `aba-${estado.proximoId}`;
      const aba: Aba = {
        id,
        nome,
        dados,
        deteccao,
        perfilId,
        ...layoutColunas(dados, perfil),
        larguras: calcularLarguras(dados),
        busca: "",
        filtros: {},
        relacoes: [],
        ordenacao: null,
        selecionadas: new Set(),
        grafico: sugerirGrafico(dados, perfil),
        // perfis com layout de tela abrem como formulário; os demais como tabela
        visao: perfil?.tela ? "tela" : "tabela",
        registro: null,
        registroTela: null,
      };
      return {
        abas: [...estado.abas, aba],
        ativa: id,
        contadores: { ...estado.contadores, [chave]: k },
        proximoId: estado.proximoId + 1,
      };
    }
    case "criarVarias": {
      if (acao.dados.length === 0) return estado;
      const primeiro = `aba-${estado.proximoId}`;
      const novo = acao.dados.reduce((e, dados) => reducer(e, { tipo: "criar", dados }), estado);
      return { ...novo, ativa: primeiro };
    }
    case "fechar": {
      const pos = estado.abas.findIndex((a) => a.id === acao.id);
      if (pos < 0) return estado;
      const abas = estado.abas.filter((a) => a.id !== acao.id);
      let ativa = estado.ativa;
      if (ativa === acao.id) ativa = abas.length ? abas[Math.min(pos, abas.length - 1)].id : null;
      return { ...estado, abas, ativa };
    }
    case "ativar":
      return { ...estado, ativa: acao.id };
    case "renomear": {
      const nome = acao.nome.trim();
      return nome ? atualizarAba(estado, acao.id, (a) => ({ ...a, nome })) : estado;
    }
    case "atualizar":
      return atualizarAba(estado, acao.id, (a) => ({ ...a, ...acao.patch }));
    case "trocarPerfil":
      return atualizarAba(estado, acao.id, (a) => {
        const perfil = buscarPerfil(acao.perfilId);
        return {
          ...a,
          perfilId: perfil ? perfil.id : null,
          ...layoutColunas(a.dados, perfil),
          grafico: sugerirGrafico(a.dados, perfil),
        };
      });
    case "abrirRelacao": {
      const s = atualizarAba(estado, acao.destino, (a) => ({
        ...a,
        relacoes: [{ coluna: acao.coluna, valor: acao.valor, rotulo: acao.rotulo }],
        visao: a.visao === "graficos" ? "tabela" : a.visao,
        registro: null,
        registroTela: null,
      }));
      return { ...s, ativa: acao.destino };
    }
  }
}
