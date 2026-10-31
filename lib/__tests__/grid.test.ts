import { describe, expect, it } from "vitest";
import { gerarFormato, gerarInsert, gerarJSON, gerarMarkdown, gerarTabulado, gerarTextoTabela } from "../exportar";
import { alternarOrdenacao, CHAVE_NULL, filtrarOrdenar, listaOrdenacao, valoresDistintos, type Criterios } from "../filtragem";
import { parsearConsulta } from "../parser";
import { agregarSelecao, limitarSelecao, retangulo } from "../selecao";
import { lerSessao } from "../sessao";
import { formatarSql, tokenizarSql } from "../sql";

const t = parsearConsulta(
  '"UF"\t"COD"\t"VALOR"\t"OBS"\n"SP"\t"010"\t"10.50"\t"a|b"\n"RJ"\t"002"\t"9.00"\t\\N\n"SP"\t"001"\t"1234.00"\t""\n"RJ"\t"003"\t"9.00"\t"it\'s"\n',
);
const base: Criterios = { busca: "", filtros: {}, relacoes: [], ordenacao: [], visiveis: [] };

describe("ordenação por várias colunas", () => {
  it("ordena pelo 1º critério e desempata pelo 2º", () => {
    expect(filtrarOrdenar(t, { ...base, ordenacao: [{ coluna: 0, desc: false }, { coluna: 2, desc: true }] })).toEqual([1, 3, 2, 0]);
    expect(filtrarOrdenar(t, { ...base, ordenacao: [{ coluna: 2, desc: false }, { coluna: 1, desc: false }] })).toEqual([1, 3, 0, 2]);
  });
  it("aceita o formato antigo (um critério ou null)", () => {
    expect(listaOrdenacao(null)).toEqual([]);
    expect(listaOrdenacao({ coluna: 1, desc: true })).toEqual([{ coluna: 1, desc: true }]);
    expect(filtrarOrdenar(t, { ...base, ordenacao: { coluna: 1, desc: false } })).toEqual([2, 1, 3, 0]);
  });
  it("clique alterna; Shift+clique acumula", () => {
    let o = alternarOrdenacao([], 0, false);
    expect(o).toEqual([{ coluna: 0, desc: false }]);
    o = alternarOrdenacao(o, 2, true);
    expect(o).toEqual([{ coluna: 0, desc: false }, { coluna: 2, desc: false }]);
    o = alternarOrdenacao(o, 2, true);
    expect(o).toEqual([{ coluna: 0, desc: false }, { coluna: 2, desc: true }]);
    expect(alternarOrdenacao(o, 2, true)).toEqual([{ coluna: 0, desc: false }]);
    // sem Shift: volta a ordenar só pela coluna clicada
    expect(alternarOrdenacao(o, 2, false)).toEqual([{ coluna: 2, desc: false }]);
    expect(alternarOrdenacao([{ coluna: 2, desc: false }], 2, false)).toEqual([{ coluna: 2, desc: true }]);
    expect(alternarOrdenacao([{ coluna: 2, desc: true }], 2, false)).toEqual([]);
  });
});

describe("filtro por valores", () => {
  it("lista os distintos com contagem, NULL e vazio separados", () => {
    expect(valoresDistintos(t, 0, [0, 1, 2, 3]).map((d) => [d.chave, d.qtd])).toEqual([["RJ", 2], ["SP", 2]]);
    const obs = valoresDistintos(t, 3, [0, 1, 2, 3]);
    expect(obs.map((d) => d.chave).sort()).toEqual(["", CHAVE_NULL, "a|b", "it's"].sort());
  });
  it("mantém só as linhas com os valores marcados", () => {
    expect(filtrarOrdenar(t, { ...base, valores: { 0: ["RJ"] } })).toEqual([1, 3]);
    expect(filtrarOrdenar(t, { ...base, valores: { 3: [CHAVE_NULL, ""] } })).toEqual([1, 2]);
    expect(filtrarOrdenar(t, { ...base, valores: { 0: [] } })).toEqual([]);
  });
});

describe("seleção de células", () => {
  it("retângulo independe da direção e é limitado à grade", () => {
    expect(retangulo({ ancora: { r: 3, c: 2 }, foco: { r: 1, c: 0 } })).toEqual({ r0: 1, r1: 3, c0: 0, c1: 2 });
    expect(limitarSelecao({ ancora: { r: 9, c: 9 }, foco: { r: 0, c: 0 } }, 4, 2)).toEqual({ ancora: { r: 3, c: 1 }, foco: { r: 0, c: 0 } });
    expect(limitarSelecao({ ancora: { r: 0, c: 0 }, foco: { r: 0, c: 0 } }, 0, 2)).toBeNull();
  });
  it("agrega contagem, soma, média, mín, máx e distintos", () => {
    const ag = agregarSelecao(t, [0, 1, 2, 3], [0, 1, 2, 3], { r0: 0, r1: 3, c0: 2, c1: 3 });
    expect(ag).toMatchObject({ celulas: 8, linhas: 4, colunas: 2, nulos: 1, numeros: 4, soma: 1262.5, min: 9, max: 1234, casas: 2 });
    expect(ag.media).toBeCloseTo(315.625);
    expect(ag.preenchidas).toBe(6);
    // texto sem números: sem soma
    expect(agregarSelecao(t, [0, 1], [0], { r0: 0, r1: 1, c0: 0, c1: 0 }).soma).toBeNull();
  });
});

