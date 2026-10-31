/**
 * Perfis de tabela: camada opcional de conveniência.
 *
 * A aplicação funciona com qualquer resultado; um perfil só ajusta as colunas
 * visíveis por padrão, as colunas fixas, o título da ficha, o gráfico inicial e
 * os atalhos de relacionamento entre abas e a "Tela" (visão de formulário, como
 * a tela do ERP). Veja o README para adicionar um novo.
 */

/** Como o valor aparece na Tela. Sem formato, segue o tipo detectado da coluna. */
export type FormatoCampo = "moeda" | "percentual" | "chaveAcesso";

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

/**
 * Indicador de destaque intermediário (menor que o `destaque` do perfil, maior
 * que um chip de status): valor em evidência com detalhes logo abaixo.
 */
export type IndicadorTela = CampoTela & {
  /** campos exibidos em linha abaixo do valor (ex.: operador e data) */
  detalhes?: CampoTela[];
  /** cor por valor; valores não listados usam `cor` (padrão: azul) */
  cores?: Record<string, CorStatus>;
  cor?: CorStatus;
  /** não exibe o indicador quando o valor está vazio/NULL */
  ocultarVazio?: boolean;
};

export type Tela = {
  /** ex.: "Pedido" — exibido antes do valor de colunaTitulo */
  titulo?: string;
  /** colunas exibidas abaixo do título */
  subtitulo?: CampoTela[];
  status?: StatusTela[];
  /** indicadores em evidência no cabeçalho (ex.: liberações) */
  indicadores?: IndicadorTela[];
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
  /**
   * Outras colunas que também precisam ser iguais (chave composta), ex.: o
   * adiantamento do pedido é o do mesmo nº de documento, espécie e empresa.
   */
  extras?: { origem: string; destino: string }[];
  /** texto exibido na ficha do registro */
  rotulo: string;
};

/**
 * Tabela de cadastro apontada por uma coluna (chave estrangeira), ex.: vendedor
 * em CADOPE. Aparece em "Ver também" só como SELECT individual, fora do JOIN.
 */
export type Cadastro = {
  coluna: string;
  tabela: string;
  colunaTabela: string;
  rotulo: string;
  /** rótulo único quando várias colunas apontam para o mesmo registro (ex.: "Operador") */
  grupo?: string;
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
  /** coluna que identifica um único registro, usada no WHERE do JOIN sugerido (padrão: colunaTitulo) */
  chave?: string;
  /** coluna-chave destacada em todas as visões (ex.: NUMPOK do pedido) */
  destaque?: { coluna: string; rotulo: string };
  graficoSugerido?: { modo: "contagem" | "soma"; categoria: string; valor?: string };
  relacoes?: Relacao[];
  /** cadastros apontados por colunas deste perfil (chaves estrangeiras) */
  cadastros?: Cadastro[];
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
  /**
   * Extrato com créditos e débitos: quando a tabela aparece como grade em outra
   * Tela, o rodapé mostra créditos, débitos e saldo em vez de somar tudo junto.
   */
  saldo?: { valor: string; tipo: string; credito: string[]; debito: string[] };
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
    { coluna: "FGO_CODCLI", rotulo: "Cliente" },
    { coluna: "FGO_DTAENT", rotulo: "Entrada", hora: "FGO_HORENT" },
    { coluna: "FGO_ORIGEM", rotulo: "Origem" },
  ],
  status: [
    { coluna: "FGO_JAFATU", rotulo: "Já faturado" },
    { coluna: "FGO_PEDSIT", rotulo: "Situação" },
    { coluna: "FGO_CORTPD", rotulo: "Corte", valores: { S: { texto: "Sim", cor: "amarelo" }, N: { texto: "Não", cor: "cinza" } } },
  ],
  indicadores: [
    {
      coluna: "FGO_LIBERA",
      rotulo: "Liberação",
      detalhes: [
        { coluna: "FGO_OPELIB", rotulo: "Operador" },
        { coluna: "FGO_DTALIB", rotulo: "Em", hora: "FGO_HORLIB" },
        { coluna: "FGO_MOTLIB", rotulo: "Motivo" },
      ],
    },
    {
      coluna: "FGO_LIBCOM",
      rotulo: "Liberação comercial",
      detalhes: [
        { coluna: "FGO_OPELIC", rotulo: "Operador" },
        { coluna: "FGO_DTALIC", rotulo: "Em", hora: "FGO_HORLIC" },
      ],
    },
    // só aparece quando o pedido foi baixado
    { coluna: "FGO_MOTBAI", rotulo: "Motivo da baixa", cor: "amarelo", ocultarVazio: true, largo: true },
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


/* Rótulos da FATDOR: ponto de partida. Colunas que não vierem no resultado são
   ignoradas; as não citadas vão para "Outros campos". */
const TELA_FATDOR: Tela = {
  titulo: "Item",
  subtitulo: [
    { coluna: "FDO_NUMDOC", rotulo: "Pedido" },
    { coluna: "FDO_CODEMP", rotulo: "Empresa" },
    { coluna: "FDO_CODCLI", rotulo: "Cliente" },
    { coluna: "FDO_CODVEN", rotulo: "Vendedor" },
  ],
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
        { coluna: "FDO_CODMAR", rotulo: "Marca" },
        { coluna: "FDO_CODDIV", rotulo: "Divisão" },
        { coluna: "FDO_NUMLOT", rotulo: "Lote" },
        { coluna: "FDO_QTDITE", rotulo: "Quantidade" },
        { coluna: "FDO_UNITAR", rotulo: "Valor unitário", formato: "moeda" },
        { coluna: "FDO_TOTITE", rotulo: "Total do item", formato: "moeda" },
      ],
    },
    {
      titulo: "Pedido",
      campos: [
        { coluna: "FDO_SEQGER", rotulo: "Pedido (AUTOINCREM da FATGOR)" },
        { coluna: "FDO_NUMDOC", rotulo: "Nº documento" },
        { coluna: "FDO_CODEMP", rotulo: "Empresa" },
        { coluna: "FDO_CODCLI", rotulo: "Cliente" },
        { coluna: "FDO_CODVEN", rotulo: "Vendedor" },
        { coluna: "AUTOINCREM", rotulo: "Sequência do item (AUTOINCREM)" },
      ],
    },
  ],
};

