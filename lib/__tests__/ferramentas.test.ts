import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUSCAS_RAPIDAS } from "@/config/perfis";
import { compararRegistros } from "../comparar";
import { estadoInicial, reducer } from "../estado";
import { montarConsulta, separarValores, temJoin } from "../montar";
import { parsearConsulta } from "../parser";
import { buscarPerfil } from "../perfis";
import { lerSessao, nomeArquivoSessao, serializarSessao } from "../sessao";

const fgo = parsearConsulta(readFileSync(join(__dirname, "../../fixtures/exemplo-fgo.txt"), "utf-8"));
const busca = (id: string) => BUSCAS_RAPIDAS.find((b) => b.id === id)!;

describe("compararRegistros", () => {
  const d = parsearConsulta('"FGO_NUMDOC"\t"FGO_VLRCON"\t"FGO_MOTBAI"\t"X"\n"001"\t"10.00"\t\\N\t" a"\n"002"\t"10.00"\t""\t"a "');
  const r = compararRegistros(d, 0, 1, buscarPerfil("FATGOR"));

  it("aponta as colunas diferentes, com o rótulo da Tela", () => {
    expect(r.filter((x) => !x.igual).map((x) => [x.nome, x.rotulo])).toEqual([
      ["FGO_NUMDOC", "Nº documento"],
      ["FGO_MOTBAI", "Motivo da baixa"],
    ]);
  });

  it("NULL só é igual a NULL; espaços nas pontas não contam", () => {
    expect(r.find((x) => x.nome === "FGO_MOTBAI")).toMatchObject({ a: null, b: "", igual: false });
    expect(r.find((x) => x.nome === "X")!.igual).toBe(true);
  });
});

describe("sessão em arquivo", () => {
  let s = reducer(estadoInicial, { tipo: "criar", dados: fgo });
  s = reducer(s, { tipo: "atualizar", id: s.abas[0].id, patch: { busca: "abc", selecionadas: new Set([1, 2]), nome: "Caso 123" } });

  it("salva e abre de volta com dados, layout e seleção", () => {
    const lida = lerSessao(serializarSessao(s));
    expect(lida.abas).toHaveLength(1);
    const a = lida.abas[0];
    expect(a).toMatchObject({ nome: "Caso 123", busca: "abc", perfilId: "FATGOR" });
    expect([...a.selecionadas]).toEqual([1, 2]);
    expect(a.dados.linhas).toEqual(fgo.linhas);
    expect(a.deteccao.tipo).toBe("perfil");
  });

  it("acrescenta as abas às abertas com ids novos", () => {
    const lida = lerSessao(serializarSessao(s));
    const s2 = reducer(s, { tipo: "abrirSessao", abas: lida.abas, ativa: lida.ativa });
    expect(s2.abas.map((a) => a.id)).toEqual(["aba-1", "aba-2"]);
    expect(s2.ativa).toBe("aba-2");
  });

  it("recusa arquivos que não são sessão", () => {
    expect(() => lerSessao("não é json")).toThrow("JSON inválido");
    expect(() => lerSessao('{"app":"outro","abas":[]}')).toThrow("não é uma sessão");
    expect(() => lerSessao('{"app":"sql-viewer","versao":1,"abas":[{}]}')).toThrow("Aba 1");
  });

  it("nome do arquivo com data e hora", () => {
    expect(nomeArquivoSessao(new Date(2026, 9, 30, 14, 5))).toBe("sqlviewer-sessao-20261030-1405.json");
  });
});

describe("montar consulta", () => {
  it("separa valores por vírgula, espaço e quebra de linha, sem aspas nem repetição", () => {
    expect(separarValores(" '001', 002;003\n001  \"004\" ")).toEqual(["001", "002", "003", "004"]);
    expect(separarValores("   ")).toEqual([]);
  });

  it("SELECT simples, com = para um valor e IN para vários", () => {
    expect(montarConsulta(busca("item"), ["00004"], false)).toBe("SELECT * FROM CADITE WHERE ITE_CODITE = '00004';");
    expect(montarConsulta(busca("nf"), ["1", "2"], false)).toBe("SELECT * FROM FATGOR WHERE FGO_NUMFAT IN ('1', '2');");
    expect(montarConsulta(busca("item"), [], false)).toBeNull();
  });

  it("JOIN completo do pedido pelo número do documento", () => {
    const sql = montarConsulta(busca("pedido"), ["000001000001"], true)!;
    expect(sql.match(/>>\w+/g)).toEqual([">>FATGOR", ">>FATDOR", ">>CADITE", ">>EXTGOR", ">>MOVCAR", ">>HUBCIT_INFPED", ">>LOGNFE", ">>ADTCLI"]);
    expect(sql.endsWith(" WHERE t0.FGO_NUMDOC = '000001000001';")).toBe(true);
  });

  it("toda busca aponta para um perfil existente", () => {
    for (const b of BUSCAS_RAPIDAS) expect(buscarPerfil(b.perfil), b.id).toBeDefined();
    expect(temJoin(busca("pedido"))).toBe(true);
  });
});
