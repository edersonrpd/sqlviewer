import type { Aba } from "./estado";
import { formatarData } from "./formatacao";
import { buscarPerfil, chaveRelacao, linhasLigadas } from "./perfis";
import { relacionadosDoRegistro } from "./relacionados";
import { calcularSaldo } from "./tela";
import type { ResultadoParse } from "./tipos";

/**
 * Diagnóstico automático: regras que olham o registro aberto na Tela e os
 * registros ligados nas outras abas e apontam inconsistências comuns.
 *
 * Para criar uma regra, acrescente uma função em REGRAS[<id do perfil>]. Ela
 * recebe o contexto (valores do registro e acesso às abas relacionadas) e
 * devolve achados, ou uma "pendência" quando a aba necessária não está aberta.
 */

export type NivelAchado = "erro" | "alerta" | "info" | "ok";
export type Achado = { nivel: NivelAchado; titulo: string; detalhe?: string };

export type Diagnostico = {
  achados: Achado[];
  /** verificações que dependem de abas não abertas (ex.: "Itens (FATDOR)") */
  pendentes: string[];
};

type Relacao = { dados: ResultadoParse; linhas: number[] };

export type Contexto = {
  /** valor com trim; null quando NULL ou vazio */
  texto: (coluna: string) => string | null;
  numero: (coluna: string) => number | null;
  existe: (coluna: string) => boolean;
  /** registros ligados na aba do perfil; null se a aba não está aberta */
  relacionado: (perfil: string) => Relacao | null;
  /** valor de uma coluna numa linha de outra aba */
  valorEm: (r: Relacao, i: number, coluna: string) => string | null;
};

type Resultado = Achado | Achado[] | { pendente: string } | null;
type Regra = (c: Contexto) => Resultado;

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (n: number) => moeda.format(n);
const iguais = (a: number, b: number) => Math.abs(a - b) < 0.005;

const REGRAS: Record<string, Regra[]> = {
  FATGOR: [
    // itens × total de produtos
    (c) => {
      const r = c.relacionado("FATDOR");
      if (!r) return { pendente: "Itens (FATDOR)" };
      if (r.linhas.length === 0) return { nivel: "erro", titulo: "Pedido sem itens na FATDOR" };
      const soma = r.linhas.reduce((s, i) => s + (Number(c.valorEm(r, i, "FDO_TOTITE")) || 0), 0);
      const totpro = c.numero("FGO_TOTPRO");
      if (totpro === null) return null;
      return iguais(soma, totpro)
        ? { nivel: "ok", titulo: `${r.linhas.length} item(ns) somam ${brl(soma)}, igual ao total de produtos` }
        : {
            nivel: "alerta",
            titulo: "Soma dos itens diferente do total de produtos",
            detalhe: `Itens (FDO_TOTITE): ${brl(soma)} · Total de produtos (FGO_TOTPRO): ${brl(totpro)} · diferença ${brl(soma - totpro)}`,
          };
    },

    // fatura × NF-e
    (c) => {
      const numfat = c.texto("FGO_NUMFAT");
      if (!c.existe("FGO_NUMFAT")) return null;
      if (!numfat) return { nivel: "info", titulo: "Pedido ainda sem fatura (FGO_NUMFAT vazio)" };
      const r = c.relacionado("LOGNFE");
      if (!r) return { pendente: "NF-e (LOGNFE)" };
      if (r.linhas.length === 0)
        return { nivel: "alerta", titulo: `Fatura ${numfat} sem registro na LOGNFE`, detalhe: "A NF-e pode não ter sido transmitida." };
      const autorizada = r.linhas.find((i) => c.valorEm(r, i, "NFE_DTAAUT") || /autorizad/i.test(c.valorEm(r, i, "NFE_OBSERV") ?? ""));
      if (autorizada !== undefined) {
        const dta = c.valorEm(r, autorizada, "NFE_DTAAUT");
        return { nivel: "ok", titulo: `NF-e ${numfat} autorizada${dta ? ` em ${formatarData(dta)} ${dta.slice(11)}` : ""}` };
      }
      const i = r.linhas[0];
      return {
        nivel: "alerta",
        titulo: `NF-e ${numfat} sem autorização registrada`,
        detalhe: `Status: ${c.valorEm(r, i, "NFE_STATUS") ?? "—"} · Retorno: ${c.valorEm(r, i, "NFE_OBSERV") ?? "—"}`,
      };
    },

    // valor faturado × valor contábil
    (c) => {
      if (!c.texto("FGO_NUMFAT")) return null;
      const valfat = c.numero("FGO_VALFAT");
      const vlrcon = c.numero("FGO_VLRCON");
      if (valfat === null || vlrcon === null) return null;
      return iguais(valfat, vlrcon)
        ? { nivel: "ok", titulo: `Valor faturado igual ao valor contábil (${brl(vlrcon)})` }
        : {
            nivel: "alerta",
            titulo: "Valor faturado diferente do valor contábil",
            detalhe: `Faturado (FGO_VALFAT): ${brl(valfat)} · Contábil (FGO_VLRCON): ${brl(vlrcon)}`,
          };
    },

    // pedido de e-commerce sem NUMPOK
    (c) => {
      const mensagens = ["FGO_MEN001", "FGO_MEN002", "FGO_MENEXP"].map((m) => c.texto(m) ?? "").join(" ");
      if (!/E-?COMMERCE/i.test(mensagens)) return null;
      return c.texto("FGO_NUMPOK")
        ? { nivel: "ok", titulo: "Pedido de e-commerce com NUMPOK" }
        : { nivel: "erro", titulo: "Pedido de e-commerce sem NUMPOK", detalhe: "A mensagem indica e-commerce, mas FGO_NUMPOK está vazio." };
    },

    // adiantamento do pedido
    (c) => {
      const r = c.relacionado("ADTCLI");
      if (!r) return { pendente: "Adiantamentos (ADTCLI)" };
      const numdoc = c.texto("FGO_NUMDOC");
      // lançamentos deste pedido (ADT_NUMDOC); sem a coluna, considera o extrato do cliente
      const temNumdoc = r.dados.colunas.some((col) => col.nome === "ADT_NUMDOC");
      const linhas = temNumdoc ? r.linhas.filter((i) => c.valorEm(r, i, "ADT_NUMDOC") === numdoc) : r.linhas;
      const escopo = temNumdoc ? "do pedido" : "do cliente";
      if (linhas.length === 0) return { nivel: "info", titulo: `Sem adiantamentos ${escopo}` };
      const cfg = buscarPerfil("ADTCLI")?.saldo;
      const s = cfg ? calcularSaldo(r.dados, linhas, cfg) : null;
      if (!s) return null;
      const detalhe = `${linhas.length} lançamento(s) · créditos ${brl(s.creditos)} · débitos ${brl(s.debitos)}`;
      return s.saldo === 0
        ? { nivel: "ok", titulo: `Adiantamento ${escopo} zerado`, detalhe }
        : { nivel: "alerta", titulo: `Saldo de adiantamento ${escopo}: ${brl(s.saldo)}`, detalhe };
    },
  ],
};

