import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { correspondencias, fontesJson, indiceDeValores, buscarNoJson } from "../jsonVisao";
import { parsearConsulta } from "../parser";
import { montarConciliacoes, valoresRepetidos } from "../valores";

const tsv = (linhas: string[][]) => linhas.map((l) => l.map((v) => `"${v}"`).join("\t")).join("\n");
const NUMPOK = "MLB_SHML48265349520"; // mesmo pedido do log de exemplo

function cenario(comCartao = true) {
  const fgo = tsv([
    ["AUTOINCREM", "FGO_NUMDOC", "FGO_ESPDOC", "FGO_JAFATU", "FGO_NUMPOK", "FGO_VLRCON", "FGO_TOTPRO"],
    ["00100000000000009001", "000001009999", "PD", "1", NUMPOK, "156.11", "103.12"],
  ]);
  const inf = tsv([["INF_NUMPOK", "INF_VALTAX"], [NUMPOK, "12.37"]]);
  // 156,11 − 52,99 − 12,37 − 16,85 = 73,90 (totalReceivable do JSON)
  const mca = tsv([["MCA_NUMPOK", "MCA_VALORI", "MCA_VALTAX"], [NUMPOK, "73.90", "12.37"]]);
  let s = reducer(estadoInicial, { tipo: "criar", dados: parsearConsulta(fgo) });
  s = reducer(s, { tipo: "criar", dados: parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-hubcit-logped.txt"), "utf-8")) });
  s = reducer(s, { tipo: "criar", dados: parsearConsulta(inf) });
  if (comCartao) s = reducer(s, { tipo: "criar", dados: parsearConsulta(mca) });
  return s.abas;
}

describe("montarConciliacoes", () => {
  it("da venda ao recebível bate com o JSON do HUB e o cartão", () => {
    const abas = cenario();
    expect(abas.map((a) => a.perfilId)).toEqual(["FATGOR", "HUBCIT_LOGPED", "HUBCIT_INFPED", "MOVCAR"]);
    const c = montarConciliacoes(abas[0], 0, abas);
    const receb = c.find((x) => x.rotulo === "Da venda ao recebível")!;
    expect(receb.esperado.termos.map((t) => t.valor)).toEqual([156.11, 52.99, 12.37, 16.85]);
    expect(receb.esperado.total).toBeCloseTo(73.9, 2);
    expect(receb.estado).toBe("bate");
    expect(c.find((x) => x.rotulo === "Tarifa: HUB × cartão")!.estado).toBe("bate");
    expect(c.find((x) => x.rotulo === "Pedido × HUB")!.estado).toBe("bate");
  });

  it("sem a aba do cartão fica incompleta e diz o que abrir", () => {
    const abas = cenario(false);
    const receb = montarConciliacoes(abas[0], 0, abas).find((x) => x.rotulo === "Da venda ao recebível")!;
    expect(receb.estado).toBe("incompleta");
    expect(receb.comparado.termos[0].falta).toBe("abra a aba MOVCAR");
    // sem FATDOR aberta: itens × total também incompleta
    expect(montarConciliacoes(abas[0], 0, abas)[0].estado).toBe("incompleta");
  });
});

describe("valoresRepetidos", () => {
  it("agrupa o mesmo valor em tabelas diferentes", () => {
    const abas = cenario();
    const { grupos } = valoresRepetidos(abas[0], 0, abas);
    const vlr = grupos.find((g) => g.valor === 156.11)!;
    expect(vlr.origens).toEqual(expect.arrayContaining(["FATGOR.FGO_VLRCON", "HUBCIT_LOGPED.LOG_VLRCON"]));
    expect(grupos.find((g) => g.valor === 12.37)!.origens.length).toBe(2);
  });
});

describe("visão JSON", () => {
  it("acha o LOG_JSON pela aba ligada e marca valores que batem com colunas", () => {
    const abas = cenario();
    const fontes = fontesJson(abas[0], 0, abas);
    expect(fontes.map((f) => f.rotulo)).toEqual(["HUBCIT_LOGPED.LOG_JSON"]);
    const dado = fontes[0].dado as { totalPrice: number; marketplaceOrderCode: string };
    const indice = indiceDeValores(abas[0], 0, abas);
    expect(correspondencias(indice, dado.totalPrice).map((c) => c.coluna)).toEqual(
      expect.arrayContaining(["FGO_VLRCON", "HUBCIT_LOGPED.LOG_VLRCON"]),
    );
    // flag "1" (FGO_JAFATU) não casa com quantity: 1
    expect(correspondencias(indice, 1)).toEqual([]);
    const cod = correspondencias(indice, dado.marketplaceOrderCode);
    expect(cod.some((c) => c.coluna === "FGO_NUMPOK" && c.aproximado)).toBe(true);
  });

  it("busca por nome ou valor abre os ancestrais", () => {
    const { achados, abrir } = buscarNoJson({ products: [{ saleFee: 12.37 }], total: 1 }, "salefee");
    expect([...achados]).toEqual(["$.products[0].saleFee"]);
    expect([...abrir]).toEqual(expect.arrayContaining(["$", "$.products", "$.products[0]"]));
  });
});

describe("frete cobrado do vendedor e adiantamentos", () => {
  // pedido sintético com o mesmo padrão do caso real: frete 50,55 no HUB e no cartão, zerado na extensão
  function cenarioFrete() {
    const N = "MLB_SHML00000000001";
    const json = JSON.stringify({ totalPrice: 322.14, totalFreightPrice: 0, totalFreightPriceDebit: 50.55, totalReceivable: 234.54 }).replace(/"/g, '""');
    const linha = (l: string[]) => l.map((v) => (v.startsWith("{") ? `"${v}"` : `"${v}"`)).join("\t");
    const fgo = [
      linha(["AUTOINCREM", "FGO_NUMDOC", "FGO_ESPDOC", "FGO_CODEMP", "FGO_JAFATU", "FGO_NUMPOK", "FGO_VLRCON", "FGO_TOTPRO"]),
      linha(["00100000000000009101", "000001009101", "PD", "001", "1", N, "322.14", "322.14"]),
    ].join("\n");
    const log = [linha(["ID", "LOG_PEDIDO", "LOG_VLRCON", "LOG_VERIFICADO", "LOG_JSON"]), linha(["9", N, "322.14", "N", json])].join("\n");
    const inf = tsv([["INF_NUMPOK", "INF_VALTAX", "INF_FREVEN"], [N, "37.05", "50.55"]]);
    const mca = tsv([["MCA_NUMPOK", "MCA_VALORI", "MCA_VALTAX", "MCA_FREMKT"], [N, "234.54", "37.05", "50.55"]]);
    const ext = tsv([["FGO_SEQFGO", "FGO_FREMKP", "FGO_COMMKP"], ["00100000000000009101", "0.00", "37.05"]]);
    const adt = tsv([
      ["ADT_CODCLI", "ADT_CODEMP", "ADT_NUMDOC", "ADT_ESPDOC", "ADT_TIPLAN", "ADT_VALLAN"],
      ["00000001", "001", "000001009101", "PD", "C", "322.14"],
      ["00000001", "001", "000001009101", "PD", "D", "322.14"],
    ]);
    let s = estadoInicial;
    for (const t of [fgo, log, inf, mca, ext, adt]) s = reducer(s, { tipo: "criar", dados: parsearConsulta(t) });
    return s.abas;
  }

  it("aponta a tabela em que o frete não foi gravado", () => {
    const abas = cenarioFrete();
    expect(abas.map((a) => a.perfilId)).toEqual(["FATGOR", "HUBCIT_LOGPED", "HUBCIT_INFPED", "MOVCAR", "EXTGOR", "ADTCLI"]);
    const c = montarConciliacoes(abas[0], 0, abas);
    expect(c.find((x) => x.rotulo === "Da venda ao recebível")!.estado).toBe("bate");
    const frete = c.find((x) => x.rotulo === "Frete cobrado do vendedor")!;
    expect(frete.modo).toBe("cada");
    expect(frete.esperado.total).toBe(50.55);
    expect(frete.comparado.termos.map((t) => [t.rotulo, t.valor, t.bate])).toEqual([
      ["Dados do pedido no HUB", 50.55, true],
      ["Movimentação de cartões", 50.55, true],
      ["Extensão do pedido", 0, false],
    ]);
    expect(frete.estado).toBe("diferente");
    expect(frete.diferenca).toBe(-50.55);
  });

  it("adiantamentos entram como créditos, débitos e saldo (não somados)", () => {
    const abas = cenarioFrete();
    const { grupos, avulsos } = valoresRepetidos(abas[0], 0, abas);
    const todos = [...grupos, ...avulsos];
    expect(todos.some((g) => g.valor === 644.28)).toBe(false);
    const g = grupos.find((x) => x.valor === 322.14)!;
    expect(g.origens).toEqual(expect.arrayContaining(["ADTCLI (créditos)", "ADTCLI (débitos)"]));
    expect(todos.flatMap((x) => x.origens).some((o) => o.startsWith("ADTCLI (saldo)"))).toBe(false);
  });
});
