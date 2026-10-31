import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colunaDestaque } from "../destaque";
import { estadoInicial, reducer } from "../estado";
import { filtrarOrdenar } from "../filtragem";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { cadastrosPendentes, relacionadosDoRegistro, relacoesPendentes } from "../relacionados";
import { calcularSaldo, montarTela, resumoRegistro, sqlRelacionado } from "../tela";

const fgo = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8"));
const fatgor = buscarPerfil("FATGOR");

describe("montarTela com perfil", () => {
  const t = montarTela(fgo, 2, fatgor);

  it("título, subtítulo e destaques", () => {
    expect(t.titulo).toBe("Pedido 000001000004");
    expect(t.subtitulo.map((c) => c.texto)).toEqual(["001", "PD", "00001135", "14/10/2024 08:14:32", "AUTCOM"]);
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
    expect(resumoRegistro(fgo, 0, fatgor)).toEqual({ titulo: "000001000001", detalhe: "001 · R$\u00a026,64", chave: "NUMPOK: —", valorChave: "" });
  });

  it("SQL sugerido escapa aspas", () => {
    expect(sqlRelacionado("FATDOR", "FDO_SEQGER", "001'x")).toBe("SELECT * FROM FATDOR WHERE FDO_SEQGER = '001''x';");
  });

  it("relações pendentes quando a aba relacionada não está aberta", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const p = relacoesPendentes(s.abas[0], 2, s.abas);
    expect(p.map((r) => r.perfilDestino)).toEqual(["FATDOR", "EXTGOR", "MOVCAR", "HUBCIT_INFPED", "LOGNFE", "ADTCLI"]);
    // sem NUMPOK e sem fatura: a relação aparece, mas sem chave para consultar
    expect(p.filter((r) => r.chave === null).map((r) => r.colunaOrigem)).toEqual(["FGO_NUMPOK", "FGO_NUMPOK", "FGO_NUMFAT"]);
    expect(p[0]).toMatchObject({ tabela: "FATDOR", colunaDestino: "FDO_SEQGER", chave: "00100000000000004001" });
  });
});

describe("cadastros (chaves estrangeiras)", () => {
  it("sugere um SELECT por cadastro, juntando colunas com o mesmo código e pulando as vazias", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const c = cadastrosPendentes(s.abas[0], 0);
    expect(c.map((x) => [x.rotulo, x.tabela, x.chave])).toEqual([
      ["Cliente", "CADCLI", "00000345"],
      ["Operador", "CADOPE", "047"],
      ["Transportadora", "CADTRA", "99999"],
      ["Empresa", "CADEMP", "001"],
      ["Condição de pagamento", "CADCND", "001"],
      ["Forma de pagamento", "CADFPG", "015"],
    ]);
    expect(c[1].papeis).toEqual(["Vendedor", "Vendedor do faturamento", "Operador da liberação", "Operador da liberação comercial"]);
    expect(sqlRelacionado(c[1].tabela, c[1].colunaTabela, c[1].chave)).toBe("SELECT * FROM CADOPE WHERE OPE_CODOPE = '047';");
  });
});

describe("configuração dos perfis", () => {
  it("FATDOR totaliza quantidade e total do item, não o unitário", () => {
    expect(buscarPerfil("FATDOR")?.totais).toEqual(["FDO_QTDITE", "FDO_TOTITE"]);
  });
});

describe("destaque do NUMPOK", () => {
  it("perfil FATGOR destaca FGO_NUMPOK, inclusive vazio", () => {
    expect(colunaDestaque(fgo.colunas, fatgor)).toMatchObject({ nome: "FGO_NUMPOK", rotulo: "NUMPOK" });
    expect(montarTela(fgo, 0, fatgor).chave).toMatchObject({ nome: "FGO_NUMPOK", raw: "" });
  });

  it("consulta genérica ou JOIN também destaca colunas *_NUMPOK", () => {
    const d = parsearConsulta('"ID"\t"MCA_NUMPOK"\t"INF_NUMPOK"\n"1"\t"0001234567"\t"0001234567"\n');
    expect(colunaDestaque(d.colunas)).toMatchObject({ j: 1, nome: "MCA_NUMPOK" });
    expect(montarTela(d, 0).chave).toMatchObject({ texto: "0001234567" });
    expect(colunaDestaque(parsearConsulta('"NUMPOKX"\t"A"\n"1"\t"2"').colunas)).toBeNull();
  });

  it("a coluna destacada começa visível e fixada", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const j = fgo.colunas.findIndex((c) => c.nome === "FGO_NUMPOK");
    const idx = (n: string) => fgo.colunas.findIndex((c) => c.nome === n);
    expect(s.abas[0].fixas).toEqual([idx("FGO_NUMDOC"), j, idx("FGO_MOTBAI")]);
    expect(s.abas[0].visiveis[j]).toBe(true);
  });
});

