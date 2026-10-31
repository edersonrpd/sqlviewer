import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colunasExibidas, estadoInicial, layoutColunas, reducer } from "../estado";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { relacionadosDoRegistro } from "../relacionados";

const fgo = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8"));
const itens = parsearConsulta(
  '"FDO_SEQGER"\t"FDO_CODITE"\t"FDO_TOTITE"\n' +
    '"00100000000000001001"\t"A1"\t"10.00"\n' +
    '"00100000000000001001"\t"A2"\t"16.64"\n' +
    '"00100000000000004001"\t"B1"\t"165.49"\n',
);

describe("abas", () => {
  it("nomeia pelo perfil com contador, ou Consulta N", () => {
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: parsearConsulta('"X"\n"1"') });
    expect(s.abas.map((a) => a.nome)).toEqual(["FATGOR", "FATGOR 2", "Consulta 1"]);
    expect(s.ativa).toBe(s.abas[2].id);
    s = reducer(s, { tipo: "fechar", id: s.abas[2].id });
    expect(s.ativa).toBe(s.abas[1].id);
  });

  it("layout do perfil: colunas padrão visíveis na ordem, ausentes ignoradas", () => {
    const l = layoutColunas(fgo, buscarPerfil("FATGOR"));
    const nomes = colunasExibidas(l).map((j) => fgo.colunas[j].nome);
    expect(nomes[0]).toBe("FGO_NUMDOC");
    expect(nomes).toHaveLength(15);
    // fixas do perfil na ordem: Nº documento, NUMPOK e motivo da baixa
    expect(nomes.slice(0, 4)).toEqual(["FGO_NUMDOC", "FGO_NUMPOK", "FGO_MOTBAI", "AUTOINCREM"]);
    // nenhuma coluna padrão existe → todas visíveis
    const outro = layoutColunas(itens, buscarPerfil("FATGOR"));
    expect(outro.visiveis.every(Boolean)).toBe(true);
  });
});

describe("relacionados", () => {
  it("liga cabeçalho e itens nos dois sentidos pela chave raw", () => {
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: itens });
    const [cab, it2] = s.abas;
    expect(it2.perfilId).toBe("FATDOR");

    const r0 = relacionadosDoRegistro(cab, 0, s.abas);
    expect(r0).toHaveLength(1);
    expect(r0[0]).toMatchObject({ rotulo: "Itens do pedido", quantidade: 2, chave: "00100000000000001001" });
    expect(relacionadosDoRegistro(cab, 1, s.abas)[0].quantidade).toBe(0);
    expect(relacionadosDoRegistro(cab, 2, s.abas)[0].quantidade).toBe(1);

    const inv = relacionadosDoRegistro(it2, 2, s.abas);
    expect(inv).toEqual([
      expect.objectContaining({ rotulo: "Pedido (cabeçalho)", abaId: cab.id, quantidade: 1, colunaDestinoNome: "AUTOINCREM" }),
    ]);

    s = reducer(s, { tipo: "abrirRelacao", destino: it2.id, coluna: r0[0].colunaDestino, valor: r0[0].chave!, rotulo: "x" });
    expect(s.ativa).toBe(it2.id);
    expect(s.abas[1].relacoes).toHaveLength(1);
  });

  it("sem abas relacionadas não há relacionados", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    expect(relacionadosDoRegistro(s.abas[0], 0, s.abas)).toEqual([]);
  });
});

describe("fechar e desfazer", () => {
  it("fecha sem perguntar e o Desfazer devolve a aba na mesma posição, com o estado", () => {
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: itens });
    s = reducer(s, { tipo: "atualizar", id: s.abas[0].id, patch: { busca: "047", registroTela: 2 } });
    const id = s.abas[0].id;
    s = reducer(s, { tipo: "ativar", id });
    s = reducer(s, { tipo: "fechar", id });
    expect(s.abas.map((a) => a.nome)).toEqual(["FATDOR"]);
    expect(s.fechada?.abas.map((f) => f.aba.nome)).toEqual(["FATGOR"]);
    s = reducer(s, { tipo: "reabrir" });
    expect(s.abas.map((a) => a.nome)).toEqual(["FATGOR", "FATDOR"]);
    expect(s.ativa).toBe(id);
    expect(s.abas[0]).toMatchObject({ busca: "047", registroTela: 2 });
    expect(s.fechada).toBeNull();
  });

  it("depois que o aviso expira não há o que desfazer; criar aba não perde o Desfazer", () => {
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "fechar", id: s.abas[0].id });
    s = reducer(s, { tipo: "criar", dados: itens });
    expect(s.fechada).not.toBeNull();
    s = reducer(s, { tipo: "descartarFechada" });
    expect(reducer(s, { tipo: "reabrir" })).toBe(s);
  });

  it("fechar todas: limpa as abas, recomeça a numeração e o Desfazer devolve tudo como estava", () => {
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: itens });
    s = reducer(s, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "atualizar", id: s.abas[1].id, patch: { busca: "x" } });
    s = reducer(s, { tipo: "ativar", id: s.abas[1].id });
    const antes = s;
    s = reducer(s, { tipo: "fecharTodas" });
    expect(s.abas).toEqual([]);
    expect(s.ativa).toBeNull();
    expect(s.fechada?.abas).toHaveLength(3);
    // nova consulta depois de limpar: numeração do zero
    expect(reducer(s, { tipo: "criar", dados: fgo }).abas[0].nome).toBe("FATGOR");

    s = reducer(s, { tipo: "reabrir" });
    expect(s.abas.map((a) => a.nome)).toEqual(["FATGOR", "FATDOR", "FATGOR 2"]);
    expect(s.abas.map((a) => a.id)).toEqual(antes.abas.map((a) => a.id));
    expect(s.ativa).toBe(antes.abas[1].id);
    expect(s.abas[1].busca).toBe("x");
    expect(reducer(s, { tipo: "criar", dados: fgo }).abas[3].nome).toBe("FATGOR 3");
    // sem abas não há o que fechar
    expect(reducer(estadoInicial, { tipo: "fecharTodas" })).toBe(estadoInicial);
  });
});
