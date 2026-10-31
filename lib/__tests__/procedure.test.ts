import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conferirProcedure } from "../conferirProcedure";
import { estadoInicial, reducer } from "../estado";
import { parsearConsulta } from "../parser";
import { analisarProcedure, avaliarCondicao, descreverCondicao, pareceProcedure, requisitos } from "../procedure";

const texto = (f: string) => readFileSync(join(__dirname, "../../fixtures", f), "utf-8");
const proc = texto("exemplo-procedure-fataut.sql");
const a = analisarProcedure(proc);

describe("leitura da procedure esp_InserePedidosFATAUT", () => {
  it("reconhece a procedure (e não confunde com resultado de consulta)", () => {
    expect(pareceProcedure(proc)).toBe(true);
    expect(pareceProcedure(texto("exemplo-fgo.txt"))).toBe(false);
    expect(a.nome).toBe("esp_InserePedidosFATAUT");
    expect(a.grava).toEqual(["FATAUT"]);
    expect(a.variaveis).toEqual([{ nome: "vQTD_TOLERANCIA", tipo: "INT", valor: "2", nota: "REQ:445754" }]);
  });

  it("lista as etapas na ordem (log e lock ficam de fora)", () => {
    expect(a.etapas.map((e) => `${e.tipo} ${e.alvo}`)).toEqual([
      "monta TMP_FGO_ROBO",
      "retira TMP_FGO_ROBO",
      "monta TMP_FGO_PEDIDOS_ATENDE",
      "monta TMP_PEDIDOS_A_INSERIR",
      "insere FATAUT",
    ]);
    expect(a.etapas[4].quando).toBe("(SELECT COUNT(0) FROM TMP_PEDIDOS_A_INSERIR) > 0");
  });

  it("extrai as condições do WHERE com explicação e requisito", () => {
    const e = a.etapas[0];
    expect(e.condicoes.map((c) => c.descricao)).toEqual([
      'Pelo menos uma: Existe registro em FATDOR_LIBEXT_LOG; ou FATGOR.FGO_NUMPOK (Nº pedido HUB) começa com "WS" + 1 caractere',
      "FGO_EMPEXP é um destes: 001, 003, 034, 050",
      "FGO_DTAENT (Entrada) a partir de 30/05/2023",
      "FGO_ESPDOC (Espécie) igual a PD",
      "FGO_JAFATU (Já faturado) igual a 0",
      "FGO_NUMPOK (Nº pedido HUB) preenchido (nem vazio nem NULL)",
      "FGO_LIBERA (Liberação) igual a 1",
      "FGO_LIBCOM (Liberação comercial) igual a 1",
      "FGO_CODTRA (Transportadora) diferente de 00134",
      "FGO_CODVEN (Vendedor) é um destes: 096, 559, 560, 561, 562, 569, 570, 571, 578, 580, 564",
    ]);
    expect(e.condicoes[0].requisitos).toEqual(["381416"]);
    expect(e.juncoes.filter((j) => j.tipo === "INNER").map((j) => j.tabela)).toEqual(["FATDOR", "EXTGOR", "CADCLI", "CADEMP"]);
    expect(e.juncoes.find((j) => j.tabela === "CADEMP")!.descricao).toBe("EMP_CODEMP é um destes: 001, 003, 034, 050");
    expect(e.calculadas.map((c) => c.nome)).toEqual(["ATENDE"]);
  });

  it("mostra as regras desativadas por comentário, com o requisito que removeu", () => {
    expect(a.etapas[0].desativadas).toEqual([
      { sql: "IF( FGO_ESTADO <> 'SP' AND CLI_CGCCPF = 1, FALSE, TRUE )", nota: null, requisitos: [] },
      expect.objectContaining({ nota: "REGRA DE PESO DE ITEM POR VENDEDOR REQUISITO: 291330/ REMOVIDA NO REQUISITO 341311", requisitos: ["291330", "341311"] }),
    ]);
    expect(a.blocosDesativados).toEqual([expect.objectContaining({ titulo: "Removida regras de dimenções pelo Req: 425923", requisitos: ["425923", "291330"] })]);
  });

  it("retira pedidos com item de lote 'A DEFINIR' e só insere quem não está na FATAUT", () => {
    expect(a.etapas[1].retiraSe).toEqual([
      {
        sql: "B.FDO_NUMLOT = 'A DEFINIR'",
        descricao: "B.FDO_NUMLOT (Lote) igual a A DEFINIR",
        nota: "REGRA DE RETIRAR PEDIDOS COM ITEM COM LOTE A DEFINIR REQUISITO: 291330",
        requisitos: ["291330"],
      },
    ]);
    expect(a.etapas[2].having!.descricao).toBe('ATENDE sem nenhum "N" (todos precisam atender)');
    expect(a.etapas[3].condicoes[0].descricao).toBe("Não existe registro em FATAUT");
  });

  it("descrições e requisitos avulsos", () => {
    expect(requisitos("REQ:445754 e REQUISITO 381416; Req: 425923")).toEqual(["445754", "381416", "425923"]);
    expect(descreverCondicao("X BETWEEN 1 AND 5")).toBe("X entre 1 e 5");
    expect(descreverCondicao("FUNC(X) > 2")).toBeNull();
  });
});

