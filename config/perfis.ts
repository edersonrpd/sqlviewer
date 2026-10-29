/**
 * Perfis de tabela: camada opcional de conveniência.
 *
 * A aplicação funciona com qualquer resultado; um perfil só ajusta as colunas
 * visíveis por padrão, as colunas fixas, o título da ficha, o gráfico inicial e
 * os atalhos de relacionamento entre abas. Veja o README para adicionar um novo.
 */

export type Relacao = {
  /** id do perfil da outra tabela */
  perfil: string;
  /** coluna deste perfil */
  colunaOrigem: string;
  /** coluna do perfil de destino */
  colunaDestino: string;
  /** texto exibido na ficha do registro */
  rotulo: string;
};

export type Perfil = {
  id: string;
  nome: string;
  /** colunas que precisam existir no resultado para reconhecer a tabela */
  assinatura: string[];
  /** visíveis por padrão, nesta ordem (as demais começam ocultas) */
  colunasPadrao?: string[];
  /** fixadas à esquerda */
  colunasFixas?: string[];
  /** usada como título da ficha do registro */
  colunaTitulo?: string;
  graficoSugerido?: { modo: "contagem" | "soma"; categoria: string; valor?: string };
  relacoes?: Relacao[];
  /**
   * Rótulo da relação quando vista a partir do perfil de destino
   * (ex.: na ficha de um item da FATDOR, "Pedido (cabeçalho)").
   * Chave = id do perfil que declarou a relação.
   */
  rotulosInversos?: Record<string, string>;
};

export const PERFIS: Perfil[] = [
  {
    id: "FATGOR",
    nome: "Pedidos – cabeçalho",
    assinatura: ["AUTOINCREM", "FGO_NUMDOC", "FGO_ESPDOC", "FGO_JAFATU"],
    colunasPadrao: [
      "AUTOINCREM", "FGO_CODEMP", "FGO_NUMDOC", "FGO_NUMPOK", "FGO_DTAENT", "FGO_HORENT",
      "FGO_CODCLI", "FGO_CODVEN", "FGO_ESTADO", "FGO_VLRCON", "FGO_JAFATU", "FGO_NUMFAT",
      "FGO_LIBERA", "FGO_LIBCOM",
    ],
    colunasFixas: ["FGO_NUMDOC"],
    colunaTitulo: "FGO_NUMDOC",
    graficoSugerido: { modo: "soma", categoria: "FGO_CODVEN", valor: "FGO_VLRCON" },
    relacoes: [
      { perfil: "FATDOR", colunaOrigem: "AUTOINCREM", colunaDestino: "FDO_SEQGER", rotulo: "Itens do pedido" },
      { perfil: "EXTGOR", colunaOrigem: "AUTOINCREM", colunaDestino: "FGO_SEQFGO", rotulo: "Extensão do pedido" },
      { perfil: "MOVCAR", colunaOrigem: "FGO_NUMPOK", colunaDestino: "MCA_NUMPOK", rotulo: "Movimentação de cartões" },
      { perfil: "HUBCIT_INFPED", colunaOrigem: "FGO_NUMPOK", colunaDestino: "INF_NUMPOK", rotulo: "Dados do pedido no HUB" },
    ],
  },
  {
    id: "FATDOR",
    nome: "Pedidos – itens",
    assinatura: ["FDO_SEQGER", "FDO_CODITE"],
    colunasPadrao: ["FDO_SEQGER", "FDO_CODITE", "FDO_QTDITE", "FDO_UNITAR", "FDO_TOTITE"],
    colunaTitulo: "FDO_CODITE",
    graficoSugerido: { modo: "soma", categoria: "FDO_CODITE", valor: "FDO_TOTITE" },
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
  {
    id: "EXTGOR",
    nome: "Pedidos – extensão",
    assinatura: ["FGO_SEQFGO"],
    colunasPadrao: ["FGO_SEQFGO", "FGO_EMPEXP", "FGO_DTCOAG", "FGO_CANHUB"],
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
  {
    id: "MOVCAR",
    nome: "Movimentação de cartões",
    assinatura: ["MCA_NUMPOK"],
    colunasPadrao: ["MCA_NUMPOK", "MCA_VALTAX", "MCA_HIST01"],
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
  {
    id: "HUBCIT_INFPED",
    nome: "Pedidos no HUB",
    assinatura: ["INF_NUMPOK"],
    colunasPadrao: ["INF_NUMPOK", "INF_VALTAX"],
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
];
