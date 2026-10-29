/**
 * Perfis de tabela: camada opcional de conveniência.
 *
 * A aplicação funciona com qualquer resultado; um perfil só ajusta as colunas
 * visíveis por padrão, as colunas fixas, o título da ficha, o gráfico inicial e
 * os atalhos de relacionamento entre abas e a "Tela" (visão de formulário, como
 * a tela do ERP). Veja o README para adicionar um novo.
 */

/** Como o valor aparece na Tela. Sem formato, segue o tipo detectado da coluna. */
export type FormatoCampo = "moeda" | "percentual";

export type CorStatus = "verde" | "amarelo" | "vermelho" | "azul" | "cinza";

export type CampoTela = {
  coluna: string;
  rotulo: string;
  formato?: FormatoCampo;
  /** coluna de hora exibida junto (ex.: data + hora de entrada) */
  hora?: string;
  /** tradução de valores (ex.: { S: "Sim", N: "Não" }) */
  valores?: Record<string, string>;
  /** ocupa 2 colunas do formulário (textos longos) */
  largo?: boolean;
};

export type StatusTela = {
  coluna: string;
  rotulo: string;
  /** texto e cor por valor; valores não listados aparecem em cinza, como vieram */
  valores?: Record<string, { texto: string; cor: CorStatus }>;
};

export type SecaoTela = { titulo: string; campos: CampoTela[] };

export type Tela = {
  /** ex.: "Pedido" — exibido antes do valor de colunaTitulo */
  titulo?: string;
  /** colunas exibidas abaixo do título */
  subtitulo?: CampoTela[];
  status?: StatusTela[];
  /** cartões de destaque (valores principais) */
  destaques?: CampoTela[];
  secoes: SecaoTela[];
};

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
  /** nome da tabela no banco, usado no SQL sugerido (padrão: o id) */
  tabela?: string;
  /** colunas somadas no rodapé quando esta tabela aparece como grade em outra Tela
      (padrão: todas as colunas decimais) */
  totais?: string[];
  /** layout da visão "Tela"; colunas não citadas vão para "Outros campos" */
  tela?: Tela;
};

const SIM_NAO = { S: "Sim", N: "Não" };

/* Rótulos da FATGOR: ponto de partida a revisar pela equipe. O nome técnico da
   coluna aparece ao lado de cada rótulo na Tela. */
