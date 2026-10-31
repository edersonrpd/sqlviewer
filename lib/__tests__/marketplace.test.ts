import { describe, expect, it } from "vitest";
import { BUSCAS_RAPIDAS } from "@/config/perfis";
import { identificarMarketplace, normalizarNumpok } from "../marketplace";
import { montarConsulta } from "../montar";

describe("marketplace pelo NUMPOK", () => {
  it("acrescenta o prefixo do marketplace ao número digitado", () => {
    expect(normalizarNumpok("SHML48393430410")).toBe("MLB_SHML48393430410");
    expect(normalizarNumpok("2610314CV1MKT2")).toBe("SHP_2610314CV1MKT2");
    expect(normalizarNumpok("702-8724657-3393834")).toBe("AMZ_702-8724657-3393834");
    expect(normalizarNumpok("LU-1582670110102560-1")).toBe("MGL_LU-1582670110102560-1");
  });

  it("não duplica o prefixo, padroniza maiúsculas e deixa os demais como estão", () => {
    expect(normalizarNumpok("MLB_SHML48393430410")).toBe("MLB_SHML48393430410");
    expect(normalizarNumpok(" shml48393430410 ")).toBe("MLB_SHML48393430410");
    expect(normalizarNumpok("lu-1582670110102560-1")).toBe("MGL_LU-1582670110102560-1");
    expect(normalizarNumpok("2000123456789")).toBe("2000123456789");
    expect(normalizarNumpok("123")).toBe("123");
  });

  it("identifica o marketplace com ou sem prefixo", () => {
    expect(identificarMarketplace("MLB_SHML48393430410")?.nome).toBe("Mercado Livre");
    expect(identificarMarketplace("SHP_2610314CV1MKT2")?.nome).toBe("Shopee");
    expect(identificarMarketplace("702-8724657-3393834")?.nome).toBe("Amazon");
    expect(identificarMarketplace("MGL_LU-1582670110102560-1")?.nome).toBe("Magalu");
    expect(identificarMarketplace("2000123456789")).toBeNull();
    expect(identificarMarketplace("")).toBeNull();
    expect(identificarMarketplace(null)).toBeNull();
  });

  it("NUMPOK é a primeira opção do Montar consulta e o SQL leva o prefixo", () => {
    const numpok = BUSCAS_RAPIDAS[0];
    expect(numpok.id).toBe("numpok");
    expect(montarConsulta(numpok, ["SHML48393430410"], false)).toBe("SELECT * FROM FATGOR WHERE FGO_NUMPOK = 'MLB_SHML48393430410';");
    expect(montarConsulta(numpok, ["SHML48393430410", "MLB_SHML48393430410", "702-8724657-3393834"], false)).toBe(
      "SELECT * FROM FATGOR WHERE FGO_NUMPOK IN ('MLB_SHML48393430410', 'AMZ_702-8724657-3393834');",
    );
    expect(montarConsulta(numpok, ["2610314CV1MKT2"], true)).toContain("t0.FGO_NUMPOK = 'SHP_2610314CV1MKT2'");
  });
});
