/** Valor de uma célula: o texto original (`raw`) ou `null` para NULL. "" é string vazia, diferente de NULL. */
export type Valor = string | null;

export type TipoColuna = "inteiro" | "decimal" | "data" | "hora" | "datahora" | "texto";

export type Coluna = {
  /** nome exibido (único; repetições recebem " (2)", " (3)"...) */
  nome: string;
  /** nome como veio no cabeçalho */
  original: string;
  tipo: TipoColuna;
  /** maior quantidade de casas decimais (só para colunas decimais) */
  casas: number;
};

export type Aviso = {
  tipo: "colunas-divergentes" | "colunas-duplicadas" | "linhas-vazias" | "perfil" | "separacao";
  mensagem: string;
};

export type ResultadoParse = {
  colunas: Coluna[];
  /** linhas[i][j] = valor da coluna j na linha i */
  linhas: Valor[][];
  avisos: Aviso[];
};
