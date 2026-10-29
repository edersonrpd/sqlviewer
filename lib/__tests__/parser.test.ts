import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inferirTipo, parsearConsulta } from "../parser";

const fixture = readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8");

function col(r: ReturnType<typeof parsearConsulta>, nome: string) {
  const j = r.colunas.findIndex((c) => c.nome === nome);
  if (j < 0) throw new Error(`coluna ${nome} não encontrada`);
  return { coluna: r.colunas[j], valores: r.linhas.map((l) => l[j]) };
}

describe("fixture exemplo-fgo.txt", () => {
  const r = parsearConsulta(fixture);

  it("carrega 3 linhas e 178 colunas sem avisos", () => {
    expect(r.linhas).toHaveLength(3);
    expect(r.colunas).toHaveLength(178);
    expect(r.colunas[0].nome).toBe("AUTOINCREM");
    expect(r.colunas[177].nome).toBe("FGO_CORTPD");
    expect(r.avisos).toEqual([]);
    for (const l of r.linhas) expect(l).toHaveLength(178);
  });

  it("preserva o AUTOINCREM de 20 dígitos como texto", () => {
    const { coluna, valores } = col(r, "AUTOINCREM");
    expect(coluna.tipo).toBe("texto");
    expect(valores).toEqual(["00100000000000001001", "00100000000000002001", "00100000000000004001"]);
  });

  it("preserva códigos com zero à esquerda", () => {
    expect(col(r, "FGO_CODEMP").valores).toEqual(["001", "001", "001"]);
    expect(col(r, "FGO_CODEMP").coluna.tipo).toBe("texto");
    expect(col(r, "FGO_NUMDOC").valores[2]).toBe("000001000004");
    expect(col(r, "FGO_NUMDOC").coluna.tipo).toBe("texto");
    expect(col(r, "FGO_CODCLI").valores).toEqual(["00000345", "00000493", "00001135"]);
  });

  it("detecta decimais mantendo o raw", () => {
    const vlr = col(r, "FGO_VLRCON");
    expect(vlr.coluna.tipo).toBe("decimal");
    expect(vlr.coluna.casas).toBe(2);
    expect(vlr.valores).toEqual(["26.64", "31.06", "165.49"]);
    const zero = col(r, "FGO_VALS01");
    expect(zero.coluna.tipo).toBe("decimal");
    expect(zero.coluna.casas).toBe(4);
    expect(zero.valores[0]).toBe("0.0000");
  });

  it("detecta data, hora e inteiro", () => {
    expect(col(r, "FGO_DTAENT").coluna.tipo).toBe("data");
    expect(col(r, "FGO_HORENT").coluna.tipo).toBe("hora");
    expect(col(r, "FGO_TIPFRE").coluna.tipo).toBe("inteiro");
    // data com NULL em uma das linhas continua sendo data
    expect(col(r, "FGO_DTAFAT").valores).toEqual(["2024-10-14", "2024-10-14", null]);
    expect(col(r, "FGO_DTAFAT").coluna.tipo).toBe("data");
  });

  it("diferencia \\N (NULL) de \"\" (vazio)", () => {
    expect(col(r, "FGO_NOMCON").valores).toEqual([null, null, null]);
    expect(col(r, "FGO_SERIE_").valores).toEqual(["", "", ""]);
    expect(col(r, "FGO_NUMFAT").valores).toEqual(["000000053684", "000000053685", ""]);
  });

  it("lê texto com espaços e dois-pontos", () => {
    expect(col(r, "FGO_MOTBAI").valores[2]).toBe("DADOS BAIXA: 14/10/2024 - 09:51:23 OPE: 001 - DEBORA");
  });

  it("aceita CRLF e linhas vazias no final", () => {
    const r2 = parsearConsulta(fixture.replace(/\n/g, "\r\n") + "\r\n\r\n\r\n");
    expect(r2.linhas).toHaveLength(3);
    expect(r2.avisos).toEqual([]);
    expect(r2.linhas[2][177]).toBe("N");
  });
});

describe("NULL, vazio e texto \"NULL\"", () => {
  it("\\N e NULL sem aspas são NULL; \"NULL\" entre aspas é texto; \"\" é vazio", () => {
    const r = parsearConsulta('"A"\t"B"\t"C"\t"D"\n\\N\tNULL\t"NULL"\t""\n');
    expect(r.linhas).toEqual([[null, null, "NULL", ""]]);
  });

  it("valores sem aspas são lidos como texto", () => {
    const r = parsearConsulta("A\tB\tC\n001\t165.49\tabc\n");
    expect(r.linhas).toEqual([["001", "165.49", "abc"]]);
    expect(r.colunas.map((c) => c.tipo)).toEqual(["texto", "decimal", "texto"]);
  });
});

