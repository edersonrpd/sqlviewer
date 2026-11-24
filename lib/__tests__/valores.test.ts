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
