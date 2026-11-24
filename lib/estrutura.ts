import type { Aba } from "./estado";
import { PREFIXO_MARCADOR } from "./join";
import type { ResultadoParse, Valor } from "./tipos";

/**
 * Estrutura de produto (KIT) montada com as abas abertas:
 * GERMAT (cabeçalho do KIT) → DETMAT (componentes, DMT_SEQGER = AUTOINCREM)
 * → CADITE (descrição) e ITEGER (custos e saldo por empresa) de cada componente.
 * Igual à tela "Estruturas" do AUTCOM: quantidade, custo, total, saldo e quantos
 * KITs dá para montar com o saldo dos componentes.
 */

export type NoEstrutura = {
  codigo: string;
  empresa: string | null;
  descricao: string | null;
  referencia: string | null;
  codFabrica: string | null;
  marca: string | null;
  /** quantidade por KIT (null na raiz) */
  quantidade: number | null;
  /** quantidade necessária para o pedido (quantidade do item × quantidades da estrutura) */
  necessario: number | null;
  /** custo gravado na estrutura (DMT_CUSITE) */
  custoEstrutura: number | null;
  /** ITEGER: custo (ITE_PRECUS), preço da última compra (ITE_PREULT), preço de compra (ITE_PRECOM) e saldo (ITE_SALDOS) */
  custo: number | null;
  ultimaCompra: number | null;
  precoCompra: number | null;
  saldo: number | null;
  /** cadastro / preços encontrados nas abas abertas (null = aba não aberta) */
  temCadastro: boolean | null;
  temPrecos: boolean | null;
  /** é um KIT (tem GERMAT aberta) */
  kit: { seq: string; componentes: NoEstrutura[]; componentesConsultados: boolean } | null;
  /** para KIT: menor saldo ÷ quantidade entre os componentes */
  kitsPossiveis: number | null;
  /** volta de estrutura já vista acima (ciclo) */
  ciclo?: boolean;
};

export type Aviso = { nivel: "erro" | "atencao" | "info"; texto: string };

export type EstruturaItem = {
  raiz: NoEstrutura;
  /** quantidade do item no pedido (FATDOR), quando veio de um pedido */
  quantidadePedido: number | null;
  totais: { custoEstrutura: number | null; custo: number | null; ultimaCompra: number | null };
  avisos: Aviso[];
};

/** Código comparável: sem espaços e sem zeros à esquerda ("06931" = "6931"). */
export function normalizarCodigo(v: Valor | undefined): string | null {
  const t = v?.trim();
  if (!t) return null;
  return t.replace(/^0+(?=\d)/, "");
}

