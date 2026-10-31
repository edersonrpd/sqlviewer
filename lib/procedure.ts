import { PERFIS } from "@/config/perfis";
import { formatarData } from "./formatacao";
import type { Valor } from "./tipos";

/**
 * Leitura das regras de uma procedure (ex.: esp_InserePedidosFATAUT, que alimenta a
 * fila do faturamento automático). Cada cliente tem a sua, com regras próprias; aqui
 * nada é fixo: as regras saem do próprio código colado — tabelas exigidas, condições
 * do WHERE, pedidos retirados, regras desativadas e os requisitos citados nos comentários.
 *
 * Não é um parser completo de SQL: reconhece o suficiente para listar e explicar as regras.
 */

type Token = { t: "palavra" | "texto" | "numero" | "pont" | "comentario"; v: string; linha: number; linhaFim: number };

function lexer(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let linha = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "\n") {
      linha++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const ini = linha;
    // comentários: # …, -- …, /* … */
    if (c === "#" || (c === "-" && src[i + 1] === "-" && /[\s]/.test(src[i + 2] ?? " "))) {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      tokens.push({ t: "comentario", v: src.slice(i, j), linha: ini, linhaFim: ini });
      i = j;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2);
      j = j < 0 ? n : j + 2;
      const v = src.slice(i, j);
      linha += (v.match(/\n/g) ?? []).length;
      tokens.push({ t: "comentario", v, linha: ini, linhaFim: linha });
      i = j;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\" && c !== "`") j += 2;
        else if (src[j] === c && src[j + 1] === c) j += 2;
        else if (src[j] === c) break;
        else j++;
      }
      const v = src.slice(i, j + 1);
      linha += (v.match(/\n/g) ?? []).length;
      // `nome` é identificador
      tokens.push(c === "`" ? { t: "palavra", v: v.slice(1, -1), linha: ini, linhaFim: linha } : { t: "texto", v, linha: ini, linhaFim: linha });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i, i + 40));
    if (num) {
      tokens.push({ t: "numero", v: num[0], linha, linhaFim: linha });
      i += num[0].length;
      continue;
    }
    const pal = /^[A-Za-z_@$][\w@$]*(\.(\*|[\w@$]+))*/.exec(src.slice(i, i + 200));
    if (pal) {
      tokens.push({ t: "palavra", v: pal[0], linha, linhaFim: linha });
      i += pal[0].length;
      continue;
    }
    const op = /^(<>|<=|>=|!=|:=)/.exec(src.slice(i, i + 2));
    const v = op ? op[0] : c;
    tokens.push({ t: "pont", v, linha, linhaFim: linha });
    i += v.length;
  }
  return tokens;
}

const P = (tk: Token | undefined, ...palavras: string[]) => !!tk && tk.t === "palavra" && palavras.includes(tk.v.toUpperCase());

const PALAVRAS_CHAVE = new Set(
  "IN AND OR NOT ON WHERE FROM JOIN EXISTS THEN ELSE WHEN SELECT BY AS VALUES INTO IS LIKE HAVING CASE END SET TABLE IF".split(" "),
);

/** Junta os tokens num texto SQL legível (uma linha). */
function textoSql(tokens: Token[]): string {
  return tokens
    .filter((t) => t.t !== "comentario")
    .map((t) => t.v)
    .join(" ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    // função colada no parêntese (IFNULL(…), COUNT(0)); palavras-chave mantêm o espaço (IN (…))
    .replace(/\b([A-Za-z_]\w*)\s+\(/g, (m, w: string) => (PALAVRAS_CHAVE.has(w.toUpperCase()) ? m : `${w}(`))
    .trim();
}

/** Texto de um comentário sem os marcadores (#, --, /* *\/). */
export function textoComentario(v: string): string {
  return v
    .replace(/^\/\*+|\*+\/$/g, "")
    .replace(/^(#|--)\s?/, "")
    .trim();
}

/** Números de requisito citados (REQ:445754, REQUISITO 381416, Req: 425923…). */
export function requisitos(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\bREQ(?:UISITO)?\b\s*[:.]?\s*(\d{4,})/gi)].map((m) => m[1]))];
}

// ---------------------------------------------------------------------------
// estrutura da procedure