/* Rótulos da CADITE: ponto de partida a revisar pela equipe. Colunas não citadas
   (tabela nutricional, fiscais específicas etc.) vão para "Outros campos".
   O cadastro é único para todas as empresas: ITE_CODITE sozinho identifica o item. */
const TELA_CADITE: Tela = {
  titulo: "Item",
  subtitulo: [
    { coluna: "ITE_DESITE", rotulo: "Descrição" },
    { coluna: "ITE_CODGRU", rotulo: "Grupo" },
    { coluna: "ITE_CODMAR", rotulo: "Marca" },
  ],
  secoes: [
    {
      titulo: "Identificação",
      campos: [
        { coluna: "ITE_CODITE", rotulo: "Código do item" },
        { coluna: "ITE_DESITE", rotulo: "Descrição", largo: true },
        { coluna: "ITE_DESSIM", rotulo: "Descrição simplificada" },
        { coluna: "ITE_DESFAB", rotulo: "Descrição do fabricante" },
        { coluna: "ITE_CODEMP", rotulo: "Empresa do cadastro" },
        { coluna: "ITE_CODGRU", rotulo: "Grupo" },
        { coluna: "ITE_CODMAR", rotulo: "Marca" },
        { coluna: "ITE_CODUNI", rotulo: "Unidade" },
        { coluna: "ITE_CODSIM", rotulo: "Código do similar" },
        { coluna: "AUTOINCREM", rotulo: "Sequência (AUTOINCREM)" },
      ],
    },
    {
      titulo: "Códigos e referências",
      campos: [
        { coluna: "ITE_REFERE", rotulo: "Referência" },
        { coluna: "ITE_CODFAB", rotulo: "Código do fabricante" },
        { coluna: "ITE_CODBAR", rotulo: "Código de barras" },
        { coluna: "ITE_BARRAS", rotulo: "Códigos de barras", largo: true },
        { coluna: "ITE_FABRIC", rotulo: "Códigos do fabricante", largo: true },
        { coluna: "ITE_CODFOR", rotulo: "Fornecedor" },
      ],
    },
    {
      titulo: "Fiscal",
      campos: [
        { coluna: "ITE_CLAIPI", rotulo: "NCM" },
        { coluna: "ITE_CDCEST", rotulo: "CEST" },
        { coluna: "ITE_CSTORI", rotulo: "Origem (CST)" },
        { coluna: "ITE_INCPIS", rotulo: "Incide PIS/COFINS", valores: SIM_NAO },
        { coluna: "ITE_CODABF", rotulo: "Abrangência fiscal" },
      ],
    },
    {
      titulo: "Embalagem e venda",
      campos: [
        { coluna: "ITE_PESOIT", rotulo: "Peso" },
        { coluna: "ITE_PESLIQ", rotulo: "Peso líquido" },
        { coluna: "ITE_EMBALA", rotulo: "Embalagem" },
        { coluna: "ITE_QTDEMB", rotulo: "Quantidade na embalagem" },
        { coluna: "ITE_MLTCOM", rotulo: "Múltiplo de compra" },
        { coluna: "ITE_MLTVEN", rotulo: "Múltiplo de venda" },
        { coluna: "ITE_TMPGAR", rotulo: "Tempo de garantia" },
        { coluna: "ITE_APLICA", rotulo: "Aplicação", largo: true },
      ],
    },
    {
      titulo: "Controle",
      campos: [
        { coluna: "ITE_DTACAD", rotulo: "Cadastro" },
        { coluna: "ITE_ULTALT", rotulo: "Última alteração", hora: "ITE_HULALT" },
        { coluna: "ITE_DTAINA", rotulo: "Inativação" },
        { coluna: "ITE_CODOPE", rotulo: "Operador" },
        { coluna: "ITE_CODDEP", rotulo: "Departamento" },
        { coluna: "ITE_PESQUI", rotulo: "Texto de pesquisa", largo: true },
      ],
    },
  ],
};

