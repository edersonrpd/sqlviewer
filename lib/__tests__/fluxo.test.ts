import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { montarFluxo, montarMapa } from "../fluxo";
import { parsearConsulta } from "../parser";

const ler = (f: string) => parsearConsulta(readFileSync(join(__dirname, "../../fixtures", f), "utf-8"));

function abrir(...arquivos: string[]) {
  let s = estadoInicial;
  for (const f of arquivos) s = reducer(s, { tipo: "criar", dados: ler(f) });
  return s.abas;
}

describe("montarFluxo", () => {
  it("etapas do pedido em ordem de data, com a hora da entrada", () => {
    const [fgo] = abrir("exemplo-fgo.txt");
    const ev = montarFluxo(fgo, 2, [fgo]);
    const entrada = ev.find((e) => e.rotulo === "Entrada")!;
    expect(entrada.quando).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(entrada.estado).toBe("ok");
    // só a data (sem hora) fica no fim do dia
    const datados = ev.filter((e) => e.quando).map((e) => (e.quando!.length <= 10 ? `${e.quando} 99` : e.quando!));
    expect([...datados].sort()).toEqual(datados);
    expect(ev.findIndex((e) => e.rotulo === "Entrada")).toBeLessThan(ev.findIndex((e) => e.rotulo === "Faturado"));
    // tudo que não tem data vem depois dos datados
    const primeiroSemData = ev.findIndex((e) => !e.quando);
    if (primeiroSemData >= 0) expect(ev.slice(primeiroSemData).every((e) => !e.quando)).toBe(true);
  });

  it("aba ligada sem registros vira 'ausente' e consulta faltando vira 'naoConsultado'", () => {
    const abas = abrir("exemplo-fgo.txt", "exemplo-fataut.txt");
    const ev = montarFluxo(abas[0], 2, abas);
    const fataut = ev.find((e) => e.origem === abas[1].nome)!;
    expect(fataut).toBeDefined();
    expect(fataut.estado).toBe(fataut.quantidade ? "ok" : "ausente");
    expect(ev.some((e) => e.estado === "naoConsultado" && e.pendente)).toBe(true);
    // pendentes sempre no fim
    const k = ev.findIndex((e) => e.estado === "naoConsultado" || e.estado === "semChave");
    expect(ev.slice(k).every((e) => e.estado === "naoConsultado" || e.estado === "semChave")).toBe(true);
  });
});

describe("montarMapa", () => {
  it("centro é o registro; abas abertas e consultas faltando ligadas a ele", () => {
    const abas = abrir("exemplo-fgo.txt", "exemplo-fataut.txt", "exemplo-adtcli.txt");
    const m = montarMapa(abas[0], 2, abas);
    expect(m.centro.titulo).toContain("000001000004");
    const nivel1 = m.nos.filter((n) => n.nivel === 1);
    expect(nivel1.filter((n) => n.relacionado).map((n) => n.aba).sort()).toEqual([abas[1].nome, abas[2].nome].sort());
    expect(nivel1.some((n) => n.estado === "naoConsultado")).toBe(true);
    expect(m.nos.every((n) => n.nivel === 1 ? n.pai === "centro" : m.nos.some((p) => p.id === n.pai))).toBe(true);
  });
});