export type Juncao = {
  tipo: "INNER" | "LEFT" | "RIGHT" | "CROSS";
  tabela: string;
  apelido: string | null;
  on: string;
  /** explicação quando a ligação tem valor fixo (ex.: EMP_CODEMP IN ('001', …)) */
  descricao: string | null;
  nota: string | null;
  requisitos: string[];
};
export type Condicao = { sql: string; descricao: string | null; nota: string | null; requisitos: string[] };
export type CondicaoDesativada = { sql: string; nota: string | null; requisitos: string[] };
export type ColunaCalculada = { nome: string; sql: string };

export type Etapa = {
  tipo: "monta" | "retira" | "insere" | "atualiza";
  /** tabela criada/alterada (ex.: TMP_FGO_ROBO, FATAUT) */
  alvo: string;
  /** tabelas lidas no FROM e nos JOINs (fora as temporárias de controle) */
  origens: string[];
  /** primeira tabela do FROM, mesmo temporária (ex.: TMP_PEDIDOS_A_INSERIR) */
  de: string | null;
  juncoes: Juncao[];
  condicoes: Condicao[];
  desativadas: CondicaoDesativada[];
  agrupamento: string | null;
  having: Condicao | null;
  calculadas: ColunaCalculada[];
  /** para "retira": comparações com valor fixo que tiram o pedido (ex.: FDO_NUMLOT = 'A DEFINIR') */
  retiraSe: Condicao[];
  /** "IF (…) THEN" em volta do comando */
  quando: string | null;
  notas: string[];
};

export type Variavel = { nome: string; tipo: string; valor: string; nota: string | null };
export type BlocoDesativado = { titulo: string; sql: string; requisitos: string[] };

export type AnaliseProcedure = {
  nome: string;
  variaveis: Variavel[];
  etapas: Etapa[];
  blocosDesativados: BlocoDesativado[];
  /** tabelas gravadas fora as temporárias e de log (ex.: FATAUT) */
  grava: string[];
  /** tabelas lidas, fora as temporárias */
  le: string[];
};

/** O texto colado é uma procedure (ou function) e não o resultado de uma consulta? */
export function pareceProcedure(texto: string): boolean {
  return /\bCREATE\s+(DEFINER\s*=\s*\S+\s+)?(PROCEDURE|FUNCTION)\b/i.test(texto.slice(0, 20000));
}