const num = (v: Valor | undefined): number | null => {
  const t = v?.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type Tabela = { dados: ResultadoParse; col: (nome: string) => number };

function tabelas(abas: Aba[], perfilId: string): Tabela[] {
  return abas
    .filter((a) => a.perfilId === perfilId)
    .map((a) => ({ dados: a.dados, col: (nome: string) => a.dados.colunas.findIndex((c) => c.nome === nome) }));
}

/** Primeira linha (de qualquer aba do perfil) em que todas as colunas batem. */
function acharLinha(ts: Tabela[], filtros: { coluna: string; valor: string | null; codigo?: boolean }[]): { t: Tabela; linha: Valor[] } | null {
  for (const t of ts) {
    const js = filtros.map((f) => ({ ...f, j: t.col(f.coluna) }));
    if (js.some((f) => f.j < 0 && f.valor !== null)) continue;
    for (const linha of t.dados.linhas) {
      const ok = js.every((f) => {
        if (f.valor === null || f.j < 0) return true;
        const v = f.codigo ? normalizarCodigo(linha[f.j]) : linha[f.j]?.trim();
        return v === (f.codigo ? normalizarCodigo(f.valor) : f.valor);
      });
      if (ok) return { t, linha };
    }
  }
  return null;
}

const ler = (achado: { t: Tabela; linha: Valor[] } | null, coluna: string): Valor => {
  if (!achado) return null;
  const j = achado.t.col(coluna);
  return j < 0 ? null : achado.linha[j];
};

/** Profundidade máxima de KIT dentro de KIT. */
const MAX_NIVEL = 5;

export function montarNo(
  abas: Aba[],
  codigo: string,
  empresa: string | null,
  quantidade: number | null,
  necessario: number | null,
  custoEstrutura: number | null,
  vistos: string[] = [],
): NoEstrutura {
  const cadite = tabelas(abas, "CADITE");
  const iteger = tabelas(abas, "ITEGER");
  const germat = tabelas(abas, "GERMAT");
  const detmat = tabelas(abas, "DETMAT");

  const cad = acharLinha(cadite, [{ coluna: "ITE_CODITE", valor: codigo, codigo: true }]);
  // preços por empresa; sem a da empresa, qualquer uma
  const pre =
    acharLinha(iteger, [
      { coluna: "ITE_CODITE", valor: codigo, codigo: true },
      { coluna: "ITE_CODEMP", valor: empresa },
    ]) ?? (empresa ? null : acharLinha(iteger, [{ coluna: "ITE_CODITE", valor: codigo, codigo: true }]));

  const no: NoEstrutura = {
    codigo,
    empresa,
    descricao: ler(cad, "ITE_DESITE"),
    referencia: ler(cad, "ITE_REFERE"),
    codFabrica: ler(cad, "ITE_CODFAB"),
    marca: ler(cad, "ITE_CODMAR"),
    quantidade,
    necessario,
    custoEstrutura,
    custo: num(ler(pre, "ITE_PRECUS")),
    ultimaCompra: num(ler(pre, "ITE_PREULT")),
    precoCompra: num(ler(pre, "ITE_PRECOM")),
    saldo: num(ler(pre, "ITE_SALDOS")),
    temCadastro: cadite.length ? cad !== null : null,
    temPrecos: iteger.length ? pre !== null : null,
    kit: null,
    kitsPossiveis: null,
  };

  const chave = `${normalizarCodigo(codigo)}|${empresa ?? ""}`;
  if (vistos.includes(chave)) return { ...no, ciclo: true };
  if (vistos.length >= MAX_NIVEL) return no;

  const g =
    acharLinha(germat, [
      { coluna: "GMT_CODITE", valor: codigo, codigo: true },
      { coluna: "GMT_CODEMP", valor: empresa },
    ]) ?? (empresa ? null : acharLinha(germat, [{ coluna: "GMT_CODITE", valor: codigo, codigo: true }]));
  if (!g) return no;
  const seq = ler(g, "AUTOINCREM")?.trim() ?? "";
  const empresaKit = ler(g, "GMT_CODEMP")?.trim() || empresa;

  const componentes: NoEstrutura[] = [];
  for (const t of detmat) {
    const jSeq = t.col("DMT_SEQGER");
    if (jSeq < 0) continue;
    const linhas = t.dados.linhas
      .filter((l) => l[jSeq]?.trim() === seq)
      .sort((a, b) => (num(a[t.col("DMT_SEQUEN")]) ?? 0) - (num(b[t.col("DMT_SEQUEN")]) ?? 0));
    for (const l of linhas) {
      const sub = l[t.col("DMT_ITESUB")]?.trim();
      if (!sub) continue;
      const q = num(l[t.col("DMT_QTDITE")]);
      const empresaComp = l[t.col("DMT_CODEMP")]?.trim() || empresaKit;
      componentes.push(
        montarNo(abas, sub, empresaComp, q, necessario !== null && q !== null ? necessario * q : null, num(l[t.col("DMT_CUSITE")]), [...vistos, chave]),
      );
    }
  }
  no.kit = { seq, componentes, componentesConsultados: detmat.length > 0 };
  // quantos KITs o saldo dos componentes permite montar
  const razoes = componentes.map((c) => (c.saldo !== null && c.quantidade ? c.saldo / c.quantidade : null));
  no.kitsPossiveis = razoes.length && razoes.every((r) => r !== null) ? Math.max(0, Math.min(...(razoes as number[]))) : null;
  return no;
}

const soma = (nos: NoEstrutura[], f: (n: NoEstrutura) => number | null): number | null => {
  let total = 0;
  for (const n of nos) {
    const v = f(n);
    if (v === null || n.quantidade === null) return null;
    total += v * n.quantidade;
  }
  return total;
};

const centavos = (n: number) => Math.round(n * 100);
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function avisosDaEstrutura(e: EstruturaItem): Aviso[] {
  const avisos: Aviso[] = [];
  const r = e.raiz;
  const visitar = (n: NoEstrutura, caminho: string) => {
    if (n.ciclo) avisos.push({ nivel: "erro", texto: `${caminho}: a estrutura volta para ela mesma (ciclo)` });
    if (!n.kit) return;
    if (n.kit.componentesConsultados && n.kit.componentes.length === 0)
      avisos.push({ nivel: "erro", texto: `${caminho}: KIT sem componentes na DETMAT` });
    for (const c of n.kit.componentes) {
      const nome = `${caminho} › ${c.codigo}`;
      if (!c.quantidade) avisos.push({ nivel: "erro", texto: `${nome}: quantidade zerada na estrutura` });
      if (c.temCadastro === false) avisos.push({ nivel: "erro", texto: `${nome}: componente sem cadastro na CADITE` });
      if (c.necessario !== null && c.saldo !== null && c.saldo < c.necessario)
        avisos.push({ nivel: "atencao", texto: `${nome}: saldo ${fmt(c.saldo)} não cobre os ${fmt(c.necessario)} do pedido` });
      visitar(c, nome);
    }
  };
  visitar(r, r.codigo);

  const comps = r.kit?.componentes ?? [];
  if (comps.length) {
    // preço de compra do KIT calculado com custos antigos da estrutura
    const t = e.totais;
    if (r.precoCompra !== null && t.custoEstrutura !== null && t.ultimaCompra !== null && centavos(t.ultimaCompra) !== centavos(t.custoEstrutura)) {
      const igualGravado = centavos(r.precoCompra) === centavos(t.custoEstrutura);
      avisos.push({
        nivel: "atencao",
        texto: igualGravado
          ? `Preço de compra do KIT (${fmt(r.precoCompra)}) segue o custo gravado na estrutura; pela última compra dos componentes seria ${fmt(t.ultimaCompra)}`
          : `Custo gravado na estrutura (${fmt(t.custoEstrutura)}) diferente da última compra dos componentes (${fmt(t.ultimaCompra)})`,
      });
    }
    if (r.saldo !== null && r.kitsPossiveis !== null && Math.floor(r.kitsPossiveis) !== Math.floor(r.saldo))
      avisos.push({
        nivel: "info",
        texto: `Saldo do próprio KIT: ${fmt(r.saldo)}; com o saldo dos componentes daria para montar ${fmt(r.kitsPossiveis)}`,
      });
  }
  return avisos;
}

/** Itens do registro que podem ter estrutura: o próprio item, ou os itens do pedido. */
export function itensDoRegistro(aba: Aba, registro: number, abas: Aba[]): { codigo: string; empresa: string | null; quantidade: number | null }[] {
  const { dados } = aba;
  const linha = dados.linhas[registro];
  if (!linha) return [];
  const v = (nome: string, d = dados, l = linha) => {
    const j = d.colunas.findIndex((c) => c.nome === nome);
    return j < 0 ? null : (l[j]?.trim() ?? null) || null;
  };
  switch (aba.perfilId) {
    case "GERMAT":
      return v("GMT_CODITE") ? [{ codigo: v("GMT_CODITE")!, empresa: v("GMT_CODEMP"), quantidade: null }] : [];
    case "CADITE":
    case "ITEGER":
      return v("ITE_CODITE") ? [{ codigo: v("ITE_CODITE")!, empresa: v("ITE_CODEMP"), quantidade: null }] : [];
    case "DETMAT": {
      const seq = v("DMT_SEQGER");
      const g = seq ? acharLinha(tabelas(abas, "GERMAT"), [{ coluna: "AUTOINCREM", valor: seq }]) : null;
      const cod = ler(g, "GMT_CODITE")?.trim();
      return cod ? [{ codigo: cod, empresa: ler(g, "GMT_CODEMP")?.trim() || null, quantidade: null }] : [];
    }
    case "FATDOR":
      return v("FDO_CODITE") ? [{ codigo: v("FDO_CODITE")!, empresa: v("FDO_CODEMP"), quantidade: num(v("FDO_QTDITE")) }] : [];
    case "FATGOR": {
      const seq = v("AUTOINCREM");
      const res: { codigo: string; empresa: string | null; quantidade: number | null }[] = [];
      for (const a of abas.filter((x) => x.perfilId === "FATDOR")) {
        for (const l of a.dados.linhas) {
          if (seq && v("FDO_SEQGER", a.dados, l) === seq && v("FDO_CODITE", a.dados, l))
            res.push({ codigo: v("FDO_CODITE", a.dados, l)!, empresa: v("FDO_CODEMP", a.dados, l), quantidade: num(v("FDO_QTDITE", a.dados, l)) });
        }
      }
      return res;
    }
    default:
      return [];
  }
}

export function montarEstruturas(aba: Aba, registro: number, abas: Aba[]): EstruturaItem[] {
  return itensDoRegistro(aba, registro, abas).map((it) => {
    const raiz = montarNo(abas, it.codigo, it.empresa, null, it.quantidade, null);
    const comps = raiz.kit?.componentes ?? [];
    const e: EstruturaItem = {
      raiz,
      quantidadePedido: it.quantidade,
      totais: {
        custoEstrutura: soma(comps, (n) => n.custoEstrutura),
        custo: soma(comps, (n) => n.custo),
        ultimaCompra: soma(comps, (n) => n.ultimaCompra),
      },
      avisos: [],
    };
    e.avisos = avisosDaEstrutura(e);
    return e;
  });
}

const aspas = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Consulta da estrutura completa, com marcadores (cada tabela abre na sua aba ao colar):
 * KIT, componentes, cadastro e preços/saldo do KIT e de cada componente.
 */
export function sqlEstrutura(codigos: string[], empresa: string | null): string | null {
  const lista = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (lista.length === 0) return null;
  const m = (t: string) => `'' AS \`${PREFIXO_MARCADOR}${t}\``;
  return [
    `SELECT ${m("GERMAT")}, g.*,`,
    `       ${m("DETMAT")}, d.*,`,
    `       ${m("CADITE")}, c.*,`,
    `       ${m("ITEGER")}, i.*`,
    "  FROM GERMAT g",
    "  LEFT JOIN DETMAT d ON d.DMT_SEQGER = g.AUTOINCREM",
    // cadastro e preços do KIT e de cada componente (linhas repetidas somem ao colar)
    "  LEFT JOIN CADITE c ON c.ITE_CODITE IN (g.GMT_CODITE, d.DMT_ITESUB)",
    "  LEFT JOIN ITEGER i ON i.ITE_CODITE IN (g.GMT_CODITE, d.DMT_ITESUB) AND i.ITE_CODEMP = g.GMT_CODEMP",
    ` WHERE g.GMT_CODITE ${lista.length === 1 ? `= ${aspas(lista[0])}` : `IN (${lista.map(aspas).join(", ")})`}${empresa ? ` AND g.GMT_CODEMP = ${aspas(empresa)}` : ""};`,
  ].join("\n");
}
