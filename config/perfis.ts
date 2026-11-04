/**
 * Perfis de tabela: camada opcional de conveniência.
 *
 * A aplicação funciona com qualquer resultado; um perfil só ajusta as colunas
 * visíveis por padrão, as colunas fixas, o título da ficha, o gráfico inicial e
 * os atalhos de relacionamento entre abas e a "Tela" (visão de formulário, como
 * a tela do ERP). Veja o README para adicionar um novo.
 */

/** Como o valor aparece na Tela. Sem formato, segue o tipo detectado da coluna. */
/** "log": texto com várias entradas "dd/mm/aaaa hh:mm:ss - mensagem" resumido (mensagens iguais agrupadas). */
/** "json": texto JSON indentado (se não for JSON válido, aparece como veio). */
export type FormatoCampo = "moeda" | "percentual" | "chaveAcesso" | "log" | "json";

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
  /**
   * valor tirado de dentro do JSON da `coluna`, pelo caminho (ex.: "customer.name");
   * `*` percorre uma lista (ex.: "products.*.name"), um valor por linha
   */
  json?: string;
};

export type StatusTela = {
  coluna: string;
  rotulo: string;
  /** texto e cor por valor; valores não listados aparecem em cinza, como vieram */
  valores?: Record<string, { texto: string; cor: CorStatus }>;
};

export type SecaoTela = {
  titulo: string;
  campos: CampoTela[];
  /** começa fechada; abre com um clique (ex.: textos longos como o log do robô) */
  recolhida?: boolean;
  /** vai para depois de todas as outras seções, inclusive "Outros campos" */
  noFim?: boolean;
};

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
  /** banco onde a tabela fica, quando não é o do ERP (ex.: "HUB"); o Montar consulta avisa onde rodar */
  banco?: string;
  /** colunas somadas no rodapé quando esta tabela aparece como grade em outra Tela
      (padrão: todas as colunas decimais) */
  totais?: string[];
  /**
   * Extrato com créditos e débitos: quando a tabela aparece como grade em outra
   * Tela, o rodapé mostra créditos, débitos e saldo em vez de somar tudo junto.
   */
  saldo?: { valor: string; tipo: string; credito: string[]; debito: string[] };
  /**
   * Colunas de uma tabela ligada (por uma relação deste perfil) mostradas na Tela
   * do registro quando a aba dela está aberta, ex.: medidas da DESSIT no item.
   * Só entram as que o resultado deste perfil não tiver; cite-as nas seções da `tela`.
   */
  colunasLigadas?: { perfil: string; colunas: string[] }[];
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
        // medidas da DESSIT: vêm da aba da DESSIT ligada (colunasLigadas) ou copiadas no JOIN do produto
        { coluna: "ITE_EXPALT", rotulo: "Altura (DESSIT)" },
        { coluna: "ITE_EXPLAR", rotulo: "Largura (DESSIT)" },
        { coluna: "ITE_EXPPRO", rotulo: "Profundidade (DESSIT)" },
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

/* DESSIT: dados do item para o site (medidas, imagem, descrição); o peso fica na CADITE.ITE_PESLIQ. */
const TELA_DESSIT: Tela = {
  titulo: "Dados do item para o site",
  subtitulo: [
    { coluna: "ITE_NOMITE", rotulo: "Nome" },
    { coluna: "ITE_DESTAQ", rotulo: "Destaque" },
  ],
  secoes: [
    {
      titulo: "Identificação",
      campos: [
        { coluna: "ITE_CODITE", rotulo: "Código do item" },
        { coluna: "ITE_NOMITE", rotulo: "Nome", largo: true },
        { coluna: "ITE_CODCAT", rotulo: "Categoria" },
        { coluna: "ITE_DESTAQ", rotulo: "Destaque", valores: SIM_NAO },
        { coluna: "ITE_ATZPRE", rotulo: "Atualiza preço", valores: SIM_NAO },
        { coluna: "ITE_CRODOC", rotulo: "CRODOC", valores: SIM_NAO },
        { coluna: "ITE_DESSIT", rotulo: "ITE_DESSIT" },
      ],
    },
    {
      titulo: "Medidas",
      campos: [
        { coluna: "ITE_EXPALT", rotulo: "Altura" },
        { coluna: "ITE_EXPLAR", rotulo: "Largura" },
        { coluna: "ITE_EXPPRO", rotulo: "Profundidade" },
      ],
    },
    {
      titulo: "Conteúdo",
      campos: [
        { coluna: "ITE_URLIMG", rotulo: "Imagem (URL)", largo: true },
        { coluna: "ITE_DESITE", rotulo: "Descrição", largo: true },
        { coluna: "ITE_APLITE", rotulo: "Aplicação", largo: true },
        { coluna: "ITE_DADTEC", rotulo: "Dados técnicos", largo: true },
        { coluna: "ITE_INCLUS", rotulo: "Itens inclusos", largo: true },
      ],
    },
  ],
};

