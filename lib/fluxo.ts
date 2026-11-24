import { buscarPerfil, linhasLigadas } from "./perfis";
import type { Aba } from "./estado";
import {
  extrasLigacao,
  relacionadosDoRegistro,
  relacoesPendentes,
  type RelacaoPendente,
  type Relacionado,
} from "./relacionados";
import { montarTela, primeiraData, resumoRegistro } from "./tela";

/**
 * Fluxo e mapa de relações de um registro, montados com as abas abertas:
 * as etapas do próprio registro, os registros ligados em outras abas e as
 * consultas que ainda faltam colar.
 */

export type EstadoEvento = "ok" | "pendente" | "ausente" | "naoConsultado" | "semChave";

export type EventoFluxo = {
  id: string;
  rotulo: string;
  /** aba (ou tabela, se ainda não consultada) de onde vem o evento */
  origem: string;
  /** data/hora no formato do banco, para ordenar; null quando não há data */
  quando: string | null;
  /** coluna de onde veio a data */
  colunaQuando: string | null;
  detalhe: string;
  estado: EstadoEvento;
  quantidade?: number;
  relacionado?: Relacionado;
  pendente?: RelacaoPendente;
};

/** Linhas da aba destino ligadas ao registro (as mesmas que a Tela mostra). */
export function linhasDoRelacionado(r: Relacionado, abas: Aba[]): number[] {
  const destino = abas.find((a) => a.id === r.abaId);
  if (!destino || r.chave === null) return [];
  return linhasLigadas(r.chave, destino.dados.linhas, r.colunaDestino, extrasLigacao(r.extras));
}

const ORDEM_SEM_DATA: Record<EstadoEvento, number> = { ok: 0, pendente: 1, ausente: 2, naoConsultado: 3, semChave: 4 };

