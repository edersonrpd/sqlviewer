import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { montarEstruturas, normalizarCodigo, sqlEstrutura } from "../estrutura";
import { separarPorMarcadores } from "../join";
import { parsearConsulta } from "../parser";
import { montarConsulta } from "../montar";
import { BUSCAS_RAPIDAS } from "@/config/perfis";

const tsv = (linhas: string[][]) => linhas.map((l) => l.map((v) => `"${v}"`).join("\t")).join("\n");

// mesmos números da tela "Estruturas" do AUTCOM (KIT 25X LIXA): 25 un. por KIT
const GERMAT = tsv([["AUTOINCREM", "GMT_CODEMP", "GMT_CODITE", "GMT_TIPQTD"], ["00100000000000053001", "001", "12188", "Q"]]);
const DETMAT = tsv([
  ["DMT_SEQGER", "DMT_SEQUEN", "AUTOINCREM", "DMT_CODEMP", "DMT_ITESUB", "DMT_REFERE", "DMT_QTDITE", "DMT_CUSITE"],
  ["00100000000000053001", "1", "00100000000000776001", "001", "11901", "2407", "25.0000000000", "1.6400"],
]);
const CADITE = tsv([
  ["ITE_CODITE", "ITE_DESITE", "ITE_CODGRU", "ITE_CODEMP", "ITE_REFERE", "ITE_CODFAB", "ITE_CODMAR"],
  ["12188", "KIT 25X LIXA FERRO 100", "008002", "001", "", "", "000030"],
  ["11901", "LIXA FERRO 100", "008002", "001", "2407", "60700100", "000030"],
]);
const ITEGER = tsv([
  ["ITE_CODITE", "ITE_CODEMP", "ITE_SALDOS", "ITE_PRECUS", "ITE_PREULT", "ITE_PRECOM"],
  ["11901", "001", "162.0000", "1.3800", "1.7500", "1.7500"],
  ["11901", "002", "0.0000", "1.3800", "1.7300", "1.7500"],
  ["12188", "001", "2.0000", "37.2100", "0.0000", "41.0000"],
]);

function abrir(...textos: string[]) {
  let s = estadoInicial;
  for (const t of textos) s = reducer(s, { tipo: "criar", dados: parsearConsulta(t) });
  return s.abas;
}