/* HUBCIT_LOGPED (banco do Autcom): JSON do pedido recebido do HUB; os dados principais saem do LOG_JSON. */
const LOG_JSON = (json: string, rotulo: string, extra: Partial<CampoTela> = {}): CampoTela => ({ coluna: "LOG_JSON", json, rotulo, ...extra });
const VERDADEIRO_FALSO = { true: "Sim", false: "Não" };
const TELA_HUBCIT_LOGPED: Tela = {
  titulo: "Log do pedido",
  subtitulo: [
    { coluna: "LOG_DTAENT", rotulo: "Entrada" },
    LOG_JSON("domain", "Domínio"),
    LOG_JSON("origin", "Origem"),
    { coluna: "LOG_CODEMP", rotulo: "Empresa" },
  ],
  status: [
    {
      coluna: "LOG_VERIFICADO",
      rotulo: "Verificado",
      valores: { S: { texto: "Sim (S)", cor: "verde" }, N: { texto: "Não (N)", cor: "amarelo" } },
    },
  ],
  destaques: [
    { coluna: "LOG_VLRCON", rotulo: "Valor do pedido", formato: "moeda" },
    { coluna: "LOG_TOTPRO", rotulo: "Total dos produtos", formato: "moeda" },
    LOG_JSON("totalReceivable", "A receber (JSON)", { formato: "moeda" }),
  ],
  secoes: [
    {
      titulo: "Registro",
      campos: [
        { coluna: "ID", rotulo: "ID" },
        { coluna: "LOG_PEDIDO", rotulo: "Pedido (NUMPOK)" },
        { coluna: "LOG_DTAENT", rotulo: "Entrada" },
        { coluna: "LOG_VERIFICADO", rotulo: "Verificado", valores: SIM_NAO },
        { coluna: "LOG_CODEMP", rotulo: "Empresa" },
        { coluna: "LOG_VLRCON", rotulo: "Valor do pedido", formato: "moeda" },
        { coluna: "LOG_TOTPRO", rotulo: "Total dos produtos", formato: "moeda" },
      ],
    },
    {
      titulo: "Pedido no marketplace (JSON)",
      campos: [
        LOG_JSON("domain", "Domínio"),
        LOG_JSON("marketplaceOrderCode", "Pedido no marketplace"),
        LOG_JSON("packId", "Pack"),
        LOG_JSON("origin", "Origem"),
        LOG_JSON("status", "Status"),
        LOG_JSON("createdDate", "Criado em"),
        LOG_JSON("deliveryMode", "Modo de entrega"),
        LOG_JSON("isFulfillment", "Fulfillment", { valores: VERDADEIRO_FALSO }),
        LOG_JSON("observation", "Observação"),
        LOG_JSON("integrated", "Integrado"),
        LOG_JSON("nfKey", "Chave da NF-e", { formato: "chaveAcesso", largo: true }),
        LOG_JSON("errorMessage", "Mensagem de erro", { largo: true }),
      ],
    },
    {
      titulo: "Produtos (JSON)",
      campos: [
        LOG_JSON("products.*.externalCode", "Código do item"),
        LOG_JSON("products.*.quantity", "Quantidade"),
        LOG_JSON("products.*.totalUnitPrice", "Preço unitário", { formato: "moeda" }),
        LOG_JSON("products.*.saleFee", "Tarifa de venda", { formato: "moeda" }),
        LOG_JSON("products.*.advertisementType", "Tipo do anúncio"),
        LOG_JSON("products.*.marketplaceCode", "Anúncio"),
        LOG_JSON("products.*.name", "Nome", { largo: true }),
      ],
    },
    {
      titulo: "Valores (JSON)",
      campos: [
        LOG_JSON("totalProductsPrice", "Produtos", { formato: "moeda" }),
        LOG_JSON("totalFreightPrice", "Frete", { formato: "moeda" }),
        LOG_JSON("totalFreightPriceDebit", "Débito de frete", { formato: "moeda" }),
        LOG_JSON("totalDiscountPrice", "Desconto", { formato: "moeda" }),
        LOG_JSON("totalMarketplaceDiscount", "Desconto do marketplace", { formato: "moeda" }),
        LOG_JSON("totalTax", "Impostos", { formato: "moeda" }),
        LOG_JSON("totalPrice", "Total", { formato: "moeda" }),
        LOG_JSON("totalReceivable", "A receber", { formato: "moeda" }),
        LOG_JSON("payment.paymentType", "Pagamento"),
        LOG_JSON("payment.installmentCount", "Parcelas"),
        LOG_JSON("payment.totalValue", "Valor pago", { formato: "moeda" }),
      ],
    },
    {
      titulo: "Cliente (JSON)",
      campos: [
        LOG_JSON("customer.name", "Nome", { largo: true }),
        LOG_JSON("customer.cpf_Cnpj", "CPF/CNPJ"),
        LOG_JSON("customer.nickName", "Apelido"),
        LOG_JSON("customer.stateRegistration", "Inscrição estadual"),
        LOG_JSON("customer.email", "E-mail"),
        LOG_JSON("customer.city", "Cidade"),
        LOG_JSON("customer.state", "UF"),
      ],
    },
    {
      titulo: "Entrega (JSON)",
      campos: [
        LOG_JSON("shipping.shippingId", "Envio"),
        LOG_JSON("shipping.shippingType", "Tipo de envio"),
        LOG_JSON("shipping.deliveryProviderName", "Transportadora"),
        LOG_JSON("trackingCode", "Rastreio"),
        LOG_JSON("shipmentDueDate", "Prazo de envio"),
        LOG_JSON("estimatedDeliveryDate", "Previsão de entrega"),
        LOG_JSON("faturedAddress.receiverName", "Recebedor"),
        LOG_JSON("deliveryAddress.addressName", "Endereço", { largo: true }),
        LOG_JSON("deliveryAddress.number", "Número"),
        LOG_JSON("deliveryAddress.district", "Bairro"),
        LOG_JSON("deliveryAddress.city", "Cidade"),
        LOG_JSON("deliveryAddress.state", "UF"),
        LOG_JSON("deliveryAddress.zipCode", "CEP"),
      ],
    },
    // JSON inteiro: por último e fechado (clique para ver)
    { titulo: "JSON completo", campos: [{ coluna: "LOG_JSON", rotulo: "LOG_JSON", formato: "json", largo: true }], recolhida: true, noFim: true },
  ],
};

