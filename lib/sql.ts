/**
 * Realce e formatação dos SQL gerados pelo app (Montar consulta, Ver também, JOIN).
 * Não é um parser completo: reconhece o suficiente do MySQL para colorir e quebrar linhas.
 */

export type TipoToken = "palavra" | "funcao" | "texto" | "numero" | "comentario" | "identificador" | "pontuacao" | "espaco" | "outro";
export type Token = { tipo: TipoToken; texto: string };

const PALAVRAS = new Set(
  (
    "select from where and or not in is null as on join left right inner outer cross full union all distinct " +
    "order by group having limit offset asc desc like between exists case when then else end insert into values " +
    "update set delete create table with true false"
  ).split(" "),
);
const FUNCOES = new Set("count sum avg min max coalesce ifnull concat substring trim upper lower date now cast convert".split(" "));

const REGRAS: [TipoToken, RegExp][] = [
  ["espaco", /^\s+/],
  ["comentario", /^(--[^\n]*|#[^\n]*|\/\*[\s\S]*?(\*\/|$))/],
  ["texto", /^'(?:[^'\\]|\\.|'')*('|$)/],
  ["texto", /^"(?:[^"\\]|\\.|"")*("|$)/],
  ["identificador", /^`[^`]*(`|$)/],
  ["numero", /^\d+(\.\d+)?\b/],
  ["outro", /^[A-Za-z_][\w$]*/],
  ["pontuacao", /^(<>|<=|>=|!=|[(),;.*=<>+\-/])/],
];

export function tokenizarSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let resto = sql;
  while (resto) {
    let achou = false;
    for (const [tipo, re] of REGRAS) {
      const m = re.exec(resto);
      if (!m) continue;
      let t: TipoToken = tipo;
      if (tipo === "outro") {
        const p = m[0].toLowerCase();
        // palavra seguida de "(" é função (COUNT(…)); senão, palavra-chave ou nome de tabela/coluna
        if (FUNCOES.has(p) && /^\s*\(/.test(resto.slice(m[0].length))) t = "funcao";
        else if (PALAVRAS.has(p)) t = "palavra";
        else t = "identificador";
      }
      tokens.push({ tipo: t, texto: m[0] });
      resto = resto.slice(m[0].length);
      achou = true;
      break;
    }
    if (!achou) {
      tokens.push({ tipo: "outro", texto: resto[0] });
      resto = resto.slice(1);
    }
  }
  return tokens;
}

// cláusulas que começam linha nova; AND/OR ganham recuo
const QUEBRA = /^(from|where|order|group|having|limit|union|left|right|inner|join|cross)$/i;
const RECUO = /^(and|or)$/i;

/**
 * Quebra em linhas um SQL de uma linha só e longo (ex.: SELECT * FROM T WHERE A IN (…) AND …).
 * SQL que já tem quebras de linha (os JOINs gerados) fica como está.
 */
export function formatarSql(sql: string, limite = 80): string {
  const s = sql.trim();
  if (s.includes("\n") || s.length <= limite) return s;
  const tokens = tokenizarSql(s);
  let out = "";
  let profundidade = 0;
  let anterior: Token | null = null;
  for (const t of tokens) {
    if (t.texto === "(") profundidade++;
    if (t.texto === ")") profundidade = Math.max(0, profundidade - 1);
    const p = t.texto;
    // "LEFT JOIN": quebra antes do LEFT; "ORDER BY": antes do ORDER
    const continuaClausula = anterior && /^(left|right|inner|cross)$/i.test(anterior.texto) && /^(outer|join)$/i.test(p);
    if (t.tipo === "palavra" && profundidade === 0 && !continuaClausula && (QUEBRA.test(p) || RECUO.test(p)) && out) {
      out = out.replace(/\s+$/, "") + "\n" + (RECUO.test(p) ? "  " : "");
    }
    out += t.tipo === "espaco" ? " " : p;
    if (t.tipo !== "espaco") anterior = t;
  }
  return out;
}
