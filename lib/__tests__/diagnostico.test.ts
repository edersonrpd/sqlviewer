import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diagnosticar, nivelGeral } from "../diagnostico";
import { estadoInicial, reducer, type Estado } from "../estado";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { resumirLog, textoResumoLog } from "../logs";
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

describe("FATAUT (fila do faturamento automático)", () => {
  const fataut = (...linhas: string[]) =>
    ['"AUTOINCREM"\t"FAT_NUMDOC"\t"FAT_ESPDOC"\t"FAT_EMPDOC"\t"FAT_DTAINS"\t"FAT_FDOGER"', ...linhas].join("\n");
  const fgo = L.map((l) => l.join("\t")).join("\n");

  it("é detectada e ligada ao pedido por documento, espécie e empresa", () => {
    const s = abrir(fgo, fataut('"00300000000000001001"\t"000001000001"\t"PD"\t"001"\t"2026-10-31 10:45:00"\t"00100000000000001001"'));
    expect(s.abas[1].perfilId).toBe("FATAUT");
    expect(titulos(s, 0)).toContain("info: Inserido na FATAUT em 31/10/2026 10:45:00");
    // mesmo documento de outra empresa não conta
    const outra = abrir(fgo, fataut('"00300000000000001001"\t"000001000001"\t"PD"\t"003"\t"2026-10-31 10:45:00"\t"x"'));
    expect(titulos(outra, 0)).toContain("info: Pedido não está na FATAUT");
  });

  it("sem a aba FATAUT aberta não vira pendência (nem todo cliente usa faturamento automático)", () => {
    const d = diagnosticar(abrir(fgo).abas[0], 0, abrir(fgo).abas);
    expect(d.pendentes).not.toContain(expect.stringContaining("FATAUT"));
    expect(d.achados.some((a) => a.titulo.includes("FATAUT"))).toBe(false);
  });
});

describe("FATAUT com o log do robô (exemplo real)", () => {
  const fataut = parsearConsulta(texto("exemplo-fataut.txt"));

  it("lê o log de várias linhas e agrupa as mensagens repetidas", () => {
    expect(fataut.avisos).toEqual([]);
    const log = resumirLog(fataut.linhas[0][5]);
    expect(log.entradas).toHaveLength(5);
    expect(log.mensagens).toEqual([
      {
        texto: 'Data ainda não permitida para faturamento, conforme campo "EXTGOR.FGO_DTCOAG" = 03/11/2026.',
        qtd: 5,
        primeira: "31/10/2026 12:28:53",
        ultima: "31/10/2026 12:37:07",
      },
    ]);
    expect(textoResumoLog("sem entradas")).toBeNull();
  });

  it("na Tela da FATAUT o log aparece resumido", () => {
    const t = montarTela(fataut, 0, buscarPerfil("FATAUT"));
    expect(t.titulo).toBe("Fila automática – pedido 000000970818");
    const campo = t.secoes[0].campos[0];
    expect(campo.texto).toBe(
      '5 registro(s) no log · último em 31/10/2026 12:37:07\n• 5× Data ainda não permitida para faturamento, conforme campo "EXTGOR.FGO_DTCOAG" = 03/11/2026. (de 31/10/2026 12:28:53 a 31/10/2026 12:37:07)',
    );
  });

  it("no diagnóstico do pedido: inserção, fatura e última mensagem do robô", () => {
    const fgo = montar((l) => {
      l[1][col("FGO_NUMDOC")] = '"000000970818"';
      l[1][col("FGO_CODEMP")] = '"003"';
    });
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: fataut });
    const a = diagnosticar(s.abas[0], 0, s.abas).achados.find((x) => x.titulo.includes("FATAUT"))!;
    expect(a).toEqual({
      nivel: "info",
      titulo: "Inserido na FATAUT em 31/10/2026 10:42:16",
      detalhe: 'Ainda sem fatura pela fila · Último log 31/10/2026 12:37:07: Data ainda não permitida para faturamento, conforme campo "EXTGOR.FGO_DTCOAG" = 03/11/2026. (5×)',
    });
  });
});
