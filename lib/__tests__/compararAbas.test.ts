import { describe, expect, it } from "vitest";
import { PERFIS } from "@/config/perfis";
import { colunasComuns, colunasMaisDiferentes, compararAbas, sugerirChave, valoresIguais } from "../compararAbas";
import type { Diagnostico } from "../diagnostico";
import { parsearConsulta } from "../parser";
import { resumoParaChamado } from "../resumoChamado";
import { montarTela } from "../tela";
import { gerarUpdate, updateEntreRegistros, updatesDaComparacao } from "../update";

const A = parsearConsulta(["ID\tNOME\tVALOR\tOBS\tSO_A", "1\tAna\t10.50\tx\ta", "2\tBia\t20.00\t\\N\ta", "3\tCid\t30.00\ty\ta", "5\tEva\t1.00\tz\ta"].join("\n"));
const B = parsearConsulta(["id\tVALOR\tNOME\tOBS\tSO_B", "2\t25.00\tBia\t\tb", "1\t10.5\tAna \tx\tb", "4\t40.00\tDan\tw\tb", "5\t1.00\tEva\tz\tb"].join("\n"));

describe("comparar abas", () => {
  it("colunas comuns pelo nome, sem diferenciar maiúsculas", () => {
    const c = colunasComuns(A, B);
    expect(c.comuns.map((x) => [x.nome, x.ja, x.jb])).toEqual([["ID", 0, 0], ["NOME", 1, 2], ["VALOR", 2, 1], ["OBS", 3, 3]]);
    expect(c.soA).toEqual(["SO_A"]);
    expect(c.soB).toEqual(["SO_B"]);
  });

  it("sugere a chave do perfil ou a primeira coluna sem repetição", () => {
    const { comuns } = colunasComuns(A, B);
    expect(sugerirChave(A, B, comuns)).toBe("ID");
    const fgo = PERFIS.find((p) => p.id === "FATGOR")!;
    const x = parsearConsulta("FGO_CODEMP\tAUTOINCREM\n001\t9\n001\t8");
    expect(sugerirChave(x, x, colunasComuns(x, x).comuns, fgo)).toBe(fgo.chave ?? fgo.colunaTitulo ?? "AUTOINCREM");
    expect(sugerirChave(x, x, colunasComuns(x, x).comuns)).toBe("AUTOINCREM");
  });

  it("mesmo número escrito diferente é igual; NULL só é igual a NULL", () => {
    expect(valoresIguais("10.50", "10.5")).toBe(true);
    expect(valoresIguais("Ana", "Ana ")).toBe(true);
    expect(valoresIguais("010", "10")).toBe(false);
    expect(valoresIguais(null, "")).toBe(false);
    expect(valoresIguais(null, null)).toBe(true);
  });

  const c = compararAbas(A, B, ["ID"]);

  it("casa pela chave e separa iguais, diferentes e os que só existem em um lado", () => {
    expect(c.iguais).toBe(2); // 1 e 5
    expect(c.diferentes.map((d) => [d.chave, d.ia, d.ib, d.colunas.map((x) => [x.nome, x.a, x.b])])).toEqual([
      [["2"], 1, 0, [["VALOR", "20.00", "25.00"], ["OBS", null, ""]]],
    ]);
    expect(c.apenasA).toEqual([2]);
    expect(c.apenasB).toEqual([2]);
    expect(colunasMaisDiferentes(c)).toEqual([{ nome: "OBS", qtd: 1 }, { nome: "VALOR", qtd: 1 }]);
  });

  it("ignora colunas pelo trecho do nome e avisa de chave repetida", () => {
    expect(compararAbas(A, B, ["ID"], ["val", "OBS"]).diferentes).toEqual([]);
    const rep = parsearConsulta("ID\tV\n1\ta\n1\tb");
    const r = compararAbas(rep, rep, ["ID"]);
    expect([r.repetidasA, r.repetidasB, r.iguais]).toEqual([1, 1, 1]);
  });

  it("chave composta", () => {
    const x = parsearConsulta("EMP\tDOC\tV\n001\t1\ta\n002\t1\tb");
    const y = parsearConsulta("EMP\tDOC\tV\n002\t1\tB\n001\t1\ta");
    const r = compararAbas(x, y, ["EMP", "DOC"]);
    expect(r.iguais).toBe(1);
    expect(r.diferentes[0].chave).toEqual(["002", "1"]);
  });

  it("UPDATE de cada registro diferente, nos dois sentidos", () => {
    expect(updatesDaComparacao(c, A, B, "b", "T")).toBe(
      "-- Gerado pelo SQL Viewer a partir de uma comparação. Revise e rode o SELECT antes de executar.\n" +
        "UPDATE T\n   SET VALOR = 20.00,\n       OBS = NULL\n WHERE ID = 2;",
    );
    expect(updatesDaComparacao(c, A, B, "a", "T")).toContain("UPDATE T\n   SET VALOR = 25.00,\n       OBS = ''\n WHERE ID = 2;");
    expect(updatesDaComparacao(compararAbas(A, A, ["ID"]), A, A, "b", "T")).toBeNull();
  });
});