describe("preservação de códigos", () => {
  it("\"001\", \"000001000004\" e chave de 20 dígitos não são convertidos", () => {
    const r = parsearConsulta('"A"\t"B"\t"C"\n"001"\t"000001000004"\t"00100000000000004001"\n"002"\t"000001000005"\t"12345678901234567890"\n');
    expect(r.linhas[0]).toEqual(["001", "000001000004", "00100000000000004001"]);
    expect(r.linhas[1][2]).toBe("12345678901234567890");
    expect(r.colunas.map((c) => c.tipo)).toEqual(["texto", "texto", "texto"]);
  });

  it("inteiro só sem zero à esquerda e até 15 dígitos", () => {
    expect(inferirTipo(["1", "0", "-5", "123456789012345"]).tipo).toBe("inteiro");
    expect(inferirTipo(["1", "1234567890123456"]).tipo).toBe("texto");
    expect(inferirTipo(["1", "01"]).tipo).toBe("texto");
  });

  it("decimal \"0.0000\" e \"165.49\"", () => {
    expect(inferirTipo(["0.0000", "165.49"])).toEqual({ tipo: "decimal", casas: 4 });
    expect(inferirTipo(["165.49", null, "-2.5"])).toEqual({ tipo: "decimal", casas: 2 });
  });

  it("valores mistos e vazios viram texto", () => {
    expect(inferirTipo(["1", "2.50"]).tipo).toBe("texto");
    expect(inferirTipo(["2024-10-14", ""]).tipo).toBe("texto");
    expect(inferirTipo([null, null]).tipo).toBe("texto");
  });

  it("data-hora", () => {
    expect(inferirTipo(["2024-10-14 08:03:43"]).tipo).toBe("datahora");
  });
});

describe("campos entre aspas com caracteres especiais", () => {
  it("aceita TAB, quebra de linha e aspas escapadas dentro do campo", () => {
    const texto = '"ID"\t"OBS"\t"FIM"\n"1"\t"a\tb\nlinha 2\r\n""citado"" fim"\t"x"\n"2"\t""""\t"y"\n';
    const r = parsearConsulta(texto);
    expect(r.avisos).toEqual([]);
    expect(r.linhas).toEqual([
      ["1", 'a\tb\nlinha 2\r\n"citado" fim', "x"],
      ["2", '"', "y"],
    ]);
  });
});

describe("linhas divergentes", () => {
  it("carrega o que der e avisa as linhas com problema", () => {
    const texto = '"A"\t"B"\t"C"\n"1"\t"2"\t"3"\n"4"\t"5"\n"6"\t"7"\t"8"\t"9"\n"10"\t"11"\t"12"\n';
    const r = parsearConsulta(texto);
    expect(r.linhas).toEqual([
      ["1", "2", "3"],
      ["4", "5", null],
      ["6", "7", "8"],
      ["10", "11", "12"],
    ]);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0].tipo).toBe("colunas-divergentes");
    expect(r.avisos[0].mensagem).toContain("3, 4");
  });

  it("numera as linhas do texto mesmo com quebra de linha dentro de campo", () => {
    const texto = '"A"\t"B"\n"x\ny"\t"1"\n"z"\n';
    const r = parsearConsulta(texto);
    expect(r.avisos[0].mensagem).toContain("Linhas do texto: 4");
  });
});

describe("colunas duplicadas", () => {
  it("renomeia repetições para COLUNA (2), COLUNA (3) e avisa", () => {
    const r = parsearConsulta('"ID"\t"NOME"\t"ID"\t"ID"\t"NOME"\n"1"\t"a"\t"2"\t"3"\t"b"\n');
    expect(r.colunas.map((c) => c.nome)).toEqual(["ID", "NOME", "ID (2)", "ID (3)", "NOME (2)"]);
    expect(r.colunas[2].original).toBe("ID");
    expect(r.avisos.map((a) => a.tipo)).toEqual(["colunas-duplicadas"]);
    expect(r.avisos[0].mensagem).toContain("ID, NOME");
  });

  it("não colide com uma coluna que já se chama \"ID (2)\"", () => {
    const r = parsearConsulta('"ID"\t"ID (2)"\t"ID"\n"1"\t"2"\t"3"\n');
    expect(r.colunas.map((c) => c.nome)).toEqual(["ID", "ID (2)", "ID (3)"]);
  });
});

describe("entradas vazias", () => {
  it("texto vazio não quebra", () => {
    expect(parsearConsulta("")).toEqual({ colunas: [], linhas: [], avisos: [] });
    expect(parsearConsulta("\n\n").colunas).toEqual([]);
  });

  it("só cabeçalho", () => {
    const r = parsearConsulta('"A"\t"B"\n');
    expect(r.colunas).toHaveLength(2);
    expect(r.linhas).toEqual([]);
  });
});
