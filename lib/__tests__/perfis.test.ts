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
    expect(ligacoesDoPerfil("FATGOR").map((l) => l.perfilDestino)).toEqual(["FATDOR", "EXTGOR", "MOVCAR", "HUBCIT_INFPED", "LOGNFE"]);
  });

  it("a relação vale no sentido inverso", () => {
    expect(ligacoesDoPerfil("FATDOR")).toEqual([
      { perfilDestino: "FATGOR", colunaOrigem: "FDO_SEQGER", colunaDestino: "AUTOINCREM", rotulo: "Pedido (cabeçalho)" },
    ]);
  });
});