describe("UPDATE entre 2 registros da mesma aba", () => {
  const t = parsearConsulta("COD\tNOME\tUF\tvalor total\n010\tAna\tSP\t5.00\n020\tBia\tRJ\t7.00");

  it("com chave: WHERE pela chave do destino, sem alterar a própria chave", () => {
    const u = updateEntreRegistros(t, 0, 1, [0, 1, 2, 3], "CAD", "cod")!;
    expect(u.sql.split("\n").slice(1).join("\n")).toBe("UPDATE CAD\n   SET NOME = 'Ana',\n       UF = 'SP',\n       `valor total` = 5.00\n WHERE COD = '020';");
    expect(u).toMatchObject({ por: "chave", colunas: 3 });
  });

  it("só as colunas pedidas; sem chave, identifica pelos valores atuais do destino", () => {
    const u = updateEntreRegistros(t, 1, 0, [2], "CAD")!;
    expect(u.sql).toContain("UPDATE CAD\n   SET UF = 'RJ'\n WHERE COD = '010'\n   AND NOME = 'Ana'\n   AND UF = 'SP'\n   AND `valor total` = 5.00;");
    expect(u.por).toBe("valores");
  });

  it("sem nada a alterar não gera SQL", () => {
    expect(updateEntreRegistros(t, 0, 0, [1, 2], "CAD", "COD")).toBeNull();
    expect(gerarUpdate("T", [], [])).toBeNull();
  });
});

describe("resumo para chamado", () => {
  const fgo = PERFIS.find((p) => p.id === "FATGOR")!;
  const dados = parsearConsulta("FGO_NUMDOC\tFGO_NUMPOK\tFGO_TOTPRO\n000001000004\tMLB_SHML48393430410\t150.00");
  const tela = montarTela(dados, 0, fgo);
  const diag: Diagnostico = {
    achados: [
      { nivel: "erro", titulo: "Pedido sem itens na FATDOR" },
      { nivel: "ok", titulo: "Valor ok", detalhe: "R$ 150,00" },
    ],
    pendentes: ["NF-e (LOGNFE)"],
  };

  it("identificação, marketplace, diagnóstico e registros ligados em texto puro", () => {
    const r = resumoParaChamado(tela, fgo, diag, [{ rotulo: "Itens", aba: "FATDOR", quantidade: 0 }]);
    const linhas = r.split("\n");
    expect(linhas[0]).toBe(`${tela.titulo} (FATGOR · ${fgo.nome})`);
    expect(linhas[1]).toContain("MLB_SHML48393430410 (Mercado Livre)");
    expect(r).toContain("DIAGNÓSTICO\n[ERRO] Pedido sem itens na FATDOR\n[OK] Valor ok — R$ 150,00\nNão verificado (consulta não aberta): NF-e (LOGNFE)");
    expect(r).toContain("REGISTROS LIGADOS\nItens (FATDOR): 0");
  });

  it("sem perfil nem diagnóstico: só o título", () => {
    const g = parsearConsulta("A\tB\n1\t2");
    expect(resumoParaChamado(montarTela(g, 0), undefined, null)).toBe("A: 1");
  });
});