/* Status do HUB com cor (texto original entre parênteses); os demais aparecem como vierem. */
const STATUS_HUB_PEDIDO: StatusTela["valores"] = {
  paid: { texto: "Pago (paid)", cor: "verde" },
  CanceledOrder: { texto: "Cancelado (CanceledOrder)", cor: "vermelho" },
};
const STATUS_HUB_ITEM: StatusTela["valores"] = {
  paid: { texto: "Pago (paid)", cor: "verde" },
  cancelled: { texto: "Cancelado (cancelled)", cor: "vermelho" },
};

/* HUBCitel – tabela `pedidos` (banco do HUB). Rótulos: ponto de partida a revisar. */
const TELA_HUB_PEDIDOS: Tela = {
  titulo: "Pedido HUB",
  subtitulo: [
    { coluna: "dominio", rotulo: "Domínio" },
    { coluna: "origem_pedido", rotulo: "Origem" },
    { coluna: "canal", rotulo: "Canal" },
    { coluna: "data_pedido", rotulo: "Pedido em" },
  ],
  status: [
    {
      coluna: "status",
      rotulo: "Status",
      valores: STATUS_HUB_PEDIDO,
    },
    { coluna: "situacao", rotulo: "Situação" },
    { coluna: "sincronizado_marketplace", rotulo: "Sincronizado no marketplace", valores: { "1": { texto: "Sim", cor: "verde" }, "0": { texto: "Não", cor: "cinza" } } },
  ],
  destaques: [
    { coluna: "valor_total", rotulo: "Valor total", formato: "moeda" },
    { coluna: "valor_itens", rotulo: "Itens", formato: "moeda" },
    { coluna: "valor_frete", rotulo: "Frete", formato: "moeda" },
    { coluna: "valor_total_liquido_receber", rotulo: "Líquido a receber", formato: "moeda" },
  ],
  secoes: [
    {
      titulo: "Identificação",
      campos: [
        { coluna: "order_id", rotulo: "Order ID" },
        { coluna: "id_hub", rotulo: "ID no HUB" },
        { coluna: "dominio", rotulo: "Domínio" },
        { coluna: "order_id_marketplace", rotulo: "Order ID no marketplace" },
        { coluna: "pack_id", rotulo: "Pack ID" },
        { coluna: "shipping_id", rotulo: "Shipping ID" },
        { coluna: "id_cliente", rotulo: "Cliente" },
        { coluna: "tipo_pedido", rotulo: "Tipo de pedido" },
        { coluna: "origem_pedido", rotulo: "Origem do pedido" },
        { coluna: "origem_venda", rotulo: "Origem da venda" },
        { coluna: "canal", rotulo: "Canal" },
        { coluna: "status", rotulo: "Status" },
        { coluna: "situacao", rotulo: "Situação" },
        { coluna: "sincronizado_marketplace", rotulo: "Sincronizado no marketplace", valores: { "1": "Sim", "0": "Não" } },
      ],
    },
    {
      titulo: "Datas",
      campos: [
        { coluna: "data_pedido", rotulo: "Pedido" },
        { coluna: "data_aprovacao", rotulo: "Aprovação" },
        { coluna: "data_cadastro", rotulo: "Cadastro no HUB" },
        { coluna: "data_ultima_integracao", rotulo: "Última integração" },
        { coluna: "data_previsao_fat", rotulo: "Previsão de faturamento" },
        { coluna: "data_disponivel_envio", rotulo: "Disponível para envio" },
        { coluna: "data_limite_envio", rotulo: "Limite de envio" },
        { coluna: "data_estimada_entrega_inicio", rotulo: "Entrega estimada (início)" },
        { coluna: "data_estimada_entrega", rotulo: "Entrega estimada" },
      ],
    },
    {
      titulo: "Valores",
      campos: [
        { coluna: "valor_itens", rotulo: "Itens", formato: "moeda" },
        { coluna: "valor_frete", rotulo: "Frete", formato: "moeda" },
        { coluna: "valor_desconto", rotulo: "Desconto", formato: "moeda" },
        { coluna: "valor_taxa", rotulo: "Taxa", formato: "moeda" },
        { coluna: "valor_total", rotulo: "Total", formato: "moeda" },
        { coluna: "valor_total_liquido_receber", rotulo: "Líquido a receber", formato: "moeda" },
        { coluna: "valor_receber_debito", rotulo: "A receber (débito)", formato: "moeda" },
        { coluna: "valor_frete_debito", rotulo: "Frete (débito)", formato: "moeda" },
        { coluna: "custo_frete_flex", rotulo: "Custo do frete Flex", formato: "moeda" },
        { coluna: "desconto_marketplace", rotulo: "Desconto do marketplace", formato: "moeda" },
        { coluna: "desconto_frete_marketplace", rotulo: "Desconto de frete do marketplace", formato: "moeda" },
        { coluna: "desconto_promocoes", rotulo: "Desconto de promoções", formato: "moeda" },
        { coluna: "tipo_calculo", rotulo: "Tipo de cálculo" },
      ],
    },
    {
      titulo: "Envio e transporte",
      campos: [
        { coluna: "modo_entrega", rotulo: "Modo de entrega" },
        { coluna: "tipo_envio", rotulo: "Tipo de envio" },
        { coluna: "fulfillment", rotulo: "Fulfillment", valores: { "1": "Sim", "0": "Não" } },
        { coluna: "id_servico", rotulo: "ID do serviço" },
        { coluna: "nome_transportadora", rotulo: "Serviço / transportadora" },
        { coluna: "transportadora_nome", rotulo: "Transportadora" },
        { coluna: "cnpj_transportadora", rotulo: "CNPJ da transportadora" },
        { coluna: "id_marketplace_transportadora", rotulo: "ID da transportadora no marketplace" },
        { coluna: "tag_impressa", rotulo: "Etiqueta impressa", valores: { "1": "Sim", "0": "Não" } },
        { coluna: "coleta_endereco_id_marketplace", rotulo: "Coleta – endereço (marketplace)" },
        { coluna: "coleta_hora_id_marketplace", rotulo: "Coleta – horário (marketplace)" },
        { coluna: "deposito_marketplace_codigo", rotulo: "Depósito no marketplace" },
      ],
    },
    {
      titulo: "Endereço de entrega",
      campos: [
        { coluna: "endereco_entrega", rotulo: "Endereço", largo: true },
        { coluna: "numero_entrega", rotulo: "Número" },
        { coluna: "complemento_entrega", rotulo: "Complemento" },
        { coluna: "bairro_entrega", rotulo: "Bairro" },
        { coluna: "cidade_entrega", rotulo: "Cidade" },
        { coluna: "uf_entrega", rotulo: "UF" },
        { coluna: "cep_entrega", rotulo: "CEP" },
      ],
    },
    {
      titulo: "Observações",
      campos: [
        { coluna: "observacao", rotulo: "Observação", largo: true },
        { coluna: "observacao_complementar", rotulo: "Observação complementar", largo: true },
      ],
    },
  ],
};

