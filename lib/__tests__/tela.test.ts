import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { relacoesPendentes } from "../relacionados";
import { montarTela, resumoRegistro, sqlRelacionado } from "../tela";

const fgo = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8"));
const fatgor = buscarPerfil("FATGOR");

describe("montarTela com perfil", () => {
  const t = montarTela(fgo, 2, fatgor);

  it("título, subtítulo e destaques", () => {
    expect(t.titulo).toBe("Pedido 000001000004");
    expect(t.subtitulo.map((c) => c.texto)).toEqual(["001", "PD", "14/10/2024 08:14:32", "AUTCOM"]);
    expect(t.destaques[0]).toMatchObject({ rotulo: "Valor contábil", texto: "R$ 165,49" });
  });

  it("status com valor original quando não há tradução", () => {
    expect(t.status.find((s) => s.nome === "FGO_JAFATU")).toMatchObject({ texto: "1", cor: "cinza" });
    expect(t.status.find((s) => s.nome === "FGO_CORTPD")).toMatchObject({ texto: "Não" });
  });

  it("todas as colunas aparecem em alguma seção, sem repetição", () => {
    const js = t.secoes.flatMap((s) => s.campos.map((c) => c.j));
    const horas = ["FGO_HORENT", "FGO_HORLIB", "FGO_HORLIC", "FGO_HORROM", "FGO_HORETR", "FGO_HPREVI"].filter((h) =>
      fgo.colunas.some((c) => c.nome === h),
    );
    expect(new Set(js).size).toBe(js.length);
    expect(js.length + horas.length).toBe(fgo.colunas.length);
  });

  it("marca NULL, vazio e zerado como vazio; preserva códigos", () => {
    const campos = Object.fromEntries(t.secoes.flatMap((s) => s.campos).map((c) => [c.nome, c]));
    expect(campos.FGO_NOMCON.vazio).toBe(true);
    expect(campos.FGO_NOMCON.texto).toBeNull();
    expect(campos.FGO_SERIE_.vazio).toBe(true);
    expect(campos.FGO_TOTIPI.vazio).toBe(true);
    expect(campos.FGO_CODEMP).toMatchObject({ texto: "001", vazio: false });
    expect(campos.AUTOINCREM.texto).toBe("00100000000000004001");
    expect(campos.FGO_ALQICM.texto).toBe("18,00%");
    expect(campos.FGO_DTALIB.texto).toBe("14/10/2024 08:14:32");
  });
});

describe("montarTela genérica", () => {
  it("agrupa por tipo", () => {
    const d = parsearConsulta('"ID"\t"NOME"\t"VALOR"\t"DATA"\n"001"\t"Ana"\t"10.50"\t"2024-01-02"\n');
    const t = montarTela(d, 0);
    expect(t.titulo).toBe("ID: 001");
    expect(t.secoes.map((s) => s.titulo)).toEqual(["Identificação", "Datas e horas", "Valores"]);
    expect(t.secoes[2].campos[0].texto).toBe("10,50");
  });
});

describe("apoio", () => {
  it("resumo da lista de registros", () => {
    expect(resumoRegistro(fgo, 0, fatgor)).toEqual({ titulo: "000001000001", detalhe: "001 · R$ 26,64" });
  });

  it("SQL sugerido escapa aspas", () => {
    expect(sqlRelacionado("FATDOR", "FDO_SEQGER", "001'x")).toBe("SELECT * FROM FATDOR WHERE FDO_SEQGER = '001''x';");
  });

  it("relações pendentes quando a aba relacionada não está aberta", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const p = relacoesPendentes(s.abas[0], 2, s.abas);
    expect(p.map((r) => r.perfilDestino)).toEqual(["FATDOR", "EXTGOR"]);
    expect(p[0]).toMatchObject({ tabela: "FATDOR", colunaDestino: "FDO_SEQGER", chave: "00100000000000004001" });
  });
});

describe("configuração dos perfis", () => {
  it("FATDOR totaliza quantidade e total do item, não o unitário", () => {
    expect(buscarPerfil("FATDOR")?.totais).toEqual(["FDO_QTDITE", "FDO_TOTITE"]);
  });
});
