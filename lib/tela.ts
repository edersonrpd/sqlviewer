import type { CampoTela, CorStatus, Perfil } from "@/config/perfis";
import { colunaDestaque } from "./destaque";
import { formatarValor } from "./formatacao";
import type { Coluna, ResultadoParse, Valor } from "./tipos";

/** Um campo pronto para exibir na Tela. */
export type CampoMontado = {
  /** índice da coluna em dados.colunas */
  j: number;
  rotulo: string;
  /** nome técnico da coluna */
  nome: string;
  /** valor original; null = NULL */
  raw: Valor;
  /** texto exibido (null quando o valor é NULL) */
  texto: string | null;
  /** NULL, vazio ou numérico zerado */
  vazio: boolean;
  numerico: boolean;
  largo: boolean;
};

export type StatusMontado = { rotulo: string; nome: string; texto: string; cor: CorStatus };
export type IndicadorMontado = { campo: CampoMontado; detalhes: CampoMontado[]; cor: CorStatus };
export type SecaoMontada = { titulo: string; campos: CampoMontado[] };

export type TelaMontada = {
  titulo: string;
  /** coluna-chave destacada (ex.: NUMPOK) */
  chave: CampoMontado | null;
  indicadores: IndicadorMontado[];
  subtitulo: CampoMontado[];
  status: StatusMontado[];
  destaques: CampoMontado[];
  secoes: SecaoMontada[];
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function ehNumerica(c: Coluna) {
  return c.tipo === "inteiro" || c.tipo === "decimal";
}

/** Valor usado em títulos: NULL e vazio ficam explícitos. */
function textoTitulo(v: Valor | undefined): string {
  return v === null || v === undefined ? "NULL" : v.trim() === "" ? "(vazio)" : v;
}

/** Zero numérico ("0", "0.00", "-0.0000"). Códigos como "000" são texto e não entram aqui. */
function ehZero(v: string) {
  return /^-?0+(\.0+)?$/.test(v);
}

export function montarCampo(dados: ResultadoParse, linha: Valor[], j: number, def?: Partial<CampoTela>): CampoMontado {
  const col = dados.colunas[j];
  const raw = linha[j];
  const numerico = ehNumerica(col) || def?.formato === "moeda" || def?.formato === "percentual";
  let texto: string | null = null;
  if (raw !== null) {
    const n = Number(raw);
    if (def?.valores && raw in def.valores) texto = def.valores[raw];
    else if (def?.formato === "moeda" && raw !== "" && Number.isFinite(n)) texto = moeda.format(n);
    else if (def?.formato === "percentual" && raw !== "" && Number.isFinite(n)) texto = `${pct.format(n)}%`;
    // chave de acesso de NF-e (44 dígitos) em blocos de 4, como no DANFE
    else if (def?.formato === "chaveAcesso") texto = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    else texto = formatarValor(raw, col.tipo);
  }
  if (def?.hora) {
    const jh = dados.colunas.findIndex((c) => c.nome === def.hora);
    const h = jh >= 0 ? linha[jh] : null;
    if (h) texto = texto ? `${texto} ${h}` : h;
  }
  const vazio = raw === null || raw.trim() === "" || (numerico && ehZero(raw.trim()));
  return { j, rotulo: def?.rotulo ?? col.nome, nome: col.nome, raw, texto, vazio, numerico, largo: !!def?.largo || (raw?.length ?? 0) > 40 };
}

/**
 * Monta a Tela de um registro. Com `perfil.tela`, segue as seções declaradas e
 * junta as colunas não citadas em "Outros campos". Sem perfil, agrupa por tipo.
 * Colunas do perfil ausentes no resultado são ignoradas.
 */
export function montarTela(dados: ResultadoParse, registro: number, perfil?: Perfil): TelaMontada {
  const linha = dados.linhas[registro];
  const porNome = new Map(dados.colunas.map((c, j) => [c.nome, j]));
  const tela = perfil?.tela;
  const usadas = new Set<number>();

  const resolver = (defs: CampoTela[] | undefined, marcar: boolean) =>
    (defs ?? []).flatMap((d) => {
      const j = porNome.get(d.coluna);
      if (j === undefined) return [];
      if (marcar) {
        usadas.add(j);
        const jh = d.hora ? porNome.get(d.hora) : undefined;
        if (jh !== undefined) usadas.add(jh);
      }
      return [montarCampo(dados, linha, j, d)];
    });

  // título: "Pedido 000001000004" ou "COLUNA: valor"
  const jTitulo = perfil?.colunaTitulo ? porNome.get(perfil.colunaTitulo) : undefined;
  let titulo: string;
  if (jTitulo !== undefined) {
    const v = textoTitulo(linha[jTitulo]);
    titulo = tela?.titulo ? `${tela.titulo} ${v}` : `${dados.colunas[jTitulo].nome}: ${v}`;
  } else {
    titulo = dados.colunas.length ? `${dados.colunas[0].nome}: ${linha[0] ?? "NULL"}` : "Registro";
  }

  const status: StatusMontado[] = (tela?.status ?? []).flatMap((s) => {
    const j = porNome.get(s.coluna);
    if (j === undefined) return [];
    const v = linha[j];
    const mapa = v !== null ? s.valores?.[v] : undefined;
    return [{ rotulo: s.rotulo, nome: s.coluna, texto: mapa?.texto ?? (v === null ? "NULL" : v === "" ? "(vazio)" : v), cor: mapa?.cor ?? "cinza" }];
  });

  const subtitulo = resolver(tela?.subtitulo, false);
  const indicadores: IndicadorMontado[] = (tela?.indicadores ?? []).flatMap((ind) => {
    const j = porNome.get(ind.coluna);
    if (j === undefined) return [];
    const campo = montarCampo(dados, linha, j, ind);
    const v = campo.raw;
    const cor: CorStatus = campo.vazio ? "cinza" : ((v !== null && ind.cores?.[v]) || "azul");
    return [{ campo, detalhes: resolver(ind.detalhes, false), cor }];
  });
  const destaques = resolver(tela?.destaques, false);
  let secoes: SecaoMontada[] = (tela?.secoes ?? [])
    .map((s) => ({ titulo: s.titulo, campos: resolver(s.campos, true) }))
    .filter((s) => s.campos.length > 0);

  const restantes = dados.colunas.map((_, j) => j).filter((j) => !usadas.has(j));
  if (tela) {
    if (restantes.length) secoes.push({ titulo: "Outros campos", campos: restantes.map((j) => montarCampo(dados, linha, j)) });
  } else {
    secoes = agruparPorTipo(dados, linha, restantes);
  }
  const d = colunaDestaque(dados.colunas, perfil);
  const chave = d ? montarCampo(dados, linha, d.j, { rotulo: d.rotulo }) : null;
  return { titulo, chave, indicadores, subtitulo, status, destaques, secoes };
}

function agruparPorTipo(dados: ResultadoParse, linha: Valor[], js: number[]): SecaoMontada[] {
  const grupos: Record<string, number[]> = { Identificação: [], "Datas e horas": [], Valores: [], Textos: [] };
  for (const j of js) {
    const c = dados.colunas[j];
    const v = linha[j];
    if (c.tipo === "data" || c.tipo === "hora" || c.tipo === "datahora") grupos["Datas e horas"].push(j);
    else if (ehNumerica(c)) grupos.Valores.push(j);
    else if (v !== null && v.length > 40) grupos.Textos.push(j);
    else grupos.Identificação.push(j);
  }
  return Object.entries(grupos)
    .filter(([, l]) => l.length > 0)
    .map(([titulo, l]) => ({ titulo, campos: l.map((j) => montarCampo(dados, linha, j)) }));
}

/** Texto curto para a lista de registros: título + primeiro destaque/subtítulo. */
export function resumoRegistro(
  dados: ResultadoParse,
  registro: number,
  perfil?: Perfil,
): { titulo: string; detalhe: string; chave: string | null } {
  const linha = dados.linhas[registro];
  const porNome = new Map(dados.colunas.map((c, j) => [c.nome, j]));
  const jT = perfil?.colunaTitulo ? porNome.get(perfil.colunaTitulo) : undefined;
  const titulo = textoTitulo(linha[jT ?? 0]);
  const partes: string[] = [];
  const tela = perfil?.tela;
  for (const d of [...(tela?.subtitulo ?? []).slice(0, 1), ...(tela?.destaques ?? []).slice(0, 1)]) {
    const j = porNome.get(d.coluna);
    if (j === undefined) continue;
    const c = montarCampo(dados, linha, j, d);
    if (c.texto) partes.push(c.texto);
  }
  if (!tela) {
    for (let j = 1; j < dados.colunas.length && partes.length < 2; j++) {
      const v = linha[j];
      if (v) partes.push(formatarValor(v, dados.colunas[j].tipo));
    }
  }
  const d = colunaDestaque(dados.colunas, perfil);
  const v = d ? linha[d.j] : null;
  return { titulo, detalhe: partes.join(" · "), chave: d ? `${d.rotulo}: ${v === null ? "NULL" : v.trim() || "—"}` : null };
}

/** SQL sugerido para buscar os registros relacionados que ainda não foram colados. */
export function sqlRelacionado(tabela: string, coluna: string, valor: string): string {
  return `SELECT * FROM ${tabela} WHERE ${coluna} = '${valor.replace(/'/g, "''")}';`;
}
