import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removerPrefixoMarketplace } from "../marketplace";
import { buscaRapida, montarConsulta } from "../montar";
import { parsearConsulta } from "../parser";
import { buscarPerfil, detectarPerfil } from "../perfis";
import { separarPorMarcadores } from "../join";
import { montarTela, resumoRegistro } from "../tela";

const texto = (nome: string) => readFileSync(join(__dirname, "../../fixtures", nome), "utf-8");
const pedidos = parsearConsulta(texto("exemplo-hub-pedidos.txt"));
const itens = parsearConsulta(texto("exemplo-hub-itens-pedidos.txt"));

describe("HUBCitel – Pedido", () => {
  it("detecta as tabelas pedidos e itens_pedidos", () => {
    expect(pedidos.avisos).toEqual([]);
    expect(detectarPerfil(pedidos.colunas.map((c) => c.nome))).toMatchObject({ tipo: "perfil", perfil: { id: "HUB_PEDIDOS" } });
    expect(detectarPerfil(itens.colunas.map((c) => c.nome))).toMatchObject({ tipo: "perfil", perfil: { id: "HUB_ITENS_PEDIDOS" } });
  });

  it("montar consulta: SELECT simples e JOIN com os itens pelo order_id e domínio", () => {
    const b = buscaRapida("hubpedido")!;
    expect(montarConsulta(b, ["SHML48412293490"], false)).toBe("SELECT * FROM pedidos WHERE order_id = 'SHML48412293490';");
    // com o prefixo do NUMPOK (como está na FATGOR) também funciona
    expect(montarConsulta(b, ["MLB_SHML48412293490"], false)).toBe("SELECT * FROM pedidos WHERE order_id = 'SHML48412293490';");
    expect(montarConsulta(b, ["SHML48412293490"], true)).toBe(
      [
        "SELECT '' AS `>>HUB_PEDIDOS`, t0.*,",
        "       '' AS `>>HUB_ITENS_PEDIDOS`, t1.*",
        "  FROM pedidos t0",
        "  LEFT JOIN itens_pedidos t1\n       ON t1.order_id = t0.order_id AND t0.order_id <> ''\n      AND t1.dominio = t0.dominio",
        " WHERE t0.order_id = 'SHML48412293490';",
      ].join("\n"),
    );
  });

  it("as tabelas do HUB ficam em outro banco e não se ligam às do ERP", () => {
    expect(buscarPerfil("HUB_PEDIDOS")?.banco).toBe("HUB");
    expect(buscarPerfil("HUB_ITENS_PEDIDOS")?.banco).toBe("HUB");
    const sql = montarConsulta(buscaRapida("hubpedido")!, ["SHML1"], true)!;
    expect(sql.match(/>>\w+/g)).toEqual([">>HUB_PEDIDOS", ">>HUB_ITENS_PEDIDOS"]);
    expect(buscarPerfil("FATGOR")?.banco).toBeUndefined();
  });

  it("remove só prefixos conhecidos", () => {
    expect(removerPrefixoMarketplace(" mlb_shml1 ")).toBe("SHML1");
    expect(removerPrefixoMarketplace("SHML1")).toBe("SHML1");
    expect(removerPrefixoMarketplace("ABC_1")).toBe("ABC_1");
  });

  it("Tela do pedido", () => {
    const t = montarTela(pedidos, 0, buscarPerfil("HUB_PEDIDOS"));
    expect(t.titulo).toBe("Pedido HUB SHML48412293490");
    expect(t.secoes.map((s) => s.titulo)).toEqual(["Identificação", "Datas", "Valores", "Envio e transporte", "Endereço de entrega", "Observações"]);
  });

  it("Tela do item", () => {
    const t = montarTela(itens, 0, buscarPerfil("HUB_ITENS_PEDIDOS"));
    expect(t.titulo).toBe("Item do pedido HUB SHML48412293490");
    expect(t.secoes.some((s) => s.titulo === "Outros campos")).toBe(false);
  });
});