const lognfe = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-lognfe.txt"), "utf-8"));

describe("LOGNFE", () => {
  it("é detectada e preserva os códigos e a chave de acesso", () => {
    expect(lognfe.avisos).toEqual([]);
    expect(lognfe.linhas).toHaveLength(10);
    const s = reducer(estadoInicial, { tipo: "criar", dados: lognfe });
    expect(s.abas[0].perfilId).toBe("LOGNFE");
    const t = montarTela(lognfe, 9, buscarPerfil("LOGNFE"));
    expect(t.titulo).toBe("NF-e 000000067471");
    const campos = Object.fromEntries(t.secoes.flatMap((x) => x.campos).map((c) => [c.nome, c]));
    expect(campos.NFE_ACESSO.raw).toBe("35260160344348000390650020000674711809524811");
    expect(campos.NFE_ACESSO.texto).toBe("3526 0160 3443 4800 0390 6500 2000 0674 7118 0952 4811");
    expect(campos.NFE_CODCLI.texto).toBe("02048893");
    expect(campos.NFE_DTAAUT.texto).toBe("02/01/2026 08:12:53");
    expect(t.indicadores[0]).toMatchObject({ campo: { texto: "AT" }, cor: "azul" });
    expect(t.indicadores[0].detalhes.map((d) => d.texto)).toEqual(["02/01/2026 08:12:53", "Autorizado o uso da NF-e"]);
  });

  it("FATGOR sugere o SELECT da LOGNFE pelo número da fatura", () => {
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const p = relacoesPendentes(s.abas[0], 0, s.abas).find((r) => r.perfilDestino === "LOGNFE");
    expect(p).toMatchObject({ tabela: "LOGNFE", colunaDestino: "NFE_NUMDOC", chave: "000000053684" });
    expect(sqlRelacionado(p!.tabela, p!.colunaDestino, p!.chave!)).toBe("SELECT * FROM LOGNFE WHERE NFE_NUMDOC = '000000053684';");
    // pedido sem fatura mostra a relação, mas sem chave
    expect(relacoesPendentes(s.abas[0], 2, s.abas).find((r) => r.perfilDestino === "LOGNFE")).toMatchObject({ chave: null });
  });

  it("com as duas abas abertas, liga pedido e NF-e nos dois sentidos", () => {
    const nfe = parsearConsulta(
      readFileSync(join(__dirname, "../../fixtures/exemplo-lognfe.txt"), "utf-8").replace('"000000003014"', '"000000053684"'),
    );
    let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    s = reducer(s, { tipo: "criar", dados: nfe });
    expect(relacionadosDoRegistro(s.abas[0], 0, s.abas)).toEqual([expect.objectContaining({ rotulo: "Log da NF-e", quantidade: 1 })]);
    expect(relacionadosDoRegistro(s.abas[1], 1, s.abas)).toEqual([
      expect.objectContaining({ rotulo: "Pedido (cabeçalho)", quantidade: 1, colunaDestinoNome: "FGO_NUMFAT" }),
    ]);
  });
});

describe("indicadores de liberação da FATGOR", () => {
  it("LIBERA e LIBCOM viram indicadores com operador e data, e saem dos chips", () => {
    const t = montarTela(fgo, 0, fatgor);
    expect(t.indicadores.map((i) => [i.campo.nome, i.campo.texto])).toEqual([
      ["FGO_LIBERA", "1"],
      ["FGO_LIBCOM", "1"],
    ]);
    expect(t.indicadores[0].detalhes.filter((d) => !d.vazio).map((d) => d.texto)).toEqual(["047", "14/10/2024 08:03:43"]);
    expect(t.status.map((s) => s.nome)).not.toContain("FGO_LIBERA");
    expect(t.status.map((s) => s.nome)).not.toContain("FGO_LIBCOM");
  });
});

describe("títulos vazios", () => {
  it("registro com a coluna de título vazia mostra (vazio)", () => {
    const p = buscarPerfil("LOGNFE");
    expect(montarTela(lognfe, 0, p).titulo).toBe("NF-e (vazio)");
    expect(resumoRegistro(lognfe, 0, p).titulo).toBe("(vazio)");
  });
});

const adtcli = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-adtcli.txt"), "utf-8"));

