import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsearConsulta } from "../parser";
import { chavesIguais, detectarPerfil, ligacoesDoPerfil, linhasLigadas } from "../perfis";

const fixture = readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8");

describe("detectarPerfil", () => {
  it("a fixture é detectada como FATGOR", () => {
    const d = detectarPerfil(parsearConsulta(fixture).colunas.map((c) => c.nome));
    expect(d.tipo).toBe("perfil");
    expect(d.tipo === "perfil" && d.perfil.id).toBe("FATGOR");
  });

  it("cadastro de itens é detectado como CADITE, com zeros à esquerda preservados", () => {
    const d = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-cadite.txt"), "utf-8"));
    const det = detectarPerfil(d.colunas.map((c) => c.nome));
    expect(det.tipo === "perfil" && det.perfil.id).toBe("CADITE");
    expect(d.linhas.map((l) => l[d.colunas.findIndex((c) => c.nome === "ITE_CODITE")])).toEqual(["99999", "00001", "00004"]);
  });

  it("cabeçalho com FGO_SEQFGO é EXTGOR, não FATGOR", () => {
    const d = detectarPerfil(["FGO_SEQFGO", "FGO_EMPEXP", "FGO_DTCOAG", "FGO_CANHUB", "FGO_NUMDOC"]);
    expect(d.tipo === "perfil" && d.perfil.id).toBe("EXTGOR");
  });

  it("colunas de FATGOR + FATDOR viram consulta combinada", () => {
    const d = detectarPerfil(["AUTOINCREM", "FGO_NUMDOC", "FGO_ESPDOC", "FGO_JAFATU", "FDO_SEQGER", "FDO_CODITE", "AUTOINCREM (2)"]);
    expect(d.tipo).toBe("combinada");
    expect(d.tipo === "combinada" && d.perfis.map((p) => p.id).sort()).toEqual(["FATDOR", "FATGOR"]);
  });

  it("cabeçalho desconhecido vira genérica", () => {
    expect(detectarPerfil(["ID", "NOME", "CPF"])).toEqual({ tipo: "generica" });
    expect(detectarPerfil([])).toEqual({ tipo: "generica" });
  });

  it("assinatura parcial não casa", () => {
    expect(detectarPerfil(["AUTOINCREM", "FGO_NUMDOC"]).tipo).toBe("generica");
  });

  it("vence a assinatura mais longa quando uma contém a outra", () => {
    const perfis = [
      { id: "CURTO", nome: "Curto", assinatura: ["A"] },
      { id: "LONGO", nome: "Longo", assinatura: ["A", "B"] },
    ];
    const d = detectarPerfil(["A", "B", "C"], perfis);
    expect(d.tipo === "perfil" && d.perfil.id).toBe("LONGO");
  });
});

describe("chaves de relação", () => {
  it("compara como string, com trim, preservando zeros e 20 dígitos", () => {
    expect(chavesIguais("00100000000000004001", " 00100000000000004001 ")).toBe(true);
    expect(chavesIguais("00100000000000004001", "00100000000000004002")).toBe(false);
    // como número os dois seriam 100000000000000000000 (perda de precisão)
    expect(Number("00100000000000004001") === Number("00100000000000004002")).toBe(true);
    expect(chavesIguais("001", "1")).toBe(false);
    expect(chavesIguais("000001000004", "000001000004")).toBe(true);
    expect(chavesIguais(null, null)).toBe(false);
    expect(chavesIguais("", "")).toBe(false);
  });

  it("encontra as linhas ligadas", () => {
    const itens = [["00100000000000004001", "A"], ["00100000000000004002", "B"], ["00100000000000004001 ", "C"], [null, "D"]];
    expect(linhasLigadas("00100000000000004001", itens, 0)).toEqual([0, 2]);
    expect(linhasLigadas("100000000000004001", itens, 0)).toEqual([]);
    expect(linhasLigadas(null, itens, 0)).toEqual([]);
  });
});