describe("formatos de cópia", () => {
  const L = [0, 1];
  const C = [1, 2, 3];
  it("tabulado sem cabeçalho (Ctrl+C)", () => {
    expect(gerarTabulado(t, L, C, false)).toBe("010\t10.50\ta|b\n002\t9.00\tNULL");
  });
  it("JSON mantém códigos com zero à esquerda como texto", () => {
    expect(JSON.parse(gerarJSON(t, L, C))).toEqual([
      { COD: "010", VALOR: 10.5, OBS: "a|b" },
      { COD: "002", VALOR: 9, OBS: null },
    ]);
  });
  it("Markdown escapa a barra vertical e alinha números à direita", () => {
    const md = gerarMarkdown(t, L, C).split("\n");
    expect(md[1]).toBe("| --- | ---: | --- |");
    expect(md[2]).toBe("| 010 | 10,50 | a\\|b |");
  });
  it("INSERT com aspas escapadas e NULL", () => {
    expect(gerarInsert(t, [3, 1], [0, 3], "T")).toBe("INSERT INTO T (UF, OBS) VALUES ('RJ', 'it''s');\nINSERT INTO T (UF, OBS) VALUES ('RJ', NULL);");
    expect(gerarInsert(t, [0], [1, 2], "T")).toBe("INSERT INTO T (COD, VALOR) VALUES ('010', 10.50);");
  });
  it("texto alinhado como o cliente mysql", () => {
    expect(gerarTextoTabela(t, L, [0, 2])).toBe(
      ["+----+-------+", "| UF | VALOR |", "+----+-------+", "| SP | 10,50 |", "| RJ |  9,00 |", "+----+-------+"].join("\n"),
    );
  });
  it("CSV sem BOM ao copiar", () => {
    expect(gerarFormato("csv", t, [0], [0], "T").startsWith("UF")).toBe(true);
  });
});

describe("SQL", () => {
  it("reconhece palavras-chave, textos, números e identificadores", () => {
    const tipos = tokenizarSql("SELECT * FROM FATGOR WHERE FGO_NUMPOK = 'MLB_X' AND n = 10;")
      .filter((k) => k.tipo !== "espaco")
      .map((k) => `${k.tipo}:${k.texto}`);
    expect(tipos).toEqual([
      "palavra:SELECT", "pontuacao:*", "palavra:FROM", "identificador:FATGOR", "palavra:WHERE", "identificador:FGO_NUMPOK",
      "pontuacao:=", "texto:'MLB_X'", "palavra:AND", "identificador:n", "pontuacao:=", "numero:10", "pontuacao:;",
    ]);
  });
  it("quebra linhas de um SELECT longo, sem mexer dentro de parênteses e textos", () => {
    const sql = "SELECT * FROM FATGOR WHERE FGO_NUMPOK IN ('A where b', 'MLB_SHML48393430410') AND FGO_CODEMP = '001' ORDER BY FGO_DTAENT;";
    expect(formatarSql(sql)).toBe(
      "SELECT *\nFROM FATGOR\nWHERE FGO_NUMPOK IN ('A where b', 'MLB_SHML48393430410')\n  AND FGO_CODEMP = '001'\nORDER BY FGO_DTAENT;",
    );
    expect(formatarSql("SELECT * FROM T;")).toBe("SELECT * FROM T;");
    expect(formatarSql("SELECT a\nFROM t LEFT JOIN u ON 1")).toBe("SELECT a\nFROM t LEFT JOIN u ON 1");
  });
});

describe("sessão salva antes dos novos campos", () => {
  it("converte a ordenação antiga e completa os filtros por valor", () => {
    const antiga = JSON.stringify({
      app: "sql-viewer",
      versao: 1,
      salvoEm: "",
      ativa: "a",
      abas: [{ id: "a", nome: "X", dados: t, perfilId: null, ordenacao: { coluna: 2, desc: true }, selecionadas: [] }],
    });
    const aba = lerSessao(antiga).abas[0];
    expect(aba.ordenacao).toEqual([{ coluna: 2, desc: true }]);
    expect(aba.filtrosValores).toEqual({});
    expect(aba.transposta).toBe(false);
  });
});
