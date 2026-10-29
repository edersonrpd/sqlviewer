import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buscarPerfil } from "../perfis";
import { celulasPlanilha, gerarCSV, gerarLista, gerarTabulado } from "../exportar";
import { filtrarOrdenar, type Criterios } from "../filtragem";
import { formatarDecimal, formatarValor } from "../formatacao";
import { agregar, candidatasCategoria, candidatasValor, motivoSemGrafico, sugerirGrafico } from "../graficos";
import { parsearConsulta } from "../parser";

const fixture = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8"));
const idx = (nome: string) => fixture.colunas.findIndex((c) => c.nome === nome);

describe("formatação", () => {
  it("decimais em pt-BR mantendo as casas", () => {
    expect(formatarDecimal("1234.56")).toBe("1.234,56");
    expect(formatarDecimal("0.0000")).toBe("0,0000");
    expect(formatarDecimal("-1234567.5")).toBe("-1.234.567,5");
    expect(formatarDecimal("165.49")).toBe("165,49");
  });
  it("datas como dd/mm/aaaa", () => {
    expect(formatarValor("2024-10-14", "data")).toBe("14/10/2024");
    expect(formatarValor("2024-10-14 08:03:43", "datahora")).toBe("14/10/2024 08:03:43");
    expect(formatarValor("001", "texto")).toBe("001");
  });
});

const base: Criterios = { busca: "", filtros: {}, relacoes: [], ordenacao: null, visiveis: [] };
const tabela = parsearConsulta(
  '"COD"\t"VALOR"\t"DATA"\t"OBS"\n"010"\t"10.50"\t"2024-02-01"\t"abc"\n"002"\t"9.00"\t"2023-12-31"\t\\N\n"1"\t"1234.00"\t"2024-01-15"\t""\n',
);

describe("filtrarOrdenar", () => {
  it("ordena de acordo com o tipo", () => {
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 1, desc: false } })).toEqual([1, 0, 2]);
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 1, desc: true } })).toEqual([2, 0, 1]);
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 2, desc: false } })).toEqual([1, 2, 0]);
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 0, desc: false } })).toEqual([1, 0, 2]);
  });
  it("NULL e vazio vão para o fim", () => {
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 3, desc: false } })).toEqual([0, 1, 2]);
    expect(filtrarOrdenar(tabela, { ...base, ordenacao: { coluna: 3, desc: true } })).toEqual([0, 1, 2]);
  });
  it("busca global nas colunas visíveis, pelo raw e pelo valor exibido", () => {
    expect(filtrarOrdenar(tabela, { ...base, busca: "1.234,00", visiveis: [0, 1] })).toEqual([2]);
    expect(filtrarOrdenar(tabela, { ...base, busca: "15/01", visiveis: [2] })).toEqual([2]);
    expect(filtrarOrdenar(tabela, { ...base, busca: "abc", visiveis: [0, 1] })).toEqual([]);
  });
  it("filtro por coluna e por relação", () => {
    expect(filtrarOrdenar(tabela, { ...base, filtros: { 0: "0" } })).toEqual([0, 1]);
    expect(filtrarOrdenar(tabela, { ...base, relacoes: [{ coluna: 0, valor: "002", rotulo: "" }] })).toEqual([1]);
    expect(filtrarOrdenar(tabela, { ...base, relacoes: [{ coluna: 0, valor: "2", rotulo: "" }] })).toEqual([]);
  });
});

describe("gráficos", () => {
  it("usa o gráfico sugerido do perfil", () => {
    const cfg = sugerirGrafico(fixture, buscarPerfil("FATGOR"));
    expect(cfg).toEqual({ modo: "soma", categoria: idx("FGO_CODVEN"), valor: idx("FGO_VLRCON") });
    const { itens, total } = agregar(fixture, [0, 1, 2], cfg);
    expect(itens.map((i) => i.categoria)).toEqual(["047", "030"]);
    expect(itens[0].valor).toBeCloseTo(192.13);
    expect(total).toBeCloseTo(223.19);
  });
  it("códigos são categoria e nunca valor", () => {
    expect(candidatasCategoria(fixture)).toContain(idx("FGO_CODVEN"));
    expect(candidatasValor(fixture)).not.toContain(idx("AUTOINCREM"));
    expect(candidatasValor(fixture)).not.toContain(idx("FGO_CODCLI"));
    expect(candidatasValor(fixture)).toContain(idx("FGO_VLRCON"));
  });
  it("sugestão automática prefere categoria que agrupa", () => {
    const cfg = sugerirGrafico(fixture);
    expect(fixture.colunas[cfg.categoria!].nome).toBe("FGO_CODVEN");
    expect(cfg.modo).toBe("soma");
  });
  it("top 15 + Outros", () => {
    const linhas = ['"CAT"'];
    for (let k = 0; k < 20; k++) for (let r = 0; r <= k; r++) linhas.push(`"C${k}"`);
    const d = parsearConsulta(linhas.join("\n"));
    const { itens } = agregar(d, d.linhas.map((_, i) => i), { modo: "contagem", categoria: 0, valor: null });
    expect(itens).toHaveLength(16);
    expect(itens[0]).toMatchObject({ categoria: "C19", valor: 20 });
    expect(itens[15]).toMatchObject({ categoria: "Outros", valor: 1 + 2 + 3 + 4 + 5 });
    expect(itens.reduce((s, i) => s + i.percentual, 0)).toBeCloseTo(1);
  });
  it("explica quando não há coluna adequada", () => {
    const d = parsearConsulta('"ID"\t"V"\n"1"\t"2"\n"2"\t"3"\n');
    expect(motivoSemGrafico(d, sugerirGrafico(d))).toMatch(/categoria/);
  });
});

describe("saídas", () => {
  const d = parsearConsulta('"COD"\t"V"\t"OBS"\n"001"\t"1.50"\t"a;b"\n"00100000000000004001"\t\\N\t""\n');
  it("CSV com ; , BOM, raw e NULL", () => {
    expect(gerarCSV(d, [0, 1], [0, 1, 2])).toBe('﻿COD;V;OBS\r\n001;1.50;"a;b"\r\n00100000000000004001;NULL;\r\n');
  });
  it("lista para chamado", () => {
    expect(gerarLista(d, [0, 1], [0, 1])).toBe("COD: 001\nV: 1.50\n\nCOD: 00100000000000004001\nV: NULL");
  });
  it("tabulado para chamado", () => {
    expect(gerarTabulado(d, [1], [0, 1, 2])).toBe("COD\tV\tOBS\n00100000000000004001\tNULL\t");
  });
  it("xlsx grava códigos como texto e decimais como número", () => {
    const c = celulasPlanilha(d, [0, 1], [0, 1]);
    expect(c[1][0]).toEqual({ t: "s", v: "001" });
    expect(c[2][0]).toEqual({ t: "s", v: "00100000000000004001" });
    expect(c[1][1]).toEqual({ t: "n", v: 1.5, z: "#,##0.00" });
    expect(c[2][1]).toEqual({ t: "s", v: "NULL" });
  });
});