describe("ligacoesDoPerfil", () => {
  it("FATGOR enxerga as relações que declarou", () => {
    expect(ligacoesDoPerfil("FATGOR").map((l) => l.perfilDestino)).toEqual(["FATDOR", "EXTGOR", "CADCLI", "MOVCAR", "HUBCIT_INFPED", "HUBCIT_LOGPED", "LOGNFE", "ADTCLI", "FATAUT"]);
  });

  it("a relação vale no sentido inverso", () => {
    expect(ligacoesDoPerfil("FATDOR")).toEqual([
      { perfilDestino: "CADITE", colunaOrigem: "FDO_CODITE", colunaDestino: "ITE_CODITE", extras: [], rotulo: "Cadastro do item" },
      { perfilDestino: "FATGOR", colunaOrigem: "FDO_SEQGER", colunaDestino: "AUTOINCREM", extras: [], rotulo: "Pedido (cabeçalho)" },
    ]);
  });

  it("chave composta: o inverso troca origem e destino também nos extras", () => {
    const adt = ligacoesDoPerfil("ADTCLI").find((l) => l.perfilDestino === "FATGOR")!;
    expect(adt).toMatchObject({ colunaOrigem: "ADT_NUMDOC", colunaDestino: "FGO_NUMDOC", rotulo: "Pedido" });
    expect(adt.extras).toEqual([
      { origem: "ADT_ESPDOC", destino: "FGO_ESPDOC" },
      { origem: "ADT_CODEMP", destino: "FGO_CODEMP" },
    ]);
  });

  it("CADITE enxerga a marca e os itens de pedido pelo código do item", () => {
    expect(ligacoesDoPerfil("CADITE")).toEqual([
      { perfilDestino: "CADMAR", colunaOrigem: "ITE_CODMAR", colunaDestino: "MAR_CODMAR", extras: [], rotulo: "Marca" },
      { perfilDestino: "DESSIT", colunaOrigem: "ITE_CODITE", colunaDestino: "ITE_CODITE", extras: [], rotulo: "Dados para o site" },
      { perfilDestino: "FATDOR", colunaOrigem: "ITE_CODITE", colunaDestino: "FDO_CODITE", extras: [], rotulo: "Pedidos com o item" },
    ]);
  });
});

describe("mapa de relações", () => {
  it("liga as tabelas pelos perfis, em camadas a partir do pedido", async () => {
    const { montarMapa, condicaoJoin } = await import("../mapaRelacoes");
    const m = montarMapa();
    const no = (id: string) => m.nos.find((n) => n.id === id)!;
    const fatdor = m.arestas.find((a) => a.de === "FATGOR" && a.para === "FATDOR")!;
    expect(condicaoJoin(no("FATGOR"), no("FATDOR"), fatdor.ligacoes[0])).toBe("FATGOR.AUTOINCREM = FATDOR.FDO_SEQGER");
    expect(no("FATDOR").x).toBeGreaterThan(no("FATGOR").x);
    expect(no("CADITE").x).toBeGreaterThan(no("FATDOR").x);
    // chave composta sai com AND; tabela do outro banco com o nome real
    const hub = m.arestas.find((a) => a.de === "HUB_PEDIDOS")!;
    expect(condicaoJoin(no("HUB_PEDIDOS"), no("HUB_ITENS_PEDIDOS"), hub.ligacoes[0])).toBe(
      "pedidos.order_id = itens_pedidos.order_id AND pedidos.dominio = itens_pedidos.dominio",
    );
    // sem sobreposição de caixas
    const pos = new Set(m.nos.map((n) => `${n.x},${n.y}`));
    expect(pos.size).toBe(m.nos.length);
    expect(m.nos.some((n) => n.cadastro)).toBe(false);
  });
  it("cadastros opcionais: CADOPE vira uma caixa, CADCLI usa a do perfil", async () => {
    const { montarMapa } = await import("../mapaRelacoes");
    const m = montarMapa(undefined, { cadastros: true });
    expect(m.nos.filter((n) => n.tabela === "CADCLI")).toHaveLength(1);
    const ope = m.arestas.find((a) => a.de === "FATGOR" && a.para === "CADOPE")!;
    expect(ope.ligacoes.length).toBeGreaterThan(3);
    // Cliente declarado como relação e como cadastro: uma ligação só
    expect(m.arestas.find((a) => a.de === "FATGOR" && a.para === "CADCLI")!.ligacoes).toHaveLength(1);
  });
});
