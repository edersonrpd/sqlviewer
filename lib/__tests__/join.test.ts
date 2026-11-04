import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estadoInicial, reducer } from "../estado";
import { separarPorMarcadores, sqlJoin } from "../join";
import { parsearConsulta } from "../parser";
import { dadosComColunasLigadas, relacionadosDoRegistro, relacoesPendentes } from "../relacionados";
import { montarTela } from "../tela";
import { buscarPerfil } from "../perfis";

const ler = (f: string) => readFileSync(join(__dirname, "../../fixtures", f), "utf-8").trim().split("\n").map((l) => l.split("\t"));
const fgo = ler("exemplo-fgo.txt");
const adt = ler("exemplo-adtcli.txt");

describe("sqlJoin", () => {
  it("gera o JOIN do pedido com todas as tabelas relacionadas", () => {
    const d = parsearConsulta(fgo.map((l) => l.join("\t")).join("\n"));
    expect(sqlJoin(d, 0, "FATGOR")).toBe(
      [
        "SELECT '' AS `>>FATGOR`, t0.*,",
        "       '' AS `>>FATDOR`, t1.*,",
        "       '' AS `>>CADITE`, t2.*,",
        "       '' AS `>>EXTGOR`, t3.*,",
        "       '' AS `>>MOVCAR`, t4.*,",
        "       '' AS `>>HUBCIT_INFPED`, t5.*,",
        "       '' AS `>>LOGNFE`, t6.*,",
        "       '' AS `>>ADTCLI`, t7.*,",
        "       '' AS `>>FATAUT`, t8.*",
        "  FROM FATGOR t0",
        "  LEFT JOIN FATDOR t1\n       ON t1.FDO_SEQGER = t0.AUTOINCREM AND t0.AUTOINCREM <> ''",
        "  LEFT JOIN CADITE t2\n       ON t2.ITE_CODITE = t1.FDO_CODITE AND t1.FDO_CODITE <> ''",
        "  LEFT JOIN EXTGOR t3\n       ON t3.FGO_SEQFGO = t0.AUTOINCREM AND t0.AUTOINCREM <> ''",
        "  LEFT JOIN MOVCAR t4\n       ON t4.MCA_NUMPOK = t0.FGO_NUMPOK AND t0.FGO_NUMPOK <> ''",
        "  LEFT JOIN HUBCIT_INFPED t5\n       ON t5.INF_NUMPOK = t0.FGO_NUMPOK AND t0.FGO_NUMPOK <> ''",
        "  LEFT JOIN LOGNFE t6\n       ON t6.NFE_NUMDOC = t0.FGO_NUMFAT AND t0.FGO_NUMFAT <> ''",
        // adiantamentos só do pedido: nº do documento + espécie + empresa
        "  LEFT JOIN ADTCLI t7\n       ON t7.ADT_NUMDOC = t0.FGO_NUMDOC AND t0.FGO_NUMDOC <> ''\n      AND t7.ADT_ESPDOC = t0.FGO_ESPDOC\n      AND t7.ADT_CODEMP = t0.FGO_CODEMP",
        // fila do faturamento automático: mesma chave composta (empresa em FAT_EMPDOC)
        "  LEFT JOIN FATAUT t8\n       ON t8.FAT_NUMDOC = t0.FGO_NUMDOC AND t0.FGO_NUMDOC <> ''\n      AND t8.FAT_ESPDOC = t0.FGO_ESPDOC\n      AND t8.FAT_EMPDOC = t0.FGO_CODEMP",
        " WHERE t0.AUTOINCREM = '00100000000000001001';",
      ].join("\n"),
    );
  });

  it("a partir de um item não sobe de volta para as relações do pedido", () => {
    const d = parsearConsulta('"FDO_SEQGER"\t"FDO_CODITE"\t"AUTOINCREM"\n"00100000000000001001"\t"00004"\t"00100000000000555001"');
    const sql = sqlJoin(d, 0, "FATDOR")!;
    expect(sql.match(/>>\w+/g)).toEqual([">>FATDOR", ">>CADITE", ">>CADMAR", ">>DESSIT", ">>FATGOR"]);
    // o item é identificado pelo AUTOINCREM, não pelo código do produto (que se repete em vários pedidos)
    expect(sql).toContain(" WHERE t0.AUTOINCREM = '00100000000000555001';");
  });

  it("sem perfil ou sem chave não sugere", () => {
    const d = parsearConsulta('"A"\n"1"');
    expect(sqlJoin(d, 0, null)).toBeNull();
  });
});