export function montarFluxo(aba: Aba, registro: number, abas: Aba[]): EventoFluxo[] {
  const perfil = buscarPerfil(aba.perfilId);
  const { dados } = aba;
  const linha = dados.linhas[registro];
  if (!linha) return [];
  const eventos: EventoFluxo[] = [];

  // 1. o próprio registro: etapas do perfil ou, sem etapas, a primeira data da linha
  const tela = montarTela(dados, registro, perfil);
  if (tela.etapas.length > 0) {
    tela.etapas.forEach((e, k) =>
      eventos.push({
        id: `etapa-${k}`,
        rotulo: e.rotulo,
        origem: aba.nome,
        quando: e.feito ? e.quando : null,
        colunaQuando: e.nome,
        detalhe: e.detalhe,
        estado: e.feito ? "ok" : "pendente",
      }),
    );
  } else {
    const d = primeiraData(dados, linha);
    eventos.push({
      id: "registro",
      rotulo: perfil?.tela?.titulo ? `${perfil.tela.titulo} gravado` : "Registro",
      origem: aba.nome,
      quando: d?.quando ?? null,
      colunaQuando: d?.coluna ?? null,
      detalhe: tela.titulo,
      estado: "ok",
    });
  }

  // 2. registros ligados nas outras abas
  relacionadosDoRegistro(aba, registro, abas).forEach((r, k) => {
    const destino = abas.find((a) => a.id === r.abaId)!;
    const linhas = linhasDoRelacionado(r, abas);
    let quando: { quando: string; coluna: string } | null = null;
    for (const i of linhas) {
      const d = primeiraData(destino.dados, destino.dados.linhas[i]);
      if (d && (!quando || d.quando < quando.quando)) quando = d;
    }
    const resumo = linhas.length > 0 ? resumoRegistro(destino.dados, linhas[0], buscarPerfil(destino.perfilId)) : null;
    const detalhe =
      linhas.length === 0
        ? `Nenhum registro com ${r.colunaDestinoNome} = ${r.chave ?? "NULL"}`
        : [resumo!.titulo, resumo!.detalhe].filter(Boolean).join(" · ") + (linhas.length > 1 ? ` (+${linhas.length - 1})` : "");
    eventos.push({
      id: `rel-${k}`,
      rotulo: r.rotulo,
      origem: r.abaNome,
      quando: quando?.quando ?? null,
      colunaQuando: quando?.coluna ?? null,
      detalhe,
      estado: linhas.length > 0 ? "ok" : "ausente",
      quantidade: linhas.length,
      relacionado: r,
    });
  });

  // 3. consultas que faltam
  relacoesPendentes(aba, registro, abas).forEach((p, k) =>
    eventos.push({
      id: `pend-${k}`,
      rotulo: p.rotulo,
      origem: p.tabela,
      quando: null,
      colunaQuando: null,
      detalhe: p.chave === null ? `Sem consulta: ${p.colunaOrigem} está vazio neste registro` : "Ainda não consultado",
      estado: p.chave === null ? "semChave" : "naoConsultado",
      pendente: p,
    }),
  );

  // datados em ordem de data (estável); só a data (sem hora) conta como fim do dia; depois os sem data, por estado
  const chave = (q: string) => (q.length <= 10 ? `${q} 99` : q);
  const datados = eventos
    .filter((e) => e.quando)
    .sort((a, b) => {
      const x = chave(a.quando!);
      const y = chave(b.quando!);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  const semData = eventos
    .filter((e) => !e.quando)
    .map((e, k) => ({ e, k }))
    .sort((a, b) => ORDEM_SEM_DATA[a.e.estado] - ORDEM_SEM_DATA[b.e.estado] || a.k - b.k)
    .map(({ e }) => e);
  return [...datados, ...semData];
}

export type NoMapa = {
  id: string;
  /** id do nó pai (o centro é "centro") */
  pai: string;
  nivel: 1 | 2;
  rotulo: string;
  aba: string;
  /** coluna da ligação, exibida na linha */
  chave: string;
  quantidade: number | null;
  resumo: string;
  estado: "ok" | "ausente" | "naoConsultado" | "semChave";
  relacionado?: Relacionado;
  pendente?: RelacaoPendente;
};

export type Mapa = { centro: { aba: string; perfil: string | null; titulo: string; resumo: string }; nos: NoMapa[] };

function noRelacionado(id: string, pai: string, nivel: 1 | 2, r: Relacionado, abas: Aba[]): NoMapa {
  const destino = abas.find((a) => a.id === r.abaId)!;
  const linhas = linhasDoRelacionado(r, abas);
  const res = linhas.length > 0 ? resumoRegistro(destino.dados, linhas[0], buscarPerfil(destino.perfilId)) : null;
  return {
    id,
    pai,
    nivel,
    rotulo: r.rotulo,
    aba: r.abaNome,
    chave: r.colunaDestinoNome,
    quantidade: linhas.length,
    resumo: res ? [res.titulo, res.detalhe].filter(Boolean).join(" · ") : "Nenhum registro ligado",
    estado: linhas.length > 0 ? "ok" : "ausente",
    relacionado: r,
  };
}

function noPendente(id: string, pai: string, nivel: 1 | 2, p: RelacaoPendente): NoMapa {
  return {
    id,
    pai,
    nivel,
    rotulo: p.rotulo,
    aba: p.tabela,
    chave: p.colunaDestino,
    quantidade: null,
    resumo: p.chave === null ? `${p.colunaOrigem} vazio` : "Não consultado",
    estado: p.chave === null ? "semChave" : "naoConsultado",
    pendente: p,
  };
}

/** Máximo de nós de 2º nível por nó (para o mapa continuar legível). */
const MAX_FILHOS = 3;

export function montarMapa(aba: Aba, registro: number, abas: Aba[]): Mapa {
  const perfil = buscarPerfil(aba.perfilId);
  const tela = montarTela(aba.dados, registro, perfil);
  const res = resumoRegistro(aba.dados, registro, perfil);
  const nos: NoMapa[] = [];
  // abas/tabelas já no mapa (não repetem no 2º nível)
  const vistos = new Set<string>([aba.id, ...(aba.perfilId ? [`p:${aba.perfilId}`] : [])]);

  const rels = relacionadosDoRegistro(aba, registro, abas);
  const pends = relacoesPendentes(aba, registro, abas);
  rels.forEach((r) => {
    vistos.add(r.abaId);
    const p = abas.find((a) => a.id === r.abaId)?.perfilId;
    if (p) vistos.add(`p:${p}`);
  });
  pends.forEach((p) => vistos.add(`p:${p.perfilDestino}`));

  rels.forEach((r, k) => {
    const id = `r${k}`;
    const no = noRelacionado(id, "centro", 1, r, abas);
    nos.push(no);
    // 2º nível: o que está ligado ao primeiro registro desta aba
    const destino = abas.find((a) => a.id === r.abaId);
    const linhas = linhasDoRelacionado(r, abas);
    if (!destino || linhas.length === 0) return;
    let filhos = 0;
    relacionadosDoRegistro(destino, linhas[0], abas).forEach((r2, k2) => {
      if (filhos >= MAX_FILHOS || vistos.has(r2.abaId)) return;
      vistos.add(r2.abaId);
      nos.push(noRelacionado(`${id}-${k2}`, id, 2, r2, abas));
      filhos++;
    });
    relacoesPendentes(destino, linhas[0], abas).forEach((p2, k2) => {
      if (filhos >= MAX_FILHOS || vistos.has(`p:${p2.perfilDestino}`)) return;
      vistos.add(`p:${p2.perfilDestino}`);
      nos.push(noPendente(`${id}-p${k2}`, id, 2, p2));
      filhos++;
    });
  });
  pends.forEach((p, k) => nos.push(noPendente(`p${k}`, "centro", 1, p)));

  return {
    centro: { aba: aba.nome, perfil: perfil ? `${perfil.id} · ${perfil.nome}` : null, titulo: tela.titulo, resumo: res.detalhe },
    nos,
  };
}
