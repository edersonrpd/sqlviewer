import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diagnosticar, nivelGeral } from "../diagnostico";
import { estadoInicial, reducer, type Estado } from "../estado";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { montarTela } from "../tela";

const texto = (f: string) => readFileSync(join(__dirname, "../../fixtures", f), "utf-8");
const L = texto("exemplo-fgo.txt").trim().split("\n").map((l) => l.split("\t"));
const col = (n: string) => L[0].indexOf(`"${n}"`);
const montar = (mut?: (l: string[][]) => void) => {
  const c = L.map((l) => [...l]);
  mut?.(c);
  return parsearConsulta(c.map((l) => l.join("\t")).join("\n"));
};
const abrir = (...resultados: string[]): Estado =>
  resultados.reduce((s, t) => reducer(s, { tipo: "criar", dados: parsearConsulta(t) }), estadoInicial);
const titulos = (s: Estado, reg: number) => diagnosticar(s.abas[0], reg, s.abas).achados.map((a) => `${a.nivel}: ${a.titulo}`);

const itens = (seq: string, ...totais: string[]) =>
  ['"FDO_SEQGER"\t"FDO_CODITE"\t"FDO_TOTITE"', ...totais.map((t, k) => `"${seq}"\t"00${k}"\t"${t}"`)].join("\n");

describe("diagnóstico da FATGOR", () => {
  it("só com a FATGOR aberta: lista o que não pôde verificar", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: montar() });
    const d = diagnosticar(s.abas[0], 0, s.abas);
    expect(d.pendentes).toEqual(["Itens (FATDOR)", "NF-e (LOGNFE)", "Adiantamentos (ADTCLI)"]);
    expect(d.achados.map((a) => a.nivel)).toEqual(["ok"]); // valor faturado = contábil
    expect(titulos(s, 2)).toContain("info: Pedido ainda sem fatura (FGO_NUMFAT vazio)");
  });

  it("itens: soma igual, diferente e pedido sem itens", () => {
    const fgo = L.map((l) => l.join("\t")).join("\n");
    let s = abrir(fgo, itens("00100000000000001001", "10.00", "16.64"));
    expect(titulos(s, 0)).toContain("ok: 2 item(ns) somam R$ 26,64, igual ao total de produtos");
    s = abrir(fgo, itens("00100000000000001001", "10.00"));
    expect(titulos(s, 0)[0]).toBe("alerta: Soma dos itens diferente do total de produtos");
    expect(titulos(s, 1)[0]).toBe("erro: Pedido sem itens na FATDOR");
  });

  it("NF-e: autorizada, sem registro e sem autorização", () => {
    const fgo = L.map((l) => l.join("\t")).join("\n");
    const nfe = texto("exemplo-lognfe.txt");
    // a última NF do exemplo é autorizada; vira a fatura do pedido 1
    const s1 = abrir(fgo, nfe.replace('"000000067471"', '"000000053684"'));
    expect(titulos(s1, 0)).toContain("ok: NF-e 000000053684 autorizada em 02/01/2026 08:12:53");
    expect(titulos(s1, 1)[0]).toBe("alerta: Fatura 000000053685 sem registro na LOGNFE");
    // uma NF sem data de autorização nem retorno
    const s2 = abrir(fgo, nfe.replace('"000000003014"', '"000000053684"'));
    expect(titulos(s2, 0)[0]).toBe("alerta: NF-e 000000053684 sem autorização registrada");
  });

  it("valor faturado diferente do contábil", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: montar((c) => (c[1][col("FGO_VALFAT")] = '"20.00"')) });
    expect(titulos(s, 0)[0]).toBe("alerta: Valor faturado diferente do valor contábil");
  });

  it("e-commerce sem NUMPOK é erro; com NUMPOK é ok", () => {
    const sem = montar((c) => (c[1][col("FGO_MEN001")] = '"PEDIDO E-COMMERCE: SHP_123"'));
    let s = reducer(estadoInicial, { tipo: "criar", dados: sem });
    expect(titulos(s, 0)[0]).toBe("erro: Pedido de e-commerce sem NUMPOK");
    expect(nivelGeral(diagnosticar(s.abas[0], 0, s.abas))).toBe("erro");
    const com = montar((c) => {
      c[1][col("FGO_MEN001")] = '"PEDIDO E-COMMERCE: SHP_123"';
      c[1][col("FGO_NUMPOK")] = '"SHP_123"';
    });
    s = reducer(estadoInicial, { tipo: "criar", dados: com });
    expect(titulos(s, 0)).toContain("ok: Pedido de e-commerce com NUMPOK");
  });

  it("adiantamento: zerado, com saldo e sem lançamentos do pedido", () => {
    const fgo = montar((c) => {
      c[1][col("FGO_CODCLI")] = '"00033402"';
      c[1][col("FGO_NUMDOC")] = '"000001109506"';
    });
    const adt = texto("exemplo-adtcli.txt");
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: parsearConsulta(adt) });
    expect(titulos(s, 0)).toContain("ok: Adiantamento do pedido zerado");
    // só o crédito: sobra saldo
    s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: parsearConsulta(adt.trim().split("\n").slice(0, 2).join("\n")) });
    expect(titulos(s, 0)[0]).toBe("alerta: Saldo de adiantamento do pedido: R$ 231,63");
  });

  it("perfis sem regras não têm diagnóstico", () => {
    const s = abrir(texto("exemplo-adtcli.txt"));
    expect(diagnosticar(s.abas[0], 0, s.abas)).toEqual({ achados: [], pendentes: [] });
  });
});

describe("motivo da baixa no cabeçalho", () => {
  it("aparece só quando preenchido, em amarelo e largo", () => {
    const d = montar();
    const p = buscarPerfil("FATGOR");
    expect(montarTela(d, 0, p).indicadores.map((i) => i.campo.nome)).toEqual(["FGO_LIBERA", "FGO_LIBCOM"]);
    const ind = montarTela(d, 2, p).indicadores.find((i) => i.campo.nome === "FGO_MOTBAI")!;
    expect(ind).toMatchObject({ cor: "amarelo", campo: { largo: true, texto: "DADOS BAIXA: 14/10/2024 - 09:51:23 OPE: 001 - DEBORA" } });
  });
});