export function temDiagnostico(perfilId: string | null): boolean {
  return !!perfilId && (REGRAS[perfilId]?.length ?? 0) > 0;
}

export function diagnosticar(aba: Aba, registro: number, abas: Aba[]): Diagnostico {
  const regras = aba.perfilId ? REGRAS[aba.perfilId] : undefined;
  if (!regras) return { achados: [], pendentes: [] };
  const { dados } = aba;
  const linha = dados.linhas[registro];
  const indice = new Map(dados.colunas.map((c, j) => [c.nome, j]));
  const relacionados = relacionadosDoRegistro(aba, registro, abas);

  const ctx: Contexto = {
    texto: (col) => {
      const j = indice.get(col);
      return j === undefined ? null : chaveRelacao(linha[j]);
    },
    numero: (col) => {
      const v = ctx.texto(col);
      const n = v === null ? NaN : Number(v);
      return Number.isFinite(n) ? n : null;
    },
    existe: (col) => indice.has(col),
    relacionado: (perfil) => {
      const rel = relacionados.find((r) => abas.find((a) => a.id === r.abaId)?.perfilId === perfil);
      if (!rel) return null;
      const destino = abas.find((a) => a.id === rel.abaId)!;
      return { dados: destino.dados, linhas: linhasLigadas(rel.chave, destino.dados.linhas, rel.colunaDestino) };
    },
    valorEm: (r, i, col) => {
      const j = r.dados.colunas.findIndex((c) => c.nome === col);
      return j < 0 ? null : chaveRelacao(r.dados.linhas[i][j]);
    },
  };

  const achados: Achado[] = [];
  const pendentes: string[] = [];
  for (const regra of regras) {
    const res = regra(ctx);
    if (!res) continue;
    if ("pendente" in res) pendentes.push(res.pendente);
    else achados.push(...(Array.isArray(res) ? res : [res]));
  }
  const ordem: Record<NivelAchado, number> = { erro: 0, alerta: 1, info: 2, ok: 3 };
  achados.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  return { achados, pendentes };
}

/** Nível mais grave do diagnóstico (para a bolinha na lista de registros). */
export function nivelGeral(d: Diagnostico): NivelAchado | null {
  return d.achados[0]?.nivel ?? null;
}