const TELA_FATGOR: Tela = {
  titulo: "Pedido",
  subtitulo: [
    { coluna: "FGO_CODEMP", rotulo: "Empresa" },
    { coluna: "FGO_ESPDOC", rotulo: "Espécie" },
    { coluna: "FGO_DTAENT", rotulo: "Entrada", hora: "FGO_HORENT" },
    { coluna: "FGO_ORIGEM", rotulo: "Origem" },
  ],
  status: [
    { coluna: "FGO_JAFATU", rotulo: "Já faturado" },
    { coluna: "FGO_LIBERA", rotulo: "Liberação" },
    { coluna: "FGO_LIBCOM", rotulo: "Lib. comercial" },
    { coluna: "FGO_PEDSIT", rotulo: "Situação" },
    { coluna: "FGO_CORTPD", rotulo: "Corte", valores: { S: { texto: "Sim", cor: "amarelo" }, N: { texto: "Não", cor: "cinza" } } },
  ],
  destaques: [
    { coluna: "FGO_VLRCON", rotulo: "Valor contábil", formato: "moeda" },
    { coluna: "FGO_TOTPRO", rotulo: "Total de produtos", formato: "moeda" },
    { coluna: "FGO_TOTICM", rotulo: "ICMS", formato: "moeda" },
    { coluna: "FGO_TOTFRE", rotulo: "Frete", formato: "moeda" },
  ],
  secoes: [
    {
      titulo: "Identificação",
      campos: [
        { coluna: "FGO_NUMDOC", rotulo: "Nº documento" },
        { coluna: "AUTOINCREM", rotulo: "Sequência (AUTOINCREM)" },
        { coluna: "FGO_CODEMP", rotulo: "Empresa" },
        { coluna: "FGO_ESPDOC", rotulo: "Espécie" },
        { coluna: "FGO_SERIE_", rotulo: "Série" },
        { coluna: "FGO_DTAENT", rotulo: "Entrada", hora: "FGO_HORENT" },
        { coluna: "FGO_NUMPOK", rotulo: "Nº pedido HUB" },
        { coluna: "FGO_TIPPED", rotulo: "Tipo de pedido" },
        { coluna: "FGO_TIPOPE", rotulo: "Tipo de operação" },
        { coluna: "FGO_TABPRE", rotulo: "Tabela de preço" },
        { coluna: "FGO_ORIGEM", rotulo: "Origem" },
      ],
    },
    {
      titulo: "Cliente e vendedor",
      campos: [
        { coluna: "FGO_CODCLI", rotulo: "Cliente" },
        { coluna: "FGO_CGCCPF", rotulo: "CPF/CNPJ" },
        { coluna: "FGO_ESTADO", rotulo: "UF" },
        { coluna: "FGO_CODVEN", rotulo: "Vendedor" },
        { coluna: "FGO_CODTRA", rotulo: "Transportadora" },
        { coluna: "FGO_CODDIG", rotulo: "Digitador" },
      ],
    },
    {
      titulo: "Consumidor",
      campos: [
        { coluna: "FGO_NOMCON", rotulo: "Nome", largo: true },
        { coluna: "FGO_CGCCON", rotulo: "CPF/CNPJ" },
        { coluna: "FGO_IESCON", rotulo: "Inscrição estadual" },
        { coluna: "FGO_ENDCON", rotulo: "Endereço", largo: true },
        { coluna: "FGO_BAICON", rotulo: "Bairro" },
        { coluna: "FGO_CIDCON", rotulo: "Cidade" },
        { coluna: "FGO_ESTCON", rotulo: "UF" },
        { coluna: "FGO_CEPCON", rotulo: "CEP" },
        { coluna: "FGO_TELCON", rotulo: "Telefone" },
        { coluna: "FGO_EMLCON", rotulo: "E-mail", largo: true },
      ],
    },
    {
      titulo: "Valores",
      campos: [
        { coluna: "FGO_VLRCON", rotulo: "Valor contábil", formato: "moeda" },
        { coluna: "FGO_TOTPRO", rotulo: "Total de produtos", formato: "moeda" },
        { coluna: "FGO_TOTSER", rotulo: "Total de serviços", formato: "moeda" },
        { coluna: "FGO_TOTFRE", rotulo: "Frete", formato: "moeda" },
        { coluna: "FGO_SEGURO", rotulo: "Seguro", formato: "moeda" },
        { coluna: "FGO_DESACE", rotulo: "Despesas acessórias", formato: "moeda" },
        { coluna: "FGO_DESESP", rotulo: "Desconto especial", formato: "moeda" },
        { coluna: "FGO_DESCON", rotulo: "Desconto", formato: "moeda" },
        { coluna: "FGO_PORDES", rotulo: "% desconto", formato: "percentual" },
        { coluna: "FGO_DESFIN", rotulo: "Desconto financeiro", formato: "moeda" },
        { coluna: "FGO_TOTCUS", rotulo: "Custo total", formato: "moeda" },
        { coluna: "FGO_TOTMED", rotulo: "Custo médio", formato: "moeda" },
        { coluna: "FGO_MARGEM", rotulo: "Margem" },
      ],
    },
    {
      titulo: "Impostos",
      campos: [
        { coluna: "FGO_BASICM", rotulo: "Base ICMS", formato: "moeda" },
        { coluna: "FGO_ALQICM", rotulo: "Alíquota ICMS", formato: "percentual" },
        { coluna: "FGO_TOTICM", rotulo: "Valor ICMS", formato: "moeda" },
        { coluna: "FGO_BASIPI", rotulo: "Base IPI", formato: "moeda" },
        { coluna: "FGO_ALQIPI", rotulo: "Alíquota IPI", formato: "percentual" },
        { coluna: "FGO_TOTIPI", rotulo: "Valor IPI", formato: "moeda" },
        { coluna: "FGO_BASRET", rotulo: "Base ST", formato: "moeda" },
        { coluna: "FGO_ALQRET", rotulo: "Alíquota ST", formato: "percentual" },
        { coluna: "FGO_TOTRET", rotulo: "Valor ST", formato: "moeda" },
        { coluna: "FGO_BASSIM", rotulo: "Base Simples", formato: "moeda" },
        { coluna: "FGO_PERISS", rotulo: "% ISS", formato: "percentual" },
        { coluna: "FGO_VALISS", rotulo: "Valor ISS", formato: "moeda" },
      ],
    },
    {
      titulo: "Pagamento",
      campos: [
        { coluna: "FGO_CONPAG", rotulo: "Condição de pagamento" },
        { coluna: "FGO_CODCND", rotulo: "Condição" },
        { coluna: "FGO_CODFPG", rotulo: "Forma de pagamento" },
        { coluna: "FGO_CODFIN", rotulo: "Financeira" },
        { coluna: "FGO_QTDPAR", rotulo: "Parcelas" },
        { coluna: "FGO_VPGANT", rotulo: "Pagamento antecipado", formato: "moeda" },
        ...Array.from({ length: 12 }, (_, k) => ({
          coluna: `FGO_VPAR${String(k + 1).padStart(2, "0")}`,
          rotulo: `Parcela ${k + 1}`,
          formato: "moeda" as const,
        })),
      ],
    },
    {
      titulo: "Faturamento",
      campos: [
        { coluna: "FGO_JAFATU", rotulo: "Já faturado" },
        { coluna: "FGO_TIPFAT", rotulo: "Tipo" },
        { coluna: "FGO_NUMFAT", rotulo: "Nº fatura / NF" },
        { coluna: "FGO_DTAFAT", rotulo: "Data" },
        { coluna: "FGO_VALFAT", rotulo: "Valor faturado", formato: "moeda" },
        { coluna: "FGO_VENFAT", rotulo: "Vendedor (faturamento)" },
        { coluna: "FGO_CNDFAT", rotulo: "Condição (faturamento)" },
        { coluna: "FGO_EMPFAT", rotulo: "Empresa de faturamento" },
        { coluna: "FGO_ENTFAT", rotulo: "Entrega na fatura" },
        { coluna: "FGO_FATNOT", rotulo: "Fatura / nota" },
      ],
    },
    {
      titulo: "Liberação",
      campos: [
        { coluna: "FGO_LIBERA", rotulo: "Liberação" },
        { coluna: "FGO_OPELIB", rotulo: "Operador" },
        { coluna: "FGO_DIGLIB", rotulo: "Digitador" },
        { coluna: "FGO_DTALIB", rotulo: "Data", hora: "FGO_HORLIB" },
        { coluna: "FGO_OBSL01", rotulo: "Observação 1", largo: true },
        { coluna: "FGO_OBSL02", rotulo: "Observação 2", largo: true },
        { coluna: "FGO_LIBCOM", rotulo: "Liberação comercial" },
        { coluna: "FGO_MOTLIB", rotulo: "Motivo" },
        { coluna: "FGO_OPELIC", rotulo: "Operador (comercial)" },
        { coluna: "FGO_DIGLIC", rotulo: "Digitador (comercial)" },
        { coluna: "FGO_DTALIC", rotulo: "Data (comercial)", hora: "FGO_HORLIC" },
        { coluna: "FGO_OBSLC1", rotulo: "Observação comercial 1", largo: true },
        { coluna: "FGO_OBSLC2", rotulo: "Observação comercial 2", largo: true },
      ],
    },
    {
      titulo: "Entrega e transporte",
      campos: [
        { coluna: "FGO_TIPFRE", rotulo: "Tipo de frete" },
        { coluna: "FGO_PRAENT", rotulo: "Prazo de entrega" },
        { coluna: "FGO_DTENTR", rotulo: "Data de entrega" },
        { coluna: "FGO_PREVIS", rotulo: "Previsão", hora: "FGO_HPREVI" },
        { coluna: "FGO_PESBRU", rotulo: "Peso bruto" },
        { coluna: "FGO_PESLIQ", rotulo: "Peso líquido" },
        { coluna: "FGO_VOLUME", rotulo: "Volumes" },
        { coluna: "FGO_ESPECI", rotulo: "Espécie (volumes)" },
        { coluna: "FGO_MARCA_", rotulo: "Marca" },
        { coluna: "FGO_ENTFUT", rotulo: "Entrega futura", valores: SIM_NAO },
        { coluna: "FGO_ENT_CD", rotulo: "Entrega pelo CD", valores: SIM_NAO },
        { coluna: "FGO_ENDETR", rotulo: "Endereço de entrega", largo: true },
        { coluna: "FGO_BAIETR", rotulo: "Bairro" },
        { coluna: "FGO_CIDETR", rotulo: "Cidade" },
        { coluna: "FGO_ESTETR", rotulo: "UF" },
        { coluna: "FGO_CEPETR", rotulo: "CEP" },
        { coluna: "FGO_DTAETR", rotulo: "Data (entrega)", hora: "FGO_HORETR" },
      ],
    },
    {
      titulo: "Romaneio",
      campos: [
        { coluna: "FGO_NUMROM", rotulo: "Nº romaneio" },
        { coluna: "FGO_DTAROM", rotulo: "Data", hora: "FGO_HORROM" },
        { coluna: "FGO_OPEROM", rotulo: "Operador" },
        { coluna: "FGO_VALROM", rotulo: "Valor", formato: "moeda" },
        { coluna: "FGO_EMPROM", rotulo: "Empresa" },
        { coluna: "FGO_ROMIMP", rotulo: "Impresso", valores: SIM_NAO },
      ],
    },
    {
      titulo: "Mensagens e observações",
      campos: [
        { coluna: "FGO_MOTBAI", rotulo: "Motivo da baixa", largo: true },
        { coluna: "FGO_MEN001", rotulo: "Mensagem 1", largo: true },
        { coluna: "FGO_MEN002", rotulo: "Mensagem 2", largo: true },
        { coluna: "FGO_MENEXP", rotulo: "Mensagem expedição 1", largo: true },
        { coluna: "FGO_MENEX2", rotulo: "Mensagem expedição 2", largo: true },
        { coluna: "FGO_MENEX3", rotulo: "Mensagem expedição 3", largo: true },
        { coluna: "FGO_MENEX4", rotulo: "Mensagem expedição 4", largo: true },
      ],
    },
    {
      titulo: "Situação e controle",
      campos: [
        { coluna: "FGO_PEDSIT", rotulo: "Situação do pedido" },
        { coluna: "FGO_FATSIT", rotulo: "Situação do faturamento" },
        { coluna: "FGO_FPGSIT", rotulo: "Situação do pagamento" },
        { coluna: "FGO_STASIT", rotulo: "Status" },
        { coluna: "FGO_ULTALT", rotulo: "Última alteração" },
        { coluna: "FGO_DTAORI", rotulo: "Data original" },
        { coluna: "FGO_NTRAVA", rotulo: "Não travar" },
      ],
    },
  ],
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
    tela: TELA_FATGOR,
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
    totais: ["FDO_QTDITE", "FDO_TOTITE"],
    graficoSugerido: { modo: "soma", categoria: "FDO_CODITE", valor: "FDO_TOTITE" },
    tela: {
      titulo: "Item",
      destaques: [
        { coluna: "FDO_QTDITE", rotulo: "Quantidade" },
        { coluna: "FDO_UNITAR", rotulo: "Valor unitário", formato: "moeda" },
        { coluna: "FDO_TOTITE", rotulo: "Total do item", formato: "moeda" },
      ],
      secoes: [
        {
          titulo: "Item",
          campos: [
            { coluna: "FDO_CODITE", rotulo: "Código do item" },
            { coluna: "FDO_SEQGER", rotulo: "Pedido (AUTOINCREM)" },
            { coluna: "FDO_QTDITE", rotulo: "Quantidade" },
            { coluna: "FDO_UNITAR", rotulo: "Valor unitário", formato: "moeda" },
            { coluna: "FDO_TOTITE", rotulo: "Total do item", formato: "moeda" },
          ],
        },
      ],
    },
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