/** Buscas da tela "Nova consulta": monta o SELECT (ou o JOIN) a partir de um número. */
export type BuscaRapida = {
  id: string;
  rotulo: string;
  perfil: string;
  coluna: string;
  exemplo: string;
  /** acrescenta o prefixo do marketplace ao número digitado (SHML… → MLB_SHML…), ver lib/marketplace.ts */
  prefixarMarketplace?: boolean;
};

// a primeira é a opção inicial do "Montar consulta"
export const BUSCAS_RAPIDAS: BuscaRapida[] = [
  { id: "numpok", rotulo: "Pedido – NUMPOK", perfil: "FATGOR", coluna: "FGO_NUMPOK", exemplo: "SHML48393430410", prefixarMarketplace: true },
  { id: "pedido", rotulo: "Pedido – nº documento", perfil: "FATGOR", coluna: "FGO_NUMDOC", exemplo: "000001000001" },
  { id: "nf", rotulo: "Pedido – nº da NF (fatura)", perfil: "FATGOR", coluna: "FGO_NUMFAT", exemplo: "000000053684" },
  { id: "autoincrem", rotulo: "Pedido – AUTOINCREM", perfil: "FATGOR", coluna: "AUTOINCREM", exemplo: "00100000000000001001" },
  { id: "nfe", rotulo: "NF-e – nº documento (LOGNFE)", perfil: "LOGNFE", coluna: "NFE_NUMDOC", exemplo: "000000053684" },
  { id: "item", rotulo: "Item – código (CADITE)", perfil: "CADITE", coluna: "ITE_CODITE", exemplo: "00004" },
  { id: "itebar", rotulo: "Item – código de barras", perfil: "CADITE", coluna: "ITE_CODBAR", exemplo: "7891252071268" },
  { id: "itefab", rotulo: "Item – código do fabricante", perfil: "CADITE", coluna: "ITE_CODFAB", exemplo: "7126" },
];

/**
 * Colunas destacadas mesmo sem perfil (consultas genéricas e JOINs).
 * O primeiro padrão que casar com uma coluna do resultado vence.
 */