describe("HUBCitel – filtro por domínio", () => {
  const b = (id: string) => buscaRapida(id)!;

  it("pedido com domínio opcional", () => {
    expect(montarConsulta(b("hubpedido"), ["SHML1"], false, ["ulitintas"])).toBe(
      "SELECT * FROM pedidos WHERE order_id = 'SHML1' AND dominio = 'ulitintas';",
    );
    expect(montarConsulta(b("hubpedido"), ["SHML1"], true, ["ulitintas"])!.endsWith(" WHERE t0.order_id = 'SHML1' AND t0.dominio = 'ulitintas';")).toBe(true);
  });

  it("itens vendidos por código e domínio, com o cabeçalho do pedido", () => {
    expect(montarConsulta(b("hubitem"), ["06377"], false, ["ulitintas"])).toBe(
      "SELECT * FROM itens_pedidos WHERE codigo_item = '06377' AND dominio = 'ulitintas';",
    );
    expect(montarConsulta(b("hubitem"), ["06377", "06378"], true, ["ulitintas"])).toBe(
      [
        "SELECT '' AS `>>HUB_ITENS_PEDIDOS`, t0.*,",
        "       t1.data_pedido, t1.status AS status_pedido, t1.valor_total AS valor_total_pedido,",
        "       '' AS `>>HUB_PEDIDOS`, t1.*",
        "  FROM itens_pedidos t0",
        "  LEFT JOIN pedidos t1\n       ON t1.order_id = t0.order_id AND t0.order_id <> ''\n      AND t1.dominio = t0.dominio",
        " WHERE t0.codigo_item IN ('06377', '06378') AND t0.dominio = 'ulitintas';",
      ].join("\n"),
    );
    // sem domínio: todos os clientes
    expect(montarConsulta(b("hubitem"), ["06377"], false)).toBe("SELECT * FROM itens_pedidos WHERE codigo_item = '06377';");
  });
});

describe("HUBCitel – resultado do JOIN de itens vendidos", () => {
  const partes = separarPorMarcadores(parsearConsulta(texto("exemplo-hub-itens-join.txt")))!;

  it("separa itens e cabeçalhos, inclusive com quebra de linha no complemento", () => {
    expect(partes.map((p) => [p.tabela, p.dados.linhas.length])).toEqual([
      ["HUB_ITENS_PEDIDOS", 4],
      ["HUB_PEDIDOS", 4],
    ]);
    // código do item continua texto (zeros à esquerda)
    const itens = partes[0].dados;
    expect(itens.colunas.find((c) => c.nome === "codigo_item")?.tipo).toBe("texto");
  });

  it("na lista, cada item aparece pelo pedido (o código é o mesmo em todas as linhas)", () => {
    const itens = partes[0].dados;
    const r = resumoRegistro(itens, 1, buscarPerfil("HUB_ITENS_PEDIDOS"));
    expect(r.titulo).toBe("SHML47573359018");
    expect(r.detalhe).toBe("06377 · 7");
  });

  it("a aba de itens traz data, status e total do pedido para filtrar por data", () => {
    const itens = partes[0].dados;
    const col = (n: string) => itens.colunas.find((c) => c.nome === n);
    expect(col("data_pedido")?.tipo).toBe("datahora");
    expect(col("status_pedido")).toBeDefined();
    expect(col("valor_total_pedido")?.tipo).toBe("decimal");
    // continua sendo o perfil de itens (a aba do cabeçalho abre separada)
    expect(detectarPerfil(itens.colunas.map((c) => c.nome))).toMatchObject({ perfil: { id: "HUB_ITENS_PEDIDOS" } });
    expect(partes[1].dados.colunas).toHaveLength(57);
  });

  it("status com cor", () => {
    const t = montarTela(partes[0].dados, 1, buscarPerfil("HUB_ITENS_PEDIDOS"));
    expect(t.status).toEqual([
      expect.objectContaining({ texto: "Cancelado (cancelled)", cor: "vermelho" }),
      expect.objectContaining({ texto: "Cancelado (CanceledOrder)", cor: "vermelho" }),
    ]);
    const p = montarTela(partes[1].dados, 0, buscarPerfil("HUB_PEDIDOS"));
    expect(p.status[0]).toEqual(expect.objectContaining({ texto: "Pago (paid)", cor: "verde" }));
  });
});