/* HUBCitel – tabela `itens_pedidos`. */
const TELA_HUB_ITENS: Tela = {
  titulo: "Item do pedido HUB",
  subtitulo: [
    { coluna: "codigo_item", rotulo: "Item" },
    { coluna: "nome", rotulo: "Nome" },
    { coluna: "dominio", rotulo: "Domínio" },
    { coluna: "anuncio_id", rotulo: "Anúncio" },
  ],
  status: [
    { coluna: "order_status", rotulo: "Status no marketplace", valores: STATUS_HUB_ITEM },
    // vem só na busca de itens vendidos (copiado do cabeçalho)
    { coluna: "status_pedido", rotulo: "Status do pedido", valores: STATUS_HUB_PEDIDO },
  ],
  destaques: [
    { coluna: "quantidade", rotulo: "Quantidade" },
    { coluna: "valor_unitario", rotulo: "Valor unitário", formato: "moeda" },
    { coluna: "taxa_venda", rotulo: "Taxa de venda", formato: "moeda" },
  ],
  secoes: [
    {
      titulo: "Item",
      campos: [
        { coluna: "codigo_item", rotulo: "Código do item (SKU)" },
        { coluna: "nome", rotulo: "Nome", largo: true },
        { coluna: "ean", rotulo: "EAN" },
        { coluna: "quantidade", rotulo: "Quantidade" },
        { coluna: "valor_unitario", rotulo: "Valor unitário", formato: "moeda" },
        { coluna: "taxa_venda", rotulo: "Taxa de venda", formato: "moeda" },
        { coluna: "tabela_preco", rotulo: "Tabela de preço" },
        { coluna: "descricao_variacao", rotulo: "Variação", largo: true },
        { coluna: "variacao_id", rotulo: "ID da variação" },
      ],
    },
    {
      titulo: "Anúncio",
      campos: [
        { coluna: "anuncio_id", rotulo: "Anúncio" },
        { coluna: "tipo_anuncio", rotulo: "Tipo de anúncio" },
        { coluna: "loja_nome", rotulo: "Loja" },
        { coluna: "frete_gratis", rotulo: "Frete grátis", valores: { "1": "Sim", "0": "Não" } },
        { coluna: "publicidade", rotulo: "Publicidade" },
      ],
    },
    {
      titulo: "Pedido",
      campos: [
        { coluna: "order_id", rotulo: "Order ID" },
        { coluna: "dominio", rotulo: "Domínio" },
        { coluna: "order_origem", rotulo: "Pedido de origem (marketplace)" },
        { coluna: "order_status", rotulo: "Status no marketplace" },
        { coluna: "data_pedido", rotulo: "Data do pedido" },
        { coluna: "status_pedido", rotulo: "Status do pedido" },
        { coluna: "valor_total_pedido", rotulo: "Valor total do pedido", formato: "moeda" },
        { coluna: "id", rotulo: "ID do item" },
      ],
    },
    {
      titulo: "Tintométrico e depósito",
      campos: [
        { coluna: "md5_tintometrico", rotulo: "MD5 tintométrico" },
        { coluna: "sigla_tintometrico", rotulo: "Sigla tintométrico" },
        { coluna: "deposito_marketplace_codigo", rotulo: "Depósito no marketplace" },
        { coluna: "deposito_codigo", rotulo: "Depósito" },
      ],
    },
  ],
};