describe("ADTCLI (adiantamentos do cliente)", () => {
  it("é detectada e monta a Tela com crédito/débito", () => {
    expect(adtcli.avisos).toEqual([]);
    const s = reducer(estadoInicial, { tipo: "criar", dados: adtcli });
    expect(s.abas[0].perfilId).toBe("ADTCLI");
    const p = buscarPerfil("ADTCLI");
    const t0 = montarTela(adtcli, 0, p);
    expect(t0.titulo).toBe("Lançamento 299161");
    expect(t0.indicadores[0]).toMatchObject({ campo: { texto: "Crédito" }, cor: "verde" });
    expect(t0.destaques[0].texto).toBe("R$\u00a0231,63");
    expect(montarTela(adtcli, 1, p).indicadores[0]).toMatchObject({ campo: { texto: "Débito" }, cor: "vermelho" });
  });

  it("FATGOR mostra o cliente no cabeçalho e sugere o SELECT dos adiantamentos do pedido", () => {
    const t = montarTela(fgo, 0, fatgor);
    expect(t.subtitulo.find((c) => c.nome === "FGO_CODCLI")).toMatchObject({ rotulo: "Cliente", texto: "00000345" });
    const s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
    const p = relacoesPendentes(s.abas[0], 0, s.abas).find((r) => r.perfilDestino === "ADTCLI")!;
    expect(sqlRelacionado(p.tabela, p.colunaDestino, p.chave!, p.extras)).toBe(
      "SELECT * FROM ADTCLI WHERE ADT_NUMDOC = '000001000001' AND ADT_ESPDOC = 'PD' AND ADT_CODEMP = '001';",
    );
  });

  // pedido 000001109506 (empresa 001) e um adiantamento de outro pedido do mesmo cliente
  const fgoTexto = readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8");
  const outroPedido = readFileSync(join(__dirname, "../../fixtures/exemplo-adtcli.txt"), "utf-8")
    .trimEnd()
    .split("\n")
    .slice(-1)[0]
    .replace('"000001109506"', '"000000048706"')
    .replace('"299175"', '"299999"');
  const adtComOutro = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-adtcli.txt"), "utf-8").trimEnd() + "\n" + outroPedido + "\n");

  it("com a aba aberta, liga só os lançamentos do pedido (documento, espécie e empresa) e calcula o saldo", () => {
    const ped = parsearConsulta(fgoTexto.replace('"000001000001"', '"000001109506"'));
    let s = reducer(estadoInicial, { tipo: "criar", dados: ped });
    s = reducer(s, { tipo: "criar", dados: adtComOutro });
    expect(adtComOutro.linhas).toHaveLength(3);
    const [rel] = relacionadosDoRegistro(s.abas[0], 0, s.abas);
    expect(rel).toMatchObject({ rotulo: "Adiantamentos do pedido", quantidade: 2, chave: "000001109506" });
    expect(rel.extras.map((e) => [e.nome, e.chave])).toEqual([
      ["ADT_ESPDOC", "PD"],
      ["ADT_CODEMP", "001"],
    ]);
    // "Abrir na aba": o filtro também leva a chave composta
    const aberto = reducer(s, { tipo: "abrirRelacao", destino: rel.abaId, coluna: rel.colunaDestino, valor: rel.chave!, rotulo: rel.rotulo, extras: rel.extras.map((e) => ({ coluna: e.coluna, valor: e.chave })) });
    const abaAdt = aberto.abas[1];
    expect(filtrarOrdenar(abaAdt.dados, { busca: "", filtros: {}, relacoes: abaAdt.relacoes, ordenacao: [], visiveis: [] })).toEqual([0, 1]);
    expect(relacionadosDoRegistro(s.abas[1], 0, s.abas)).toEqual([expect.objectContaining({ rotulo: "Pedido", quantidade: 1 })]);
  });

  it("mesmo documento em outra empresa não é ligado", () => {
    const ped = parsearConsulta(fgoTexto.replace('"000001000001"', '"000001109506"').replace(/\n"([^"]*)"\t"001"/, '\n"$1"\t"002"'));
    expect(ped.linhas[0][ped.colunas.findIndex((c) => c.nome === "FGO_CODEMP")]).toBe("002");
    let s = reducer(estadoInicial, { tipo: "criar", dados: ped });
    s = reducer(s, { tipo: "criar", dados: adtcli });
    expect(relacionadosDoRegistro(s.abas[0], 0, s.abas)[0].quantidade).toBe(0);
    expect(calcularSaldo(adtcli, [0, 1], buscarPerfil("ADTCLI")!.saldo!)).toEqual({ creditos: 231.63, debitos: 231.63, saldo: 0 });
    expect(calcularSaldo(adtcli, [0], buscarPerfil("ADTCLI")!.saldo!)).toEqual({ creditos: 231.63, debitos: 0, saldo: 231.63 });
  });
});