describe("estrutura (KIT)", () => {
  it("reconhece as tabelas", () => {
    expect(abrir(GERMAT, DETMAT, CADITE, ITEGER).map((a) => a.perfilId)).toEqual(["GERMAT", "DETMAT", "CADITE", "ITEGER"]);
  });

  it("monta como a tela de Estruturas do AUTCOM: totais, saldo e KITs possíveis", () => {
    const abas = abrir(GERMAT, DETMAT, CADITE, ITEGER);
    const [e] = montarEstruturas(abas[0], 0, abas);
    expect(e.raiz).toMatchObject({ codigo: "12188", descricao: "KIT 25X LIXA FERRO 100", saldo: 2, precoCompra: 41 });
    const [c] = e.raiz.kit!.componentes;
    expect(c).toMatchObject({ codigo: "11901", quantidade: 25, custoEstrutura: 1.64, custo: 1.38, ultimaCompra: 1.75, saldo: 162, referencia: "2407" });
    expect(e.totais.custoEstrutura).toBeCloseTo(41, 2);
    expect(e.totais.custo).toBeCloseTo(34.5, 2); // "Total Custo" do AUTCOM
    expect(e.totais.ultimaCompra).toBeCloseTo(43.75, 2); // "Custo Utilizado" (preço da última compra)
    expect(e.raiz.kitsPossiveis).toBeCloseTo(6.48, 2); // "Quantidade de estruturas disponíveis com o saldo atual"
    const textos = e.avisos.map((a) => a.texto);
    expect(textos).toContain("Preço de compra do KIT (41,00) segue o custo gravado na estrutura; pela última compra dos componentes seria 43,75");
    expect(textos).toContain("Saldo do próprio KIT: 2,00; com o saldo dos componentes daria para montar 6,48");
  });

  it("a partir do cadastro do item, da DETMAT ou da ITEGER chega na mesma estrutura", () => {
    const abas = abrir(GERMAT, DETMAT, CADITE, ITEGER);
    expect(montarEstruturas(abas[2], 0, abas)[0].raiz.kit).not.toBeNull(); // CADITE do KIT
    expect(montarEstruturas(abas[1], 0, abas)[0].raiz.codigo).toBe("12188"); // DETMAT → KIT
    expect(montarEstruturas(abas[2], 1, abas)[0].raiz.kit).toBeNull(); // o componente não é KIT
  });

  it("no pedido: explode a quantidade vendida e confere o saldo", () => {
    const fgo = tsv([["AUTOINCREM", "FGO_NUMDOC", "FGO_ESPDOC", "FGO_JAFATU", "FGO_CODEMP"], ["00100000000000009201", "000001009201", "PD", "0", "001"]]);
    const fdo = tsv([
      ["FDO_SEQGER", "AUTOINCREM", "FDO_CODEMP", "FDO_CODITE", "FDO_QTDITE", "FDO_UNITAR", "FDO_TOTITE"],
      ["00100000000000009201", "00100000000000009301", "001", "12188", "7.0000", "84.99", "594.93"],
    ]);
    const abas = abrir(fgo, fdo, GERMAT, DETMAT, CADITE, ITEGER);
    const [e] = montarEstruturas(abas[0], 0, abas);
    expect(e.quantidadePedido).toBe(7);
    expect(e.raiz.kit!.componentes[0].necessario).toBe(175);
    expect(e.avisos.map((a) => a.texto)).toContain("12188 › 11901: saldo 162,00 não cobre os 175,00 do pedido");
  });

  it("sem a DETMAT aberta não acusa KIT vazio; código com zeros à esquerda casa", () => {
    const abas = abrir(GERMAT, CADITE);
    const [e] = montarEstruturas(abas[0], 0, abas);
    expect(e.raiz.kit!.componentesConsultados).toBe(false);
    expect(e.avisos.some((a) => a.texto.includes("sem componentes"))).toBe(false);
    expect(normalizarCodigo(" 06931 ")).toBe(normalizarCodigo("6931"));
  });

  it("KIT dentro de KIT e ciclo", () => {
    const g = tsv([
      ["AUTOINCREM", "GMT_CODEMP", "GMT_CODITE", "GMT_TIPQTD"],
      ["A1", "001", "90001", "Q"],
      ["A2", "001", "90002", "Q"],
    ]);
    const d = tsv([
      ["DMT_SEQGER", "DMT_SEQUEN", "DMT_CODEMP", "DMT_ITESUB", "DMT_QTDITE", "DMT_CUSITE"],
      ["A1", "1", "001", "90002", "2", "10"],
      ["A2", "1", "001", "90001", "3", "1"], // volta para o primeiro
    ]);
    const abas = abrir(g, d);
    const [e] = montarEstruturas(abas[0], 0, abas);
    const sub = e.raiz.kit!.componentes[0];
    expect(sub.kit).not.toBeNull();
    expect(sub.kit!.componentes[0].ciclo).toBe(true);
    expect(e.avisos.some((a) => a.texto.includes("ciclo"))).toBe(true);
  });

  it("consulta avulsa com marcadores: ao colar, cada tabela vai para a sua aba", () => {
    const sql = sqlEstrutura(["12188"], "001")!;
    expect(sql.match(/>>\w+/g)).toEqual([">>GERMAT", ">>DETMAT", ">>CADITE", ">>ITEGER"]);
    expect(sql).toContain("LEFT JOIN DETMAT d ON d.DMT_SEQGER = g.AUTOINCREM");
    expect(sql.endsWith(" WHERE g.GMT_CODITE = '12188' AND g.GMT_CODEMP = '001';")).toBe(true);
    expect(sqlEstrutura(["12188", "12190", "12188"], null)).toContain("WHERE g.GMT_CODITE IN ('12188', '12190');");
    // resultado do JOIN: KIT + componente, cadastro e preços dos dois
    const joined = tsv([
      [">>GERMAT", "AUTOINCREM", "GMT_CODEMP", "GMT_CODITE", "GMT_TIPQTD", ">>DETMAT", "DMT_SEQGER", "DMT_SEQUEN", "AUTOINCREM", "DMT_CODEMP", "DMT_ITESUB", "DMT_QTDITE", "DMT_CUSITE", ">>CADITE", "ITE_CODITE", "ITE_DESITE", "ITE_CODGRU", ">>ITEGER", "ITE_CODITE", "ITE_CODEMP", "ITE_SALDOS", "ITE_PRECUS"],
      ["", "S1", "001", "12188", "Q", "", "S1", "1", "D1", "001", "11901", "25", "1.64", "", "12188", "KIT", "008", "", "12188", "001", "2", "37.21"],
      ["", "S1", "001", "12188", "Q", "", "S1", "1", "D1", "001", "11901", "25", "1.64", "", "11901", "LIXA", "008", "", "11901", "001", "162", "1.38"],
    ]);
    const partes = separarPorMarcadores(parsearConsulta(joined))!;
    const s = reducer(estadoInicial, { tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    expect(s.abas.map((a) => `${a.perfilId}:${a.dados.linhas.length}`)).toEqual(["GERMAT:1", "DETMAT:1", "CADITE:2", "ITEGER:2"]);
    const [e] = montarEstruturas(s.abas[0], 0, s.abas);
    expect(e.raiz.kitsPossiveis).toBeCloseTo(6.48, 2);
  });

  it("busca rápida \"Estrutura (KIT) – item\": consulta completa com JOIN, SELECT simples sem", () => {
    const b = BUSCAS_RAPIDAS.find((x) => x.id === "estrutura")!;
    expect(montarConsulta(b, ["12188"], true, ["001"])).toBe(sqlEstrutura(["12188"], "001"));
    expect(montarConsulta(b, ["12188", "12190"], true)).toContain("WHERE g.GMT_CODITE IN ('12188', '12190');");
    expect(montarConsulta(b, ["12188"], false, ["001"])).toBe("SELECT * FROM GERMAT WHERE GMT_CODITE = '12188' AND GMT_CODEMP = '001';");
  });
});