/** Buscas da tela "Nova consulta": monta o SELECT (ou o JOIN) a partir de um número. */
export type BuscaRapida = {
  id: string;
  /** grupo no menu do "Montar consulta" (ex.: "Autcom", "HUB") */
  grupo: string;
  rotulo: string;
  perfil: string;
  coluna: string;
  exemplo: string;
  /** acrescenta o prefixo do marketplace ao número digitado (SHML… → MLB_SHML…), ver lib/marketplace.ts */
  prefixarMarketplace?: boolean;
  /** tira o prefixo do marketplace do número digitado (MLB_SHML… → SHML…), ex.: order_id do HUBCitel */
  removerPrefixoMarketplace?: boolean;
  /** segundo campo, opcional, que entra no WHERE com AND (ex.: domínio do cliente no HUB) */
  filtroExtra?: { coluna: string; rotulo: string; exemplo: string };
  /** no JOIN, colunas da tabela ligada repetidas na aba da principal (para filtrar/ordenar ali) */
  copiarColunas?: { perfil: string; colunas: { coluna: string; alias?: string }[] }[];
  /**
   * no JOIN, usa só estas ligações (no lugar das relações do perfil), ex.: produto
   * com a marca, sem trazer os pedidos do item
   */
  joins?: Relacao[];
};