export const DESTAQUES_GLOBAIS: { padrao: RegExp; rotulo: string }[] = [
  { padrao: /(^|_)NUMPOK$/, rotulo: "NUMPOK" },
];

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
    // NUMPOK (destaque) e motivo da baixa ficam sempre à vista na tabela
    colunasFixas: ["FGO_NUMDOC", "FGO_NUMPOK", "FGO_MOTBAI"],
    chave: "AUTOINCREM",
    destaque: { coluna: "FGO_NUMPOK", rotulo: "NUMPOK" },
    colunaTitulo: "FGO_NUMDOC",
    graficoSugerido: { modo: "soma", categoria: "FGO_CODVEN", valor: "FGO_VLRCON" },
    tela: TELA_FATGOR,
    relacoes: [
      { perfil: "FATDOR", colunaOrigem: "AUTOINCREM", colunaDestino: "FDO_SEQGER", rotulo: "Itens do pedido" },
      { perfil: "EXTGOR", colunaOrigem: "AUTOINCREM", colunaDestino: "FGO_SEQFGO", rotulo: "Extensão do pedido" },
      { perfil: "MOVCAR", colunaOrigem: "FGO_NUMPOK", colunaDestino: "MCA_NUMPOK", rotulo: "Movimentação de cartões" },
      { perfil: "HUBCIT_INFPED", colunaOrigem: "FGO_NUMPOK", colunaDestino: "INF_NUMPOK", rotulo: "Dados do pedido no HUB" },
      { perfil: "LOGNFE", colunaOrigem: "FGO_NUMFAT", colunaDestino: "NFE_NUMDOC", rotulo: "Log da NF-e" },
      // só os lançamentos deste pedido (crédito e o débito da emissão), não o extrato inteiro do cliente
      {
        perfil: "ADTCLI",
        colunaOrigem: "FGO_NUMDOC",
        colunaDestino: "ADT_NUMDOC",
        extras: [
          { origem: "FGO_ESPDOC", destino: "ADT_ESPDOC" },
          { origem: "FGO_CODEMP", destino: "ADT_CODEMP" },
        ],
        rotulo: "Adiantamentos do pedido",
      },
    ],
    // chaves estrangeiras da FATGOR no banco
    cadastros: [
      { coluna: "FGO_CODCLI", tabela: "CADCLI", colunaTabela: "CLI_CODCLI", rotulo: "Cliente" },
      { coluna: "FGO_CLICTT", tabela: "CLICTT", colunaTabela: "AUTOINCREM", rotulo: "Contato do cliente" },
      { coluna: "FGO_CODVEN", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Vendedor", grupo: "Operador" },
      { coluna: "FGO_VENFAT", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Vendedor do faturamento", grupo: "Operador" },
      { coluna: "FGO_CODDIG", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Digitador", grupo: "Operador" },
      { coluna: "FGO_OPELIB", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Operador da liberação", grupo: "Operador" },
      { coluna: "FGO_DIGLIB", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Digitador da liberação", grupo: "Operador" },
      { coluna: "FGO_OPELIC", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Operador da liberação comercial", grupo: "Operador" },
      { coluna: "FGO_DIGLIC", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Digitador da liberação comercial", grupo: "Operador" },
      { coluna: "FGO_OPEROM", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Operador do romaneio", grupo: "Operador" },
      { coluna: "FGO_CODTRA", tabela: "CADTRA", colunaTabela: "TRA_CODTRA", rotulo: "Transportadora" },
      { coluna: "FGO_CODEMP", tabela: "CADEMP", colunaTabela: "EMP_CODEMP", rotulo: "Empresa", grupo: "Empresa" },
      { coluna: "FGO_EMPFAT", tabela: "CADEMP", colunaTabela: "EMP_CODEMP", rotulo: "Empresa de faturamento", grupo: "Empresa" },
      { coluna: "FGO_EMPROM", tabela: "CADEMP", colunaTabela: "EMP_CODEMP", rotulo: "Empresa do romaneio", grupo: "Empresa" },
      { coluna: "FGO_EMPFOR", tabela: "CADEMP", colunaTabela: "EMP_CODEMP", rotulo: "Empresa (EMPFOR)", grupo: "Empresa" },
      { coluna: "FGO_CODCND", tabela: "CADCND", colunaTabela: "CND_CODIGO", rotulo: "Condição de pagamento" },
      { coluna: "FGO_CODFPG", tabela: "CADFPG", colunaTabela: "FPG_CODIGO", rotulo: "Forma de pagamento" },
      { coluna: "FGO_CODFIN", tabela: "CADFIN", colunaTabela: "FIN_CODIGO", rotulo: "Financeira" },
      { coluna: "FGO_CODDIV", tabela: "CADDIV", colunaTabela: "DIV_CODDIV", rotulo: "Divisão" },
      { coluna: "FGO_CIDCON", tabela: "CADCID", colunaTabela: "CID_CODCID", rotulo: "Cidade do consumidor", grupo: "Cidade" },
      { coluna: "FGO_CIDETR", tabela: "CADCID", colunaTabela: "CID_CODCID", rotulo: "Cidade de entrega", grupo: "Cidade" },
    ],
  },
  {
    id: "FATDOR",
    nome: "Pedidos – itens",
    assinatura: ["FDO_SEQGER", "FDO_CODITE"],
    colunasPadrao: ["FDO_SEQGER", "FDO_CODITE", "FDO_QTDITE", "FDO_UNITAR", "FDO_TOTITE"],
    colunaTitulo: "FDO_CODITE",
    // cada item é identificado pelo próprio AUTOINCREM (FDO_CODITE se repete em vários pedidos)
    chave: "AUTOINCREM",
    relacoes: [
      { perfil: "CADITE", colunaOrigem: "FDO_CODITE", colunaDestino: "ITE_CODITE", rotulo: "Cadastro do item" },
    ],
    cadastros: [
      { coluna: "FDO_CODCLI", tabela: "CADCLI", colunaTabela: "CLI_CODCLI", rotulo: "Cliente" },
      { coluna: "FDO_CODVEN", tabela: "CADOPE", colunaTabela: "OPE_CODOPE", rotulo: "Vendedor", grupo: "Operador" },
      { coluna: "FDO_CODEMP", tabela: "CADEMP", colunaTabela: "EMP_CODEMP", rotulo: "Empresa", grupo: "Empresa" },
      { coluna: "FDO_CODDIV", tabela: "CADDIV", colunaTabela: "DIV_CODDIV", rotulo: "Divisão" },
    ],
    totais: ["FDO_QTDITE", "FDO_TOTITE"],
    graficoSugerido: { modo: "soma", categoria: "FDO_CODITE", valor: "FDO_TOTITE" },
    tela: TELA_FATDOR,
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
    destaque: { coluna: "MCA_NUMPOK", rotulo: "NUMPOK" },
    colunasPadrao: ["MCA_NUMPOK", "MCA_VALTAX", "MCA_HIST01"],
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
  {
    id: "HUBCIT_INFPED",
    nome: "Pedidos no HUB",
    assinatura: ["INF_NUMPOK"],
    destaque: { coluna: "INF_NUMPOK", rotulo: "NUMPOK" },
    colunasPadrao: ["INF_NUMPOK", "INF_VALTAX"],
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
  },
  {
    id: "LOGNFE",
    nome: "Log de NF-e",
    assinatura: ["NFE_NUMDOC", "NFE_ACESSO", "NFE_STATUS"],
    colunasPadrao: [
      "NFE_NUMDOC", "NFE_ESPDOC", "NFE_SERIE_", "NFE_CODEMP", "NFE_CODCLI", "NFE_STATUS",
      "NFE_HORINI", "NFE_DTAAUT", "NFE_OBSERV", "NFE_ACESSO",
    ],
    colunasFixas: ["NFE_NUMDOC"],
    colunaTitulo: "NFE_NUMDOC",
    graficoSugerido: { modo: "contagem", categoria: "NFE_STATUS" },
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
    tela: {
      titulo: "NF-e",
      subtitulo: [
        { coluna: "NFE_ESPDOC", rotulo: "Espécie" },
        { coluna: "NFE_SERIE_", rotulo: "Série" },
        { coluna: "NFE_CODEMP", rotulo: "Empresa" },
        { coluna: "NFE_CODCLI", rotulo: "Cliente" },
      ],
      indicadores: [
        {
          coluna: "NFE_STATUS",
          rotulo: "Status",
          detalhes: [
            { coluna: "NFE_DTAAUT", rotulo: "Autorizada em" },
            { coluna: "NFE_OBSERV", rotulo: "Retorno" },
          ],
        },
      ],
      secoes: [
        {
          titulo: "Documento",
          campos: [
            { coluna: "NFE_NUMDOC", rotulo: "Nº documento" },
            { coluna: "NFE_ESPDOC", rotulo: "Espécie" },
            { coluna: "NFE_SERIE_", rotulo: "Série" },
            { coluna: "NFE_CODEMP", rotulo: "Empresa" },
            { coluna: "NFE_CODCLI", rotulo: "Cliente" },
            { coluna: "NFE_DTAEMI", rotulo: "Emissão" },
            { coluna: "NFE_ACESSO", rotulo: "Chave de acesso", formato: "chaveAcesso", largo: true },
          ],
        },
        {
          titulo: "Autorização",
          campos: [
            { coluna: "NFE_STATUS", rotulo: "Status" },
            { coluna: "NFE_CODAUT", rotulo: "Protocolo / cód. autorização" },
            { coluna: "NFE_HORINI", rotulo: "Início" },
            { coluna: "NFE_DTAAUT", rotulo: "Autorização" },
            { coluna: "NFE_EMPROC", rotulo: "Em processamento" },
            { coluna: "NFE_OBSERV", rotulo: "Retorno da SEFAZ", largo: true },
          ],
        },
        {
          titulo: "Impressão e envio",
          campos: [
            { coluna: "NFE_PONIMP", rotulo: "Ponto de impressão", largo: true },
            { coluna: "NFE_VIANFE", rotulo: "Via" },
            { coluna: "NFE_TIP_FC", rotulo: "Tipo" },
            { coluna: "NFE_NOMARQ", rotulo: "Arquivo", largo: true },
            { coluna: "NFE_NUM_IP", rotulo: "IP" },
          ],
        },
      ],
    },
  },
  {
    id: "ADTCLI",
    nome: "Adiantamentos do cliente",
    assinatura: ["ADT_CODCLI", "ADT_VALLAN", "ADT_TIPLAN"],
    colunasPadrao: [
      "ADT_DTALAN", "ADT_HORLAN", "ADT_TIPLAN", "ADT_VALLAN", "ADT_DESCRI", "ADT_NUMDOC",
      "ADT_ESPDOC", "ADT_CODEMP", "ADT_OPELAN", "ADT_ESTORN", "ADT_SEQCON", "ADT_CODCLI",
    ],
    colunaTitulo: "ADT_SEQCON",
    chave: "AUTOINCREM",
    graficoSugerido: { modo: "soma", categoria: "ADT_TIPLAN", valor: "ADT_VALLAN" },
    rotulosInversos: { FATGOR: "Pedido" },
    totais: [],
    saldo: { valor: "ADT_VALLAN", tipo: "ADT_TIPLAN", credito: ["C"], debito: ["D"] },
    tela: {
      titulo: "Lançamento",
      subtitulo: [
        { coluna: "ADT_CODCLI", rotulo: "Cliente" },
        { coluna: "ADT_CODEMP", rotulo: "Empresa" },
        { coluna: "ADT_DTALAN", rotulo: "Data", hora: "ADT_HORLAN" },
        { coluna: "ADT_NUMDOC", rotulo: "Documento" },
      ],
      status: [
        { coluna: "ADT_ESTORN", rotulo: "Estornado", valores: { S: { texto: "Sim", cor: "vermelho" }, N: { texto: "Não", cor: "cinza" } } },
      ],
      indicadores: [
        {
          coluna: "ADT_TIPLAN",
          rotulo: "Tipo de lançamento",
          valores: { C: "Crédito", D: "Débito" },
          cores: { C: "verde", D: "vermelho" },
          detalhes: [
            { coluna: "ADT_OPELAN", rotulo: "Operador" },
            { coluna: "ADT_DESCRI", rotulo: "Descrição" },
          ],
        },
      ],
      destaques: [{ coluna: "ADT_VALLAN", rotulo: "Valor do lançamento", formato: "moeda" }],
      secoes: [
        {
          titulo: "Lançamento",
          campos: [
            { coluna: "ADT_SEQCON", rotulo: "Sequência" },
            { coluna: "ADT_DTALAN", rotulo: "Data", hora: "ADT_HORLAN" },
            { coluna: "ADT_TIPLAN", rotulo: "Tipo", valores: { C: "Crédito", D: "Débito" } },
            { coluna: "ADT_VALLAN", rotulo: "Valor", formato: "moeda" },
            { coluna: "ADT_DESCRI", rotulo: "Descrição", largo: true },
            { coluna: "ADT_CODCLI", rotulo: "Cliente" },
            { coluna: "ADT_CODEMP", rotulo: "Empresa" },
            { coluna: "ADT_EMPLAN", rotulo: "Empresa do lançamento" },
            { coluna: "ADT_NUMDOC", rotulo: "Nº documento" },
            { coluna: "ADT_ESPDOC", rotulo: "Espécie" },
            { coluna: "ADT_OPELAN", rotulo: "Operador" },
            { coluna: "ADT_ESTORN", rotulo: "Estornado", valores: { S: "Sim", N: "Não" } },
            { coluna: "ADT_ORIGEM", rotulo: "Origem" },
            { coluna: "ADT_ADTORI", rotulo: "Adiantamento de origem" },
            { coluna: "ADT_DOCBAI", rotulo: "Documento de baixa" },
            { coluna: "AUTOINCREM", rotulo: "Sequência (AUTOINCREM)" },
          ],
        },
        {
          titulo: "Formas de pagamento",
          campos: [
            { coluna: "ADT_VALDIN", rotulo: "Dinheiro", formato: "moeda" },
            { coluna: "ADT_VALCAR", rotulo: "Cartão", formato: "moeda" },
            { coluna: "ADT_VALCHV", rotulo: "Cheque à vista", formato: "moeda" },
            { coluna: "ADT_VALCHP", rotulo: "Cheque pré", formato: "moeda" },
            { coluna: "ADT_VALCRE", rotulo: "Crédito", formato: "moeda" },
            { coluna: "ADT_VALFIN", rotulo: "Financeira", formato: "moeda" },
            { coluna: "ADT_VALORD", rotulo: "Ordem", formato: "moeda" },
            { coluna: "ADT_VALJUR", rotulo: "Juros", formato: "moeda" },
            { coluna: "ADT_RECPIX", rotulo: "Recebido via PIX", valores: { S: "Sim", N: "Não" } },
          ],
        },
        {
          titulo: "Boleto",
          campos: [
            { coluna: "ADT_NOSNUM", rotulo: "Nosso número" },
            { coluna: "ADT_DTABOL", rotulo: "Data do boleto" },
            { coluna: "ADT_BCOBOL", rotulo: "Banco do boleto" },
            { coluna: "ADT_BCOENV", rotulo: "Banco de envio" },
            { coluna: "ADT_DTAENV", rotulo: "Data de envio" },
            { coluna: "ADT_CARTEI", rotulo: "Carteira" },
            { coluna: "ADT_CODCED", rotulo: "Cedente" },
            { coluna: "ADT_LINDIG", rotulo: "Linha digitável", largo: true },
          ],
        },
        {
          titulo: "Contábil e comissões",
          campos: [
            { coluna: "ADT_CODCTA", rotulo: "Conta" },
            { coluna: "ADT_CODPOR", rotulo: "Portador" },
            { coluna: "ADT_PARCEL", rotulo: "Parcela" },
            { coluna: "ADT_RESCAI", rotulo: "Resumo de caixa" },
            { coluna: "ADT_DTABAN", rotulo: "Data bancária" },
            { coluna: "ADT_SEQBAN", rotulo: "Sequência bancária" },
            { coluna: "ADT_CTR_CC", rotulo: "Centro de custo" },
            { coluna: "ADT_VALCOM", rotulo: "Comissão", formato: "moeda" },
            { coluna: "ADT_COMREP", rotulo: "Comissão representante", formato: "moeda" },
            { coluna: "ADT_FATCOM", rotulo: "Fator comissão" },
            { coluna: "ADT_FATREP", rotulo: "Fator representante" },
          ],
        },
      ],
    },
  },
  {
    id: "CADITE",
    nome: "Cadastro de itens",
    assinatura: ["ITE_CODITE", "ITE_DESITE", "ITE_CODGRU"],
    colunasPadrao: [
      "ITE_CODITE", "ITE_DESITE", "ITE_CODGRU", "ITE_CODMAR", "ITE_REFERE", "ITE_CODFAB",
      "ITE_CODBAR", "ITE_CODUNI", "ITE_CLAIPI", "ITE_CODFOR", "ITE_DTACAD", "ITE_ULTALT",
    ],
    colunasFixas: ["ITE_CODITE", "ITE_DESITE"],
    colunaTitulo: "ITE_CODITE",
    chave: "ITE_CODITE",
    graficoSugerido: { modo: "contagem", categoria: "ITE_CODGRU" },
    rotulosInversos: { FATDOR: "Pedidos com o item" },
    tela: TELA_CADITE,
  },
];
