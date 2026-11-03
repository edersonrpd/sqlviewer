import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removerPrefixoMarketplace } from "../marketplace";
import { buscaRapida, montarConsulta } from "../montar";
import { parsearConsulta } from "../parser";
import { buscarPerfil, detectarPerfil } from "../perfis";
import { montarTela } from "../tela";

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
    expect(t.titulo).toBe("Item do pedido HUB 06377");
    expect(t.secoes.some((s) => s.titulo === "Outros campos")).toBe(false);
  });
});