// a primeira é a opção inicial do "Montar consulta"; no menu, agrupadas por `grupo`, nesta ordem
export const BUSCAS_RAPIDAS: BuscaRapida[] = [
  { id: "numpok", grupo: "Autcom", rotulo: "Pedido – NUMPOK", perfil: "FATGOR", coluna: "FGO_NUMPOK", exemplo: "SHML48393430410", prefixarMarketplace: true },
  { id: "pedido", grupo: "Autcom", rotulo: "Pedido – NUMDOC", perfil: "FATGOR", coluna: "FGO_NUMDOC", exemplo: "000001000001" },
  { id: "nf", grupo: "Autcom", rotulo: "Pedido – NUMFAT", perfil: "FATGOR", coluna: "FGO_NUMFAT", exemplo: "000000053684" },
  // pedidos em que o item aparece (CADITE → FATDOR)
  { id: "item", grupo: "Autcom", rotulo: "Pedido – CADITE", perfil: "CADITE", coluna: "ITE_CODITE", exemplo: "00004" },
  { id: "fataut", grupo: "Autcom", rotulo: "FATAUT – NUMDOC", perfil: "FATAUT", coluna: "FAT_NUMDOC", exemplo: "000000970818" },
  { id: "nfe", grupo: "Autcom", rotulo: "LOGNFE – NUMDOC", perfil: "LOGNFE", coluna: "NFE_NUMDOC", exemplo: "000000053684" },
  // cadastro do produto com as tabelas de cadastro ligadas (marca…)
  {
    id: "produto",
    grupo: "Autcom",
    rotulo: "Produto – CADITE",
    perfil: "CADITE",
    coluna: "ITE_CODITE",
    exemplo: "00004",
    joins: [
      { perfil: "CADMAR", colunaOrigem: "ITE_CODMAR", colunaDestino: "MAR_CODMAR", rotulo: "Marca" },
      { perfil: "DESSIT", colunaOrigem: "ITE_CODITE", colunaDestino: "ITE_CODITE", rotulo: "Dados para o site" },
    ],
    // medidas da DESSIT também na aba do item, ao lado do peso (ITE_PESLIQ)
    copiarColunas: [{ perfil: "DESSIT", colunas: [{ coluna: "ITE_EXPALT" }, { coluna: "ITE_EXPLAR" }, { coluna: "ITE_EXPPRO" }] }],
  },
  // HUBCitel: o order_id fica sem o prefixo do marketplace (MLB_SHML… → SHML…)
  // o banco do HUB tem todos os clientes, separados por domínio
  {
    id: "hubpedido",
    grupo: "HUB",
    rotulo: "HUBCitel – Pedido (order_id)",
    perfil: "HUB_PEDIDOS",
    coluna: "order_id",
    exemplo: "SHML48412293490",
    removerPrefixoMarketplace: true,
    filtroExtra: { coluna: "dominio", rotulo: "Domínio", exemplo: "ulitintas" },
  },
  // itens vendidos de um cliente, com o cabeçalho do pedido (como FATDOR + FATGOR)
  {
    id: "hubitem",
    grupo: "HUB",
    rotulo: "HUBCitel – Itens vendidos (código do item)",
    perfil: "HUB_ITENS_PEDIDOS",
    coluna: "codigo_item",
    exemplo: "06377",
    filtroExtra: { coluna: "dominio", rotulo: "Domínio", exemplo: "ulitintas" },
    // data e situação do pedido também na aba de itens, para filtrar as vendas por data
    copiarColunas: [
      {
        perfil: "HUB_PEDIDOS",
        colunas: [
          { coluna: "data_pedido" },
          { coluna: "status", alias: "status_pedido" },
          { coluna: "valor_total", alias: "valor_total_pedido" },
        ],
      },
    ],
  },
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
      { perfil: "HUBCIT_LOGPED", colunaOrigem: "FGO_NUMPOK", colunaDestino: "LOG_PEDIDO", rotulo: "Log do pedido recebido do HUB" },
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
      // fila do faturamento automático: a procedure do cliente insere o pedido aqui (só consulta)
      {
        perfil: "FATAUT",
        colunaOrigem: "FGO_NUMDOC",
        colunaDestino: "FAT_NUMDOC",
        extras: [
          { origem: "FGO_ESPDOC", destino: "FAT_ESPDOC" },
          { origem: "FGO_CODEMP", destino: "FAT_EMPDOC" },
        ],
        rotulo: "Faturamento automático (FATAUT)",
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
    // Fila de faturamento automático. Quem insere é uma procedure (ex.: esp_InserePedidosFATAUT)
    // com regras próprias de cada cliente; aqui só se consulta o que foi gravado.
    id: "FATAUT",
    nome: "Faturamento automático",
    assinatura: ["FAT_NUMDOC", "FAT_EMPDOC", "FAT_DTAINS"],
    colunasPadrao: [
      "FAT_NUMDOC", "FAT_ESPDOC", "FAT_EMPDOC", "FAT_DTAINS", "FAT_LOGDTA", "FAT_NUMFAT", "FAT_SERFAT",
      "FAT_EMPFAT", "FAT_TIPFAT", "FAT_RETNFE", "FAT_LOGMSG", "FAT_FDOGER",
    ],
    colunasFixas: ["FAT_NUMDOC"],
    chave: "AUTOINCREM",
    colunaTitulo: "FAT_NUMDOC",
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
    tela: {
      titulo: "Fila automática – pedido",
      subtitulo: [
        { coluna: "FAT_ESPDOC", rotulo: "Espécie" },
        { coluna: "FAT_EMPDOC", rotulo: "Empresa" },
        { coluna: "FAT_DTAINS", rotulo: "Inserido em" },
        { coluna: "FAT_LOGDTA", rotulo: "Último log" },
      ],
      secoes: [
        {
          titulo: "Faturamento",
          campos: [
            { coluna: "FAT_NUMFAT", rotulo: "Nº da fatura" },
            { coluna: "FAT_SERFAT", rotulo: "Série" },
            { coluna: "FAT_EMPFAT", rotulo: "Empresa da fatura" },
            { coluna: "FAT_TIPFAT", rotulo: "Tipo de faturamento" },
            { coluna: "FAT_CLIFAT", rotulo: "Cliente da fatura" },
            { coluna: "FAT_RETNFE", rotulo: "Retorno da NF-e", largo: true },
            { coluna: "FAT_DTLBEX", rotulo: "Liberação de expedição" },
            { coluna: "FAT_SMART_", rotulo: "Smart" },
          ],
        },
        {
          titulo: "Etiqueta",
          campos: [
            { coluna: "FAT_ETIMKP", rotulo: "Etiqueta do marketplace" },
            { coluna: "FAT_ETIDTA", rotulo: "Data da etiqueta" },
            { coluna: "FAT_ETIPAT", rotulo: "Caminho da etiqueta", largo: true },
            { coluna: "FAT_ETIINC", rotulo: "Etiqueta incluída" },
          ],
        },
        {
          titulo: "Ligações",
          campos: [
            { coluna: "FAT_NUMDOC", rotulo: "Nº documento" },
            { coluna: "FAT_FDOGER", rotulo: "Pedido (AUTOINCREM da FATGOR)" },
            { coluna: "FAT_SEQGER", rotulo: "Sequência" },
            { coluna: "AUTOINCREM", rotulo: "AUTOINCREM" },
          ],
        },
        // log longo: por último e fechado (clique para ver)
        {
          titulo: "Log do robô",
          campos: [{ coluna: "FAT_LOGMSG", rotulo: "Mensagens (iguais agrupadas)", formato: "log", largo: true }],
          recolhida: true,
          noFim: true,
        },
      ],
    },
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
    // tabela do Autcom (não do banco do HUB): cada pedido recebido do HUB, com o JSON original
    id: "HUBCIT_LOGPED",
    nome: "Log de pedidos do HUB",
    assinatura: ["LOG_PEDIDO", "LOG_JSON", "LOG_VERIFICADO"],
    destaque: { coluna: "LOG_PEDIDO", rotulo: "NUMPOK" },
    colunasPadrao: ["ID", "LOG_PEDIDO", "LOG_DTAENT", "LOG_VLRCON", "LOG_TOTPRO", "LOG_VERIFICADO", "LOG_CODEMP", "LOG_JSON"],
    colunasFixas: ["LOG_PEDIDO"],
    colunaTitulo: "LOG_PEDIDO",
    chave: "ID",
    graficoSugerido: { modo: "contagem", categoria: "LOG_VERIFICADO" },
    rotulosInversos: { FATGOR: "Pedido (cabeçalho)" },
    tela: TELA_HUBCIT_LOGPED,
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
    // relação (não só cadastro): com a aba da CADMAR aberta, a ficha do item mostra a marca
    relacoes: [
      { perfil: "CADMAR", colunaOrigem: "ITE_CODMAR", colunaDestino: "MAR_CODMAR", rotulo: "Marca" },
      { perfil: "DESSIT", colunaOrigem: "ITE_CODITE", colunaDestino: "ITE_CODITE", rotulo: "Dados para o site" },
    ],
    // altura, largura e profundidade ficam na DESSIT; o peso (ITE_PESLIQ) fica na própria CADITE
    colunasLigadas: [{ perfil: "DESSIT", colunas: ["ITE_EXPALT", "ITE_EXPLAR", "ITE_EXPPRO"] }],
    tela: TELA_CADITE,
  },
  {
    // complemento do item (mesma chave ITE_CODITE); só aparece pelo JOIN do produto, sem busca própria
    id: "DESSIT",
    nome: "Dados do item para o site",
    // sem as medidas: elas também vão (copiadas) para a aba da CADITE no JOIN do produto
    assinatura: ["ITE_CODITE", "ITE_NOMITE", "ITE_ATZPRE"],
    colunasPadrao: [
      "ITE_CODITE", "ITE_NOMITE", "ITE_EXPALT", "ITE_EXPLAR", "ITE_EXPPRO", "ITE_CODCAT",
      "ITE_DESTAQ", "ITE_ATZPRE", "ITE_CRODOC", "ITE_DESSIT", "ITE_URLIMG",
    ],
    colunasFixas: ["ITE_CODITE"],
    colunaTitulo: "ITE_CODITE",
    chave: "ITE_CODITE",
    rotulosInversos: { CADITE: "Cadastro do item" },
    tela: TELA_DESSIT,
  },
  {
    id: "CADMAR",
    nome: "Cadastro de marcas",
    assinatura: ["MAR_CODMAR", "MAR_DESMAR"],
    colunasPadrao: ["MAR_CODMAR", "MAR_DESMAR", "MAR_CODEMP", "MAR_CODGRU", "MAR_FATCUS", "MAR_ATIVA_", "MAR_CODVEL", "MAR_ULTALT"],
    colunasFixas: ["MAR_CODMAR", "MAR_DESMAR"],
    colunaTitulo: "MAR_CODMAR",
    chave: "MAR_CODMAR",
    rotulosInversos: { CADITE: "Itens da marca" },
  },
  {
    // HUBCitel (banco do HUB, não do ERP): cabeçalho do pedido, pelo order_id sem prefixo
    id: "HUB_PEDIDOS",
    nome: "HUBCitel – Pedido",
    tabela: "pedidos",
    banco: "HUB",
    assinatura: ["id_hub", "order_id", "valor_total_liquido_receber"],
    colunasPadrao: [
      "order_id", "dominio", "status", "situacao", "data_pedido", "origem_pedido", "canal",
      "valor_itens", "valor_frete", "valor_total", "valor_total_liquido_receber", "modo_entrega",
      "transportadora_nome", "data_limite_envio",
    ],
    colunasFixas: ["order_id"],
    colunaTitulo: "order_id",
    chave: "order_id",
    graficoSugerido: { modo: "contagem", categoria: "status" },
    relacoes: [
      // o mesmo order_id pode existir em mais de um domínio (cliente) do HUB
      {
        perfil: "HUB_ITENS_PEDIDOS",
        colunaOrigem: "order_id",
        colunaDestino: "order_id",
        extras: [{ origem: "dominio", destino: "dominio" }],
        rotulo: "Itens do pedido",
      },
    ],
    tela: TELA_HUB_PEDIDOS,
  },
  {
    id: "HUB_ITENS_PEDIDOS",
    nome: "HUBCitel – Itens do pedido",
    tabela: "itens_pedidos",
    banco: "HUB",
    assinatura: ["order_id", "codigo_item", "anuncio_id"],
    // status da venda logo no começo: na busca por item, cada linha é uma venda
    colunasPadrao: [
      "order_id", "data_pedido", "status_pedido", "order_status", "codigo_item", "quantidade",
      "valor_unitario", "taxa_venda", "valor_total_pedido", "nome", "anuncio_id", "tipo_anuncio", "ean",
    ],
    colunasFixas: ["order_id"],
    colunaTitulo: "order_id",
    chave: "id",
    totais: ["quantidade"],
    graficoSugerido: { modo: "soma", categoria: "codigo_item", valor: "quantidade" },
    rotulosInversos: { HUB_PEDIDOS: "Pedido (cabeçalho)" },
    tela: TELA_HUB_ITENS,
  },
];