describe("conferência com o pedido aberto", () => {
  it("avalia condições simples e devolve '?' quando falta a coluna", () => {
    const buscar = (_t: string | null, c: string) => ({ FGO_ESPDOC: ["PD"], FGO_NUMPOK: ["MLB_X"], FGO_JAFATU: ["0"] })[c];
    expect(avaliarCondicao("FGO_ESPDOC = 'PD'", buscar).ok).toBe(true);
    expect(avaliarCondicao("FGO_JAFATU = 0", buscar).ok).toBe(true);
    expect(avaliarCondicao("IFNULL(FGO_NUMPOK, '') <> ''", buscar).ok).toBe(true);
    expect(avaliarCondicao("FGO_NUMPOK LIKE 'WS_%'", buscar)).toEqual({ ok: false, motivo: "FGO_NUMPOK = MLB_X" });
    expect(avaliarCondicao("(T.X IS NOT NULL OR FGO_NUMPOK LIKE 'MLB%')", buscar).ok).toBe(true);
    expect(avaliarCondicao("(T.X IS NOT NULL OR FGO_NUMPOK LIKE 'WS_%')", buscar).ok).toBeNull();
    expect(avaliarCondicao("FGO_CODVEN IN ('096')", buscar).ok).toBeNull();
  });

  it("pedido + extensão + FATAUT abertos: aponta o que barra", () => {
    const L = texto("exemplo-fgo.txt").trim().split("\n").map((l) => l.split("\t"));
    const col = (n: string) => L[0].indexOf(`"${n}"`);
    L[1][col("FGO_NUMDOC")] = '"000000970818"';
    L[1][col("FGO_CODEMP")] = '"003"';
    L[1][col("FGO_NUMPOK")] = '"MLB_SHML48393430410"';
    const fgo = parsearConsulta(L.map((l) => l.join("\t")).join("\n"));
    const ext = parsearConsulta(`"FGO_SEQFGO"\t"FGO_EMPEXP"\t"FGO_DTCOAG"\n${L[1][col("AUTOINCREM")]}\t"003"\t"2026-11-03"`);
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: ext });
    s = reducer(s, { tipo: "criar", dados: parsearConsulta(texto("exemplo-fataut.txt")) });
    s = reducer(s, { tipo: "criarProcedure", texto: proc, nome: a.nome });
    expect(s.abas.map((x) => x.perfilId ?? x.nome)).toEqual(["FATGOR", "EXTGOR", "FATAUT", "esp_InserePedidosFATAUT"]);

    const c = conferirProcedure(a, s.abas[0], 0, s.abas);
    const cond = (k: number) => c.etapas[0].condicoes[k];
    expect(cond(1)).toEqual({ ok: true, motivo: "FGO_EMPEXP = 003" }); // veio da aba EXTGOR
    expect(cond(3).ok).toBe(true); // espécie PD
    expect(cond(5).ok).toBe(true); // NUMPOK preenchido
    expect(cond(9)).toEqual({ ok: false, motivo: "FGO_CODVEN = 047" }); // vendedor fora da lista
    expect(c.etapas[0].juncoes[1]).toEqual({ ok: true, motivo: "1 registro(s) em EXTGOR" });
    // já está na FATAUT: a procedure não insere de novo
    expect(c.etapas[3].condicoes[0]).toEqual({ ok: false, motivo: "AUTOINCREM = 03200000000510619003" });
    expect(c.barrou).toBeGreaterThanOrEqual(2);
  });
});