const TERMINA_CLAUSULA = ["GROUP", "ORDER", "HAVING", "LIMIT", "UNION", "INTO"];
const TERMINA_JUNCAO = ["INNER", "LEFT", "RIGHT", "CROSS", "JOIN", "WHERE", ...TERMINA_CLAUSULA];
const TEMPORARIA = /^(TMP_|TEMP_|#)/i;
const DE_CONTROLE = /^(LOG|LOGNOT|LOG_ROTNOT)/i;

/** Divide os tokens no `;`. O comentário na mesma linha depois do `;` fica com o comando anterior. */
function comandos(tokens: Token[]): Token[][] {
  const res: Token[][] = [];
  let atual: Token[] = [];
  let linhaFim = -1;
  for (const tk of tokens) {
    if (tk.t === "comentario" && tk.linha === linhaFim && res.length) {
      res[res.length - 1].push(tk);
      continue;
    }
    if (tk.t === "pont" && tk.v === ";") {
      res.push(atual);
      atual = [];
      linhaFim = tk.linha;
      continue;
    }
    atual.push(tk);
  }
  if (atual.length) res.push(atual);
  return res;
}

/** Profundidade de parênteses de cada token (antes de abrir/depois de fechar). */
function profundidades(tokens: Token[]): number[] {
  let d = 0;
  return tokens.map((tk) => {
    if (tk.t === "pont" && tk.v === ")") d--;
    const atual = d;
    if (tk.t === "pont" && tk.v === "(") d++;
    return atual;
  });
}

/** Fim (exclusivo) de uma cláusula que começa em `ini` na profundidade `d`. */
function fimClausula(tokens: Token[], prof: number[], ini: number, d: number, terminadores: string[]): number {
  for (let k = ini; k < tokens.length; k++) {
    const tk = tokens[k];
    if (tk.t === "comentario") continue;
    if (prof[k] < d) return k;
    if (prof[k] === d && tk.t === "palavra" && terminadores.includes(tk.v.toUpperCase())) return k;
  }
  return tokens.length;
}

/** Divide em AND no nível de cima (respeitando BETWEEN … AND …). */
function dividirAnd(tokens: Token[]): Token[][] {
  const prof = profundidades(tokens);
  const partes: Token[][] = [];
  let atual: Token[] = [];
  let between = false;
  tokens.forEach((tk, k) => {
    if (prof[k] === 0 && P(tk, "BETWEEN")) between = true;
    if (prof[k] === 0 && P(tk, "AND")) {
      if (between) between = false;
      else {
        partes.push(atual);
        atual = [];
        return;
      }
    }
    atual.push(tk);
  });
  partes.push(atual);
  return partes.filter((p) => p.some((t) => t.t !== "comentario"));
}

function notaDe(comentarios: Token[], linhaIni: number, linhaFim: number): string | null {
  const ns = comentarios.filter((c) => c.linha >= linhaIni && c.linha <= linhaFim).map((c) => textoComentario(c.v));
  return ns.length ? ns.join(" · ") : null;
}

/** Comentário que é uma condição desligada (ex.: `# AND FGO_ESTADO <> 'SP'`)? */
function condicaoComentada(v: string): CondicaoDesativada | null {
  const t = textoComentario(v);
  const m = /^(AND|OR)\b\s*([\s\S]+)$/i.exec(t);
  if (!m) return null;
  // depois da condição pode vir outro comentário com o motivo (ex.: "# REGRA … REMOVIDA NO REQUISITO 341311")
  const [sql, ...resto] = m[2].split(/\s#\s?|\s--\s/);
  const nota = resto.join(" ").trim() || null;
  return { sql: sql.trim(), nota, requisitos: requisitos(m[2]) };
}

function analisarComando(tk: Token[], apelidosGlobais: Map<string, string>): Etapa | null {
  const codigo = tk.filter((t) => t.t !== "comentario");
  const comentarios = tk.filter((t) => t.t === "comentario");
  if (codigo.length === 0) return null;
  const up = (k: number) => codigo[k]?.v.toUpperCase();

  let tipo: Etapa["tipo"] | null = null;
  let alvo = "";
  let quando: string | null = null;
  let inicio = 0;
  for (let k = 0; k < codigo.length; k++) {
    if (up(k) === "CREATE" && up(k + 1) === "TABLE") {
      tipo = "monta";
      alvo = codigo[k + 2]?.v ?? "";
      if (alvo.toUpperCase() === "IF") alvo = codigo[k + 5]?.v ?? "";
      inicio = k;
      break;
    }
    if (up(k) === "DELETE" && k === 0) {
      tipo = "retira";
      const f = codigo.findIndex((t, x) => x > k && P(t, "FROM"));
      alvo = (codigo[f + 1]?.v ?? codigo[k + 1]?.v ?? "").replace(/\.\*$/, "");
      inicio = k;
      break;
    }
    if (up(k) === "INSERT" && up(k + 1) === "INTO") {
      alvo = codigo[k + 2]?.v.replace(/\(.*/, "") ?? "";
      tipo = "insere";
      inicio = k;
      // IF ( … ) THEN INSERT …
      if (P(codigo[0], "IF")) {
        const t = codigo.findIndex((x) => P(x, "THEN"));
        if (t > 0 && t < k) quando = textoSql(codigo.slice(1, t));
      }
      break;
    }
    if (up(k) === "UPDATE" && k === 0) {
      tipo = "atualiza";
      alvo = codigo[k + 1]?.v ?? "";
      inicio = k;
      break;
    }
  }
  if (!tipo || !alvo || DE_CONTROLE.test(alvo)) return null;

  const corpo = codigo.slice(inicio);
  const prof = profundidades(corpo);
  const apelidos = new Map<string, string>(apelidosGlobais);
  const origens: string[] = [];
  const juncoes: Juncao[] = [];
  const condicoes: Condicao[] = [];
  const retiraSe: Condicao[] = [];
  const calculadas: ColunaCalculada[] = [];
  let agrupamento: string | null = null;
  let having: Condicao | null = null;
  let de: string | null = null;

  const tabelaEApelido = (k: number) => {
    const tabela = corpo[k]?.v ?? "";
    const prox = corpo[k + 1];
    let apelido: string | null = null;
    if (P(prox, "AS")) apelido = corpo[k + 2]?.v ?? null;
    else if (prox?.t === "palavra" && !P(prox, "ON", "WHERE", "INNER", "LEFT", "RIGHT", "CROSS", "JOIN", "GROUP", "ORDER", "HAVING", "SET", "USING"))
      apelido = prox.v;
    if (apelido) apelidos.set(apelido.toUpperCase(), tabela);
    return { tabela, apelido };
  };

  for (let k = 0; k < corpo.length; k++) {
    const t = corpo[k];
    if (t.t !== "palavra") continue;
    const u = t.v.toUpperCase();
    if (u === "FROM" && corpo[k + 1]?.t === "palavra") {
      const { tabela } = tabelaEApelido(k + 1);
      if (!de && tabela.toUpperCase() !== alvo.toUpperCase() && !/^\(/.test(tabela)) de = tabela;
      if (!TEMPORARIA.test(tabela) && !origens.includes(tabela) && tabela.toUpperCase() !== alvo.toUpperCase()) origens.push(tabela);
    }
    if (u === "JOIN") {
      const antes = corpo[k - 1]?.v.toUpperCase();
      const tipoJ = (["INNER", "LEFT", "RIGHT", "CROSS"].includes(antes) ? antes : antes === "OUTER" ? corpo[k - 2]?.v.toUpperCase() : "INNER") as Juncao["tipo"];
      const { tabela, apelido } = tabelaEApelido(k + 1);
      const on = corpo.findIndex((x, y) => y > k && P(x, "ON"));
      const fim = fimClausula(corpo, prof, k + 1, prof[k], TERMINA_JUNCAO);
      const onTokens = on > 0 && on < fim ? corpo.slice(on + 1, fim) : [];
      const linhas = tk.filter((x) => x.t !== "comentario" && x.linha >= t.linha && x.linha <= (corpo[fim - 1]?.linhaFim ?? t.linha));
      const nota = notaDe(comentarios, t.linha, linhas.at(-1)?.linhaFim ?? t.linha);
      const onSql = textoSql(onTokens);
      const comValor = onTokens.some((x) => x.t === "texto" || x.t === "numero");
      juncoes.push({ tipo: tipoJ, tabela, apelido, on: onSql, descricao: comValor && tipo !== "retira" ? descreverCondicao(onSql, apelidos) : null, nota, requisitos: requisitos(nota ?? "") });
      if (!TEMPORARIA.test(tabela) && !origens.includes(tabela)) origens.push(tabela);
      // DELETE … JOIN … ON chave AND B.COLUNA = 'valor': a comparação com valor fixo é a regra
      if (tipo === "retira") {
        for (const parte of dividirAnd(onTokens)) {
          if (!parte.some((x) => x.t === "texto" || x.t === "numero")) continue;
          const sql = textoSql(parte);
          retiraSe.push({ sql, descricao: descreverCondicao(sql, apelidos), nota, requisitos: requisitos(nota ?? "") });
        }
      }
    }
    if (u === "WHERE") {
      const fim = fimClausula(corpo, prof, k + 1, prof[k], TERMINA_CLAUSULA);
      for (const parte of dividirAnd(corpo.slice(k + 1, fim))) {
        const sql = textoSql(parte);
        if (/^TRUE$/i.test(sql) || /^1\s*=\s*1$/.test(sql)) continue;
        const nota = notaDe(comentarios.filter((c) => !condicaoComentada(c.v)), parte[0].linha, parte.at(-1)!.linhaFim);
        condicoes.push({ sql, descricao: descreverCondicao(sql, apelidos), nota, requisitos: requisitos(nota ?? "") });
      }
    }
    if (u === "GROUP" && corpo[k + 1] && P(corpo[k + 1], "BY")) {
      const fim = fimClausula(corpo, prof, k + 2, prof[k], ["HAVING", "ORDER", "LIMIT", "UNION"]);
      agrupamento = textoSql(corpo.slice(k + 2, fim));
    }
    if (u === "HAVING") {
      const fim = fimClausula(corpo, prof, k + 1, prof[k], ["ORDER", "LIMIT", "UNION"]);
      const sql = textoSql(corpo.slice(k + 1, fim));
      having = { sql, descricao: descreverCondicao(sql, apelidos), nota: null, requisitos: [] };
    }
    if (u === "CASE") {
      let nivel = 0;
      let fim = k;
      for (let y = k; y < corpo.length; y++) {
        if (P(corpo[y], "CASE")) nivel++;
        if (P(corpo[y], "END") && --nivel === 0) {
          fim = y;
          break;
        }
      }
      const nomeTk = P(corpo[fim + 1], "AS") ? corpo[fim + 2] : corpo[fim + 1];
      if (nomeTk?.t === "palavra" && !P(nomeTk, "FROM")) calculadas.push({ nome: nomeTk.v, sql: textoSql(corpo.slice(k, fim + 1)) });
      k = fim;
    }
  }

  // condições desligadas por comentário dentro do comando (ex.: "# AND …", "-- AND …")
  const desativadas = comentarios.map((c) => condicaoComentada(c.v)).filter((c): c is CondicaoDesativada => c !== null);
  // demais comentários do comando que não ficaram em nenhuma condição/junção (ex.: motivo do DELETE)
  const usados = new Set([...condicoes.map((c) => c.nota), ...juncoes.map((j) => j.nota)].filter(Boolean).flatMap((n) => n!.split(" · ")));
  const notas = comentarios
    .filter((c) => !condicaoComentada(c.v) && !c.v.includes("\n"))
    .map((c) => textoComentario(c.v))
    .filter((n) => n && !usados.has(n) && !/^[-=#\s]*$/.test(n) && !/^SELECT \* FROM/i.test(n));

  return { tipo, alvo, origens, de, juncoes, condicoes, desativadas, agrupamento, having, calculadas, retiraSe, quando, notas: [...new Set(notas)] };
}

export function analisarProcedure(texto: string): AnaliseProcedure {
  const tokens = lexer(texto);
  const nome = /\b(?:PROCEDURE|FUNCTION)\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([\w.]+)`?\s*\(/i.exec(texto)?.[1] ?? "procedure";

  const variaveis: Variavel[] = [];
  for (let k = 0; k < tokens.length; k++) {
    if (!P(tokens[k], "DECLARE") || P(tokens[k + 1], "CONTINUE", "EXIT", "CURSOR") || P(tokens[k + 2], "CURSOR", "CONDITION", "HANDLER")) continue;
    const d = tokens.findIndex((t, y) => y > k && P(t, "DEFAULT"));
    const pv = tokens.findIndex((t, y) => y > k && t.t === "pont" && t.v === ";");
    if (d < 0 || pv < 0 || d > pv) continue;
    const nota = tokens.find((t, y) => y > pv && t.t === "comentario" && t.linha === tokens[pv].linha);
    variaveis.push({
      nome: tokens[k + 1].v,
      tipo: textoSql(tokens.slice(k + 2, d)),
      valor: textoSql(tokens.slice(d + 1, pv)),
      nota: nota ? textoComentario(nota.v) : null,
    });
  }

  // blocos /* … */ de várias linhas com SQL dentro: regras removidas
  const blocosDesativados: BlocoDesativado[] = tokens
    .filter((t) => t.t === "comentario" && t.v.startsWith("/*") && t.v.includes("\n") && /\b(SELECT|DELETE|WHERE|AND)\b/i.test(t.v))
    .map((t) => {
      const corpo = textoComentario(t.v);
      const [primeira, ...resto] = corpo.split("\n");
      return { titulo: primeira.trim(), sql: resto.join("\n").replace(/^\n+|\s+$/g, ""), requisitos: requisitos(corpo) };
    });

  const apelidos = new Map<string, string>();
  const etapas = comandos(tokens.filter((t) => !(t.t === "comentario" && t.v.startsWith("/*") && t.v.includes("\n"))))
    .map((c) => analisarComando(c, apelidos))
    .filter((e): e is Etapa => e !== null);

  const grava = [...new Set(etapas.filter((e) => e.tipo !== "monta" && !TEMPORARIA.test(e.alvo)).map((e) => e.alvo))];
  const le = [...new Set(etapas.flatMap((e) => e.origens))].filter((t) => !grava.includes(t) || etapas.some((e) => e.juncoes.some((j) => j.tabela === t)));
  return { nome, variaveis, etapas, blocosDesativados, grava, le };
}

// ---------------------------------------------------------------------------
// explicação em português

/** Rótulos das colunas usados nas Telas dos perfis (ex.: FGO_LIBERA → "Liberação"). */
const ROTULOS = (() => {
  const m = new Map<string, string>();
  const visitar = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(visitar);
    const r = o as Record<string, unknown>;
    if (typeof r.coluna === "string" && typeof r.rotulo === "string" && !m.has(r.coluna)) m.set(r.coluna, r.rotulo);
    Object.values(r).forEach(visitar);
  };
  visitar(PERFIS.map((p) => p.tela));
  return m;
})();

const semPrefixo = (col: string) => col.replace(/^.*\./, "");
function nomeColuna(col: string): string {
  const r = ROTULOS.get(semPrefixo(col));
  return r ? `${col} (${r})` : col;
}
function literal(v: string): string {
  const s = v.replace(/^'([\s\S]*)'$/, "$1").replace(/''/g, "'");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatarData(s) : s === "" ? "vazio" : s;
}
function listaLiterais(v: string): string[] {
  return [...v.matchAll(/'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)/g)].map((m) => literal(m[0]));
}
function tirarParenteses(s: string): string {
  let t = s.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    let d = 0;
    let fechaNoFim = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "(") d++;
      if (t[i] === ")") d--;
      if (d === 0 && i < t.length - 1) {
        fechaNoFim = false;
        break;
      }
    }
    if (!fechaNoFim) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}
/** Divide no operador lógico (OR/AND) de nível zero, fora de textos. */
function dividirLogico(s: string, op: "OR" | "AND"): string[] {
  const partes: string[] = [];
  let d = 0;
  let aspas = false;
  let ini = 0;
  const re = new RegExp(`^\\s${op}\\s`, "i");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") aspas = !aspas;
    if (aspas) continue;
    if (c === "(") d++;
    if (c === ")") d--;
    if (d === 0 && re.test(s.slice(i, i + op.length + 2))) {
      partes.push(s.slice(ini, i));
      ini = i + op.length + 2;
    }
  }
  partes.push(s.slice(ini));
  return partes.map((p) => p.trim()).filter(Boolean);
}

const OPS: Record<string, string> = { "=": "igual a", "<>": "diferente de", "!=": "diferente de", ">": "maior que", "<": "menor que", ">=": "maior ou igual a", "<=": "menor ou igual a" };
const COL = String.raw`([A-Za-z_][\w.]*)`;
const LIT = String.raw`('(?:[^']|'')*'|-?\d+(?:\.\d+)?|TRUE|FALSE)`;

/** Explicação curta de uma condição (null quando não há uma explicação simples; aí vale o SQL). */
export function descreverCondicao(sql: string, apelidos: Map<string, string> = new Map()): string | null {
  const s = tirarParenteses(sql);
  const ors = dividirLogico(s, "OR");
  if (ors.length > 1) {
    const ds = ors.map((p) => descreverCondicao(p, apelidos) ?? p);
    return `Pelo menos uma: ${ds.join("; ou ")}`;
  }
  const ands = dividirLogico(s, "AND");
  if (ands.length > 1 && !/\bBETWEEN\b/i.test(s)) return ands.map((p) => descreverCondicao(p, apelidos) ?? p).join("; e ");
  let m: RegExpExecArray | null;
  if ((m = new RegExp(String.raw`^IFNULL\(\s*${COL}\s*,\s*''\s*\)\s*(<>|!=)\s*''$`, "i").exec(s))) return `${nomeColuna(m[1])} preenchido (nem vazio nem NULL)`;
  if ((m = new RegExp(String.raw`^IFNULL\(\s*${COL}\s*,\s*''\s*\)\s*=\s*''$`, "i").exec(s))) return `${nomeColuna(m[1])} vazio ou NULL`;
  if ((m = new RegExp(String.raw`^${COL}\s+(NOT\s+)?IN\s*\((.*)\)$`, "is").exec(s))) {
    const vals = listaLiterais(m[3]);
    return `${nomeColuna(m[1])} ${m[2] ? "não é nenhum destes" : vals.length === 1 ? "igual a" : "é um destes"}: ${vals.join(", ")}`;
  }
  if ((m = new RegExp(String.raw`^${COL}\s+(NOT\s+)?LIKE\s+'((?:[^']|'')*)'$`, "i").exec(s))) {
    const p = m[3];
    const inicio = /^[^%_]+%$/.test(p) ? `começa com "${p.slice(0, -1)}"` : /^[^%_]+_%$/.test(p) ? `começa com "${p.slice(0, -2)}" + 1 caractere` : `segue o padrão ${p}`;
    return `${nomeColuna(m[1])} ${m[2] ? "não " : ""}${inicio}`;
  }
  if ((m = new RegExp(String.raw`^${COL}\s+IS\s+(NOT\s+)?NULL$`, "i").exec(s))) {
    const pref = m[1].includes(".") ? m[1].split(".")[0] : null;
    const tabela = pref ? (apelidos.get(pref.toUpperCase()) ?? pref) : null;
    if (tabela && /AUTOINCREM|^LOG_|_AUT$|FDOAUT$/i.test(semPrefixo(m[1])))
      return m[2] ? `Existe registro em ${tabela}` : `Não existe registro em ${tabela}`;
    return `${nomeColuna(m[1])} ${m[2] ? "preenchido (não NULL)" : "NULL"}`;
  }
  if ((m = new RegExp(String.raw`^${COL}\s+BETWEEN\s+${LIT}\s+AND\s+${LIT}$`, "i").exec(s)))
    return `${nomeColuna(m[1])} entre ${literal(m[2])} e ${literal(m[3])}`;
  if ((m = new RegExp(String.raw`^${COL}\s*(=|<>|!=|>=|<=|>|<)\s*${LIT}$`, "i").exec(s))) {
    const data = /^'\d{4}-\d{2}-\d{2}/.test(m[3]);
    const op = data && m[2] === ">=" ? "a partir de" : data && m[2] === "<=" ? "até" : OPS[m[2]];
    return `${nomeColuna(m[1])} ${op} ${literal(m[3])}`;
  }
  if ((m = /^LOCATE\(\s*'([^']*)'\s*,\s*([\w.]+)\s*\)\s*=\s*0$/i.exec(s))) return `${m[2]} sem nenhum "${m[1]}" (todos precisam atender)`;
  return null;
}

// ---------------------------------------------------------------------------
// conferência com um pedido

/**
 * Valores de uma coluna para o registro conferido: `tabela` é o prefixo usado na
 * procedure (já sem apelido) ou null. undefined = coluna não disponível nas abas abertas;
 * [] = tabela aberta mas sem registro ligado (como num LEFT JOIN sem correspondência).
 */
export type BuscarValores = (tabela: string | null, coluna: string) => Valor[] | undefined;
export type ResultadoRegra = { ok: boolean | null; motivo: string };

const valorLiteral = (v: string) => v.replace(/^'([\s\S]*)'$/, "$1").replace(/''/g, "'");
const ehNumero = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());
function comparar(a: string, op: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  const c = ehNumero(x) && ehNumero(y) ? Number(x) - Number(y) : x < y ? -1 : x > y ? 1 : 0;
  switch (op) {
    case "=":
      return c === 0;
    case "<>":
    case "!=":
      return c !== 0;
    case ">":
      return c > 0;
    case "<":
      return c < 0;
    case ">=":
      return c >= 0;
    case "<=":
      return c <= 0;
  }
  return false;
}

/** Confere uma condição com os valores do registro. ok = null quando não dá para saber com as abas abertas. */
export function avaliarCondicao(sql: string, buscar: BuscarValores, apelidos: Map<string, string> = new Map()): ResultadoRegra {
  const s = tirarParenteses(sql);
  const ors = dividirLogico(s, "OR");
  if (ors.length > 1) {
    const rs = ors.map((p) => avaliarCondicao(p, buscar, apelidos));
    const v = rs.find((r) => r.ok === true);
    if (v) return { ok: true, motivo: v.motivo };
    if (rs.every((r) => r.ok === false)) return { ok: false, motivo: rs.map((r) => r.motivo).join("; ") };
    return { ok: null, motivo: rs.map((r) => r.motivo).join("; ") };
  }
  const ands = dividirLogico(s, "AND");
  if (ands.length > 1 && !/\bBETWEEN\b/i.test(s)) {
    const rs = ands.map((p) => avaliarCondicao(p, buscar, apelidos));
    const f = rs.find((r) => r.ok === false);
    if (f) return f;
    return { ok: rs.every((r) => r.ok === true) ? true : null, motivo: rs.map((r) => r.motivo).join("; ") };
  }
  const col = (nome: string) => {
    const [pref, c] = nome.includes(".") ? [nome.split(".")[0], semPrefixo(nome)] : [null, nome];
    const tabela = pref ? (apelidos.get(pref.toUpperCase()) ?? pref) : null;
    return { tabela, coluna: c, valores: buscar(tabela, c) };
  };
  const indisponivel = (c: { tabela: string | null; coluna: string }) => ({
    ok: null,
    motivo: `${c.tabela ? `${c.tabela}.` : ""}${c.coluna} não está nas abas abertas`,
  });
  // um valor só (coluna do pedido); vários (ex.: itens) não dá para conferir uma regra de pedido
  const unico = (c: ReturnType<typeof col>) => {
    if (!c.valores) return { erro: indisponivel(c) };
    if (c.valores.length > 1) return { erro: { ok: null, motivo: `${c.coluna} tem ${c.valores.length} valores (um por linha ligada)` } };
    return { v: c.valores[0] ?? null };
  };
  const mostrar = (v: Valor) => (v === null ? "NULL" : v === "" ? "vazio" : v);
  let m: RegExpExecArray | null;

  if ((m = new RegExp(String.raw`^IFNULL\(\s*${COL}\s*,\s*''\s*\)\s*(<>|!=|=)\s*''$`, "i").exec(s))) {
    const c = col(m[1]);
    const u = unico(c);
    if ("erro" in u) return u.erro!;
    const preenchido = u.v !== null && u.v.trim() !== "";
    return { ok: m[2] === "=" ? !preenchido : preenchido, motivo: `${c.coluna} = ${mostrar(u.v)}` };
  }
  if ((m = new RegExp(String.raw`^${COL}\s+(NOT\s+)?IN\s*\((.*)\)$`, "is").exec(s))) {
    const c = col(m[1]);
    const u = unico(c);
    if ("erro" in u) return u.erro!;
    const lista = [...m[3].matchAll(/'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)/g)].map((x) => valorLiteral(x[0]));
    const dentro = u.v !== null && lista.some((l) => comparar(u.v!, "=", l));
    return { ok: m[2] ? u.v !== null && !dentro : dentro, motivo: `${c.coluna} = ${mostrar(u.v)}` };
  }
  if ((m = new RegExp(String.raw`^${COL}\s+(NOT\s+)?LIKE\s+'((?:[^']|'')*)'$`, "i").exec(s))) {
    const c = col(m[1]);
    const u = unico(c);
    if ("erro" in u) return u.erro!;
    const re = new RegExp("^" + m[3].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "is");
    const casa = u.v !== null && re.test(u.v);
    return { ok: m[2] ? u.v !== null && !casa : casa, motivo: `${c.coluna} = ${mostrar(u.v)}` };
  }
  if ((m = new RegExp(String.raw`^${COL}\s+IS\s+(NOT\s+)?NULL$`, "i").exec(s))) {
    const c = col(m[1]);
    if (!c.valores) return indisponivel(c);
    // tabela de LEFT JOIN sem registro ligado: a coluna vem NULL
    const algum = c.valores.some((v) => v !== null);
    return { ok: m[2] ? algum : !algum, motivo: c.valores.length === 0 ? `nenhum registro em ${c.tabela ?? c.coluna}` : `${c.coluna} = ${c.valores.map(mostrar).join(", ")}` };
  }
  if ((m = new RegExp(String.raw`^${COL}\s*(=|<>|!=|>=|<=|>|<)\s*${LIT}$`, "i").exec(s))) {
    const c = col(m[1]);
    const u = unico(c);
    if ("erro" in u) return u.erro!;
    if (u.v === null) return { ok: false, motivo: `${c.coluna} = NULL` };
    const lit = /^(TRUE|FALSE)$/i.test(m[3]) ? (m[3].toUpperCase() === "TRUE" ? "1" : "0") : valorLiteral(m[3]);
    return { ok: comparar(u.v, m[2], lit), motivo: `${c.coluna} = ${mostrar(u.v)}` };
  }
  return { ok: null, motivo: "regra complexa: confira pelo SQL" };
}

/** Para as regras de "retira": algum registro ligado (pedido ou itens) bate com a comparação? */
export function algumRegistroBate(sql: string, buscar: BuscarValores, apelidos: Map<string, string> = new Map()): ResultadoRegra {
  const m = new RegExp(String.raw`^${COL}\s*(=|<>|!=|>=|<=|>|<)\s*${LIT}$`, "i").exec(tirarParenteses(sql));
  if (!m) return { ok: null, motivo: "regra complexa: confira pelo SQL" };
  const coluna = semPrefixo(m[1]);
  const pref = m[1].includes(".") ? m[1].split(".")[0] : null;
  const valores = buscar(pref ? (apelidos.get(pref.toUpperCase()) ?? null) : null, coluna) ?? buscar(null, coluna);
  if (!valores) return { ok: null, motivo: `${coluna} não está nas abas abertas` };
  const lit = valorLiteral(m[3]);
  const batem = valores.filter((v) => v !== null && comparar(v, m[2], lit)).length;
  return { ok: batem > 0, motivo: batem ? `${batem} de ${valores.length} linha(s) com ${coluna} ${m[2]} ${lit}` : `nenhuma das ${valores.length} linha(s) tem ${coluna} ${m[2]} ${lit}` };
}

/** Apelidos usados nas junções de uma etapa (ex.: B → TMP_FGO_ROBO), para conferir regras com prefixo. */
export function apelidosDaEtapa(e: Etapa): Map<string, string> {
  return new Map(e.juncoes.filter((j) => j.apelido).map((j) => [j.apelido!.toUpperCase(), j.tabela]));
}
