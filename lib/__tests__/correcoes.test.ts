import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { gerarCSV, gerarInsert, gerarSelect, neutralizarFormula } from "../exportar";
import { condicaoValores } from "../join";
import { parsearConsulta } from "../parser";
import { lerSessao, serializarSessao } from "../sessao";
import { identSql, literalSql } from "../sql";
import { sqlRelacionado } from "../tela";

describe("nomes e literais no SQL gerado", () => {
  it("identificador simples fica como veio; os demais vão entre crases", () => {
    expect(identSql("FGO_NUMDOC")).toBe("FGO_NUMDOC");
    expect(identSql("valor total")).toBe("`valor total`");
    expect(identSql("order")).toBe("`order`");
    expect(identSql("2via")).toBe("`2via`");
    expect(identSql("a`b")).toBe("`a``b`");
    expect(identSql("hub.pedidos")).toBe("hub.pedidos");
  });

  it("INSERT e SELECT usam o nome original da coluna, sem repetir as duplicadas", () => {
    const t = parsearConsulta("ID\tNOME\tNOME\tvalor total\tkey\n1\tA\tB\t5\tk");
    expect(t.colunas.map((c) => c.nome)).toEqual(["ID", "NOME", "NOME (2)", "valor total", "key"]);
    expect(gerarInsert(t, [0], [0, 1, 2, 3, 4], "T")).toBe("INSERT INTO T (ID, NOME, `valor total`, `key`) VALUES (1, 'A', 5, 'k');");
    expect(gerarSelect(t, [0], [1, 2, 3], "minha tabela", "ID")).toBe("SELECT NOME, `valor total`\nFROM `minha tabela`\nWHERE ID = 1;");
    expect(gerarSelect(t, [0], [3, 4], "T")).toBe("SELECT `valor total`, `key`\nFROM T\nWHERE `valor total` = 5 AND `key` = 'k';");
  });

  it("barra invertida é escapada em todos os SQL (Montar consulta, JOIN, Ver também)", () => {
    expect(literalSql("a\\")).toBe("'a\\\\'");
    expect(condicaoValores(["C:\\x", "it's"])).toBe("IN ('C:\\\\x', 'it''s')");
    expect(sqlRelacionado("T", "COL", "a\\")).toContain("'a\\\\'");
  });
});

describe("CSV sem fórmulas", () => {
  it("texto que começa com = + - @ ganha apóstrofo; números ficam como estão", () => {
    expect(neutralizarFormula("=1+1")).toBe("'=1+1");
    expect(neutralizarFormula("+55 11 9999")).toBe("'+55 11 9999");
    expect(neutralizarFormula("@usuario")).toBe("'@usuario");
    expect(neutralizarFormula("-12.50")).toBe("-12.50");
    expect(neutralizarFormula("-3")).toBe("-3");
    expect(neutralizarFormula("normal")).toBe("normal");
  });

  it("vale para o cabeçalho e para as células do CSV", () => {
    const t = parsearConsulta('NOME\tV\n"=HYPERLINK(""http://x"";""a"")"\t-1.50');
    expect(gerarCSV(t, [0], [0, 1])).toBe('\uFEFFNOME;V\r\n"\'=HYPERLINK(""http://x"";""a"")";-1.50\r\n');
  });
});

describe("sessão com arquivo inconsistente", () => {
  const dados = parsearConsulta("A\tB\tC\n1\tx\t2.5\n2\ty\t3.5");
  const s = reducer(estadoInicial, { tipo: "criar", dados });
  const arquivo = () => JSON.parse(serializarSessao(s));
  const ler = (mudar: (aba: Record<string, unknown>) => void) => {
    const arq = arquivo();
    mudar(arq.abas[0]);
    return lerSessao(JSON.stringify(arq)).abas[0];
  };

  it("layout que não bate com os dados volta ao padrão", () => {
    const a = ler((x) => {
      x.ordem = [0, 0, 9];
      x.visiveis = [true];
      x.larguras = ["x"];
      x.fixas = [7, 1, 1];
      x.registro = 99;
      x.registroTela = -1;
      x.selecionadas = [0, 5, "a"];
      x.filtros = { 1: "x", 8: "y", 2: 3 };
      x.filtrosValores = { 0: ["1"], 9: ["z"] };
      x.ordenacao = [{ coluna: 5, desc: true }, { coluna: 2, desc: 1 }];
      x.relacoes = [{ coluna: 9, valor: "x", rotulo: "r" }, { coluna: 0, valor: "1", rotulo: "ok" }];
      x.grafico = { modo: "soma", categoria: 40, valor: 2 };
      x.visao = "outra";
      x.busca = 5;
    });
    expect(a.ordem).toEqual([0, 1, 2]);
    expect(a.visiveis).toEqual([true, true, true]);
    expect(a.larguras).toEqual([140, 140, 140]);
    expect(a.fixas).toEqual([1]);
    expect(a.registro).toBeNull();
    expect(a.registroTela).toBeNull();
    expect([...a.selecionadas]).toEqual([0]);
    expect(a.filtros).toEqual({ 1: "x" });
    expect(a.filtrosValores).toEqual({ 0: ["1"] });
    expect(a.ordenacao).toEqual([{ coluna: 2, desc: true }]);
    expect(a.relacoes).toEqual([{ coluna: 0, valor: "1", rotulo: "ok" }]);
    expect(a.grafico.categoria === null || a.grafico.categoria < 3).toBe(true);
    expect(a.visao).toBe("tabela");
    expect(a.busca).toBe("");
  });

  it("linhas cortadas ou com tipos errados são acertadas pelo cabeçalho", () => {
    const a = ler((x) => {
      const d = x.dados as { linhas: unknown[]; colunas: unknown[] };
      d.linhas = [["1"], ["2", 7, "3.5", "sobra"], "lixo"];
      d.colunas[1] = { nome: "B", tipo: "inexistente" };
    });
    expect(a.dados.linhas).toEqual([["1", null, null], ["2", "7", "3.5"], [null, null, null]]);
    expect(a.dados.colunas[1]).toEqual({ nome: "B", original: "B", tipo: "texto", casas: 0 });
  });

  it("arquivo íntegro continua abrindo igual", () => {
    const a = lerSessao(serializarSessao(s)).abas[0];
    expect(a).toMatchObject({ ordem: s.abas[0].ordem, visiveis: s.abas[0].visiveis, larguras: s.abas[0].larguras, grafico: s.abas[0].grafico });
  });
});