describe("separarPorMarcadores", () => {
  // simula o resultado do JOIN: 1 pedido × 2 itens × 2 adiantamentos = 4 linhas, EXTGOR sem correspondência
  const itensCab = ['"FDO_SEQGER"', '"FDO_CODITE"', '"FDO_TOTITE"'];
  const itens = [
    ['"00100000000000001001"', '"000123"', '"10.00"'],
    ['"00100000000000001001"', '"000456"', '"16.64"'],
  ];
  const extCab = ['"FGO_SEQFGO"', '"FGO_EMPEXP"'];
  const cab = ['">>FATGOR"', ...fgo[0], '">>FATDOR"', ...itensCab, '">>EXTGOR"', ...extCab, '">>ADTCLI"', ...adt[0]];
  const linhas: string[][] = [];
  for (const it of itens)
    for (const a of adt.slice(1)) linhas.push(['""', ...fgo[1], '""', ...it, '""', "\\N", "\\N", '""', ...a]);
  const texto = [cab, ...linhas].map((l) => l.join("\t")).join("\n");
  const partes = separarPorMarcadores(parsearConsulta(texto))!;

  it("devolve uma parte por tabela, sem linhas repetidas nem vazias", () => {
    expect(partes.map((p) => [p.tabela, p.dados.linhas.length])).toEqual([
      ["FATGOR", 1],
      ["FATDOR", 2],
      ["EXTGOR", 0],
      ["ADTCLI", 2],
    ]);
    // nomes originais: AUTOINCREM do ADTCLI não vira "AUTOINCREM (2)"
    expect(partes[3].dados.colunas.some((c) => c.nome === "AUTOINCREM")).toBe(true);
    expect(partes[0].dados.colunas).toHaveLength(178);
    expect(partes[0].dados.colunas.find((c) => c.nome === "AUTOINCREM")!.tipo).toBe("texto");
    expect(partes[1].dados.avisos.at(-1)!.mensagem).toContain("2 linha(s) repetida(s) removida(s)");
  });

  it("vira uma aba por tabela, com perfis e relações funcionando", () => {
    const s = reducer(estadoInicial, { tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    expect(s.abas.map((a) => a.perfilId)).toEqual(["FATGOR", "FATDOR", "EXTGOR", "ADTCLI"]);
    expect(s.ativa).toBe(s.abas[0].id);
    const rel = relacionadosDoRegistro(s.abas[0], 0, s.abas);
    expect(rel.map((r) => [r.rotulo, r.quantidade])).toEqual([
      ["Itens do pedido", 2],
      ["Extensão do pedido", 0],
      ["Adiantamentos do pedido", 0],
    ]);
  });

  it("resultado comum não é separado", () => {
    expect(separarPorMarcadores(parsearConsulta(fgo.map((l) => l.join("\t")).join("\n")))).toBeNull();
  });
});

describe("produto com a marca", () => {
  it("ao colar o JOIN, a ficha do item mostra a marca da aba CADMAR", () => {
    const texto = [
      ['>>CADITE', 'ITE_CODITE', 'ITE_DESITE', 'ITE_CODGRU', 'ITE_CODMAR', '>>CADMAR', 'MAR_CODMAR', 'MAR_DESMAR', 'MAR_CODEMP', 'AUTOINCREM'],
      ['', '01431', 'TERMINAL DIREC PASSAT', '003001', '000067', '', '000067', 'NAKATA', '001', '00100000000000000067'],
      ['', '01467', 'BARRA AXIAL', '003001', '000067', '', '000067', 'NAKATA', '001', '00100000000000000067'],
    ]
      .map((l) => l.map((v) => `"${v}"`).join("\t"))
      .join("\n");
    const partes = separarPorMarcadores(parsearConsulta(texto))!;
    const s = reducer(estadoInicial, { tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    expect(s.abas.map((a) => a.perfilId)).toEqual(["CADITE", "CADMAR"]);
    const [item, marca] = s.abas;
    expect(marca.dados.linhas).toHaveLength(1);
    expect(relacionadosDoRegistro(item, 0, s.abas)).toMatchObject([{ rotulo: "Marca", abaId: marca.id, quantidade: 1 }]);
    // com a aba aberta, a marca não aparece mais como consulta pendente
    expect(relacoesPendentes(item, 0, s.abas).map((r) => r.perfilDestino)).toEqual(["DESSIT", "FATDOR"]);
  });

  it("ao colar o JOIN, a DESSIT vira aba própria ligada ao item", () => {
    const texto = [
      ['>>CADITE', 'ITE_CODITE', 'ITE_DESITE', 'ITE_CODGRU', 'ITE_PESLIQ', 'ITE_EXPALT', 'ITE_EXPLAR', 'ITE_EXPPRO', '>>DESSIT', 'ITE_CODITE', 'ITE_NOMITE', 'ITE_EXPALT', 'ITE_EXPLAR', 'ITE_EXPPRO', 'ITE_ATZPRE'],
      ['', '01431', 'TERMINAL DIREC PASSAT', '003001', '0.350', '10.000', '5.000', '3.000', '', '01431', 'Terminal', '10.000', '5.000', '3.000', 'S'],
    ]
      .map((l) => l.map((v) => `"${v}"`).join("\t"))
      .join("\n");
    const partes = separarPorMarcadores(parsearConsulta(texto))!;
    const s = reducer(estadoInicial, { tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    expect(s.abas.map((a) => a.perfilId)).toEqual(["CADITE", "DESSIT"]);
    const [item, site] = s.abas;
    expect(relacionadosDoRegistro(item, 0, s.abas)).toMatchObject([{ rotulo: "Dados para o site", abaId: site.id, quantidade: 1 }]);
  });
});

describe("medidas da DESSIT na Tela do item", () => {
  const tabela = (linhas: string[][]) => linhas.map((l) => l.map((v) => `"${v}"`).join("\t")).join("\n");
  it("sem as medidas copiadas, a Tela do item traz altura/largura/profundidade da aba DESSIT, junto do peso", () => {
    const texto = tabela([
      ['>>CADITE', 'ITE_CODITE', 'ITE_DESITE', 'ITE_CODGRU', 'ITE_PESLIQ', '>>DESSIT', 'ITE_CODITE', 'ITE_NOMITE', 'ITE_ATZPRE', 'ITE_EXPALT', 'ITE_EXPLAR', 'ITE_EXPPRO'],
      ['', '01431', 'TERMINAL', '003001', '0.350', '', '01431', 'Terminal', 'S', '10.000', '5.000', '3.000'],
      ['', '01467', 'BARRA', '003001', '0.500', '', '01467', 'Barra', 'S', '20.000', '6.000', '4.000'],
    ]);
    const partes = separarPorMarcadores(parsearConsulta(texto))!;
    const s = reducer(estadoInicial, { tipo: "criarVarias", dados: partes.map((p) => p.dados) });
    const [item] = s.abas;
    const d = dadosComColunasLigadas(item, 1, s.abas);
    const tela = montarTela(d.dados, d.registro, buscarPerfil("CADITE"));
    const emb = tela.secoes.find((x) => x.titulo === "Embalagem e venda")!;
    expect(emb.campos.map((c) => [c.nome, c.raw])).toEqual([
      ["ITE_PESLIQ", "0.500"],
      ["ITE_EXPALT", "20.000"],
      ["ITE_EXPLAR", "6.000"],
      ["ITE_EXPPRO", "4.000"],
    ]);
    // sem a aba da DESSIT, a Tela fica só com o que veio na CADITE
    expect(dadosComColunasLigadas(item, 1, [item]).dados).toBe(item.dados);
  });
});
