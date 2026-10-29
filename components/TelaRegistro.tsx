"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CorStatus } from "@/config/perfis";
import { colunaDestaque } from "@/lib/destaque";
import { diagnosticar, nivelGeral, temDiagnostico } from "@/lib/diagnostico";
import { colunasExibidas, type Aba, type Acao } from "@/lib/estado";
import { formatarNumero } from "@/lib/formatacao";
import { buscarPerfil, linhasLigadas } from "@/lib/perfis";
import { sqlJoin } from "@/lib/join";
import { relacionadosDoRegistro, relacoesPendentes, type RelacaoPendente, type Relacionado } from "@/lib/relacionados";
import {
  calcularSaldo,
  montarTela,
  resumoRegistro,
  sqlRelacionado,
  type CampoMontado,
  type IndicadorMontado,
  type SecaoMontada,
} from "@/lib/tela";
import { alinhamento, Celula } from "./Celula";
import { IconeCopiar, IconeDireita, IconeEsquerda, IconeLink, IconeMais, IconeSeta } from "./Icones";
import { ESTILO_NIVEL, PainelDiagnostico } from "./PainelDiagnostico";
import { BotaoCopiarChamado } from "./Saidas";
import { copiarTexto, useAviso } from "./util";

type Props = {
  aba: Aba;
  abas: Aba[];
  indices: number[];
  atualizar: (p: Partial<Aba>) => void;
  dispatch: React.Dispatch<Acao>;
};

/** Visão "Tela": um registro por vez, como um formulário de ERP. */
export function TelaRegistro({ aba, abas, indices, atualizar, dispatch }: Props) {
  const { dados } = aba;
  const perfil = buscarPerfil(aba.perfilId);
  const [mostrarVazios, setMostrarVazios] = useState(false);
  const [aviso, setAviso] = useAviso();

  const posicao = aba.registroTela !== null ? indices.indexOf(aba.registroTela) : -1;
  const pos = posicao >= 0 ? posicao : 0;
  const registro = indices[pos];
  const anterior = pos > 0 ? indices[pos - 1] : null;
  const proximo = pos < indices.length - 1 ? indices[pos + 1] : null;
  const ir = (i: number | null) => i !== null && atualizar({ registroTela: i });

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
      if (e.key === "ArrowLeft" && anterior !== null) atualizar({ registroTela: anterior });
      if (e.key === "ArrowRight" && proximo !== null) atualizar({ registroTela: proximo });
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [anterior, proximo, atualizar]);

  const tela = useMemo(() => (registro === undefined ? null : montarTela(dados, registro, perfil)), [dados, registro, perfil]);
  const diagnostico = useMemo(
    () => (registro === undefined || !temDiagnostico(aba.perfilId) ? null : diagnosticar(aba, registro, abas)),
    [aba, registro, abas],
  );
  const relacionados = useMemo(() => (registro === undefined ? [] : relacionadosDoRegistro(aba, registro, abas)), [aba, registro, abas]);
  const pendentes = useMemo(() => (registro === undefined ? [] : relacoesPendentes(aba, registro, abas)), [aba, registro, abas]);
  const join = useMemo(() => (registro === undefined ? null : sqlJoin(dados, registro, aba.perfilId)), [dados, registro, aba.perfilId]);
  const exibidas = useMemo(() => colunasExibidas(aba), [aba]);

  if (registro === undefined || !tela) {
    return <p className="p-8 text-center text-sm text-zinc-500">Nenhum registro corresponde aos filtros atuais.</p>;
  }

  const copiarValor = async (rotulo: string, raw: string | null) => {
    const ok = await copiarTexto(raw ?? "NULL");
    setAviso(ok ? `${rotulo} copiado` : "Não foi possível copiar");
  };

  return (
    <div className="absolute inset-0 flex">
      {indices.length > 1 && (
        <ListaRegistros aba={aba} abas={abas} indices={indices} atual={registro} onEscolher={(i) => atualizar({ registroTela: i })} />
      )}

      <div className="min-w-0 flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
          {/* cabeçalho do documento */}
          <header className="painel overflow-hidden">
            <div className="h-1 bg-blue-600" />
            <div className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {perfil ? `${perfil.id} · ${perfil.nome}` : "Consulta"}
                </p>
                <h2 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <span className="truncate font-mono">{tela.titulo}</span>
                  <button className="btn-icone" title="Copiar" onClick={() => copiarValor("Título", tela.titulo)}>
                    <IconeCopiar />
                  </button>
                </h2>
                {tela.subtitulo.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {tela.subtitulo.map((c) => (
                      <span key={c.j} title={c.nome}>
                        <span className="text-zinc-400">{c.rotulo}:</span>{" "}
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.texto ?? "NULL"}</span>
                      </span>
                    ))}
                  </p>
                )}
                {tela.status.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tela.status.map((s) => (
                      <ChipStatus key={s.nome} cor={s.cor} titulo={s.nome}>
                        {s.rotulo}: <strong>{s.texto}</strong>
                      </ChipStatus>
                    ))}
                  </div>
                )}
              </div>

              {tela.chave && <BlocoChave campo={tela.chave} onCopiar={copiarValor} />}

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <button className="btn px-2" disabled={anterior === null} onClick={() => ir(anterior)} title="Anterior (←)">
                    <IconeEsquerda />
                  </button>
                  <span className="min-w-20 text-center text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                    {(pos + 1).toLocaleString("pt-BR")} de {indices.length.toLocaleString("pt-BR")}
                  </span>
                  <button className="btn px-2" disabled={proximo === null} onClick={() => ir(proximo)} title="Próximo (→)">
                    <IconeDireita />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                    <input type="checkbox" checked={mostrarVazios} onChange={(e) => setMostrarVazios(e.target.checked)} />
                    Mostrar campos vazios
                  </label>
                  <BotaoCopiarChamado
                    dados={dados}
                    linhas={[registro]}
                    colunas={exibidas}
                    rotulo="Copiar"
                    semLinhas="Nenhuma coluna visível"
                  />
                </div>
              </div>
            </div>
            {tela.indicadores.length > 0 && (
              <div className="grid gap-3 border-t border-zinc-100 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
                {tela.indicadores.map((ind) => (
                  <Indicador key={ind.campo.j} indicador={ind} />
                ))}
              </div>
            )}
          </header>

          {diagnostico && <PainelDiagnostico diagnostico={diagnostico} />}

          {/* valores principais */}
          {tela.destaques.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tela.destaques.map((c) => (
                <div key={c.j} className="painel p-3" title={c.nome}>
                  <p className="text-xs text-zinc-500">{c.rotulo}</p>
                  <p className={`mt-1 text-xl font-semibold tabular-nums ${c.vazio ? "text-zinc-400" : ""}`}>
                    {c.texto ?? <span className="valor-null text-base">NULL</span>}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{c.nome}</p>
                </div>
              ))}
            </div>
          )}

          {/* registros de outras abas (ex.: itens do pedido) */}
          {relacionados.map((r) => (
            <BlocoRelacionado
              key={`${r.abaId}-${r.colunaDestino}`}
              rel={r}
              abas={abas}
              onAbrir={(linha) => {
                dispatch({ tipo: "abrirRelacao", destino: r.abaId, coluna: r.colunaDestino, valor: r.chave!, rotulo: r.rotulo });
                if (linha !== undefined) dispatch({ tipo: "atualizar", id: r.abaId, patch: { registroTela: linha } });
              }}
            />
          ))}
          {pendentes.length > 0 && <BlocoPendentes pendentes={pendentes} join={join} onColar={() => dispatch({ tipo: "ativar", id: null })} />}

          {tela.secoes.map((s) => (
            <Secao
              key={s.titulo}
              secao={s}
              mostrarVazios={mostrarVazios}
              inicialAberta={s.titulo !== "Outros campos"}
              onCopiar={copiarValor}
            />
          ))}
        </div>
      </div>

      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
          {aviso}
        </div>
      )}
    </div>
  );
}

const CORES: Record<CorStatus, string> = {
  verde: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  amarelo: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  vermelho: "bg-red-100 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  azul: "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
  cinza: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

const CORES_INDICADOR: Record<CorStatus, { caixa: string; valor: string }> = {
  azul: { caixa: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40", valor: "text-blue-900 dark:text-blue-100" },
  verde: { caixa: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40", valor: "text-emerald-900 dark:text-emerald-100" },
  amarelo: { caixa: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40", valor: "text-amber-900 dark:text-amber-100" },
  vermelho: { caixa: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40", valor: "text-red-900 dark:text-red-100" },
  cinza: { caixa: "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900", valor: "text-zinc-500" },
};

/** Indicador intermediário (ex.: liberações): menor que o NUMPOK, maior que um chip. */
function Indicador({ indicador: { campo: c, detalhes, cor } }: { indicador: IndicadorMontado }) {
  const estilo = CORES_INDICADOR[cor];
  const detalhesVisiveis = detalhes.filter((d) => !d.vazio);
  return (
    <div className={`rounded-md border px-3 py-2 ${estilo.caixa} ${c.largo ? "sm:col-span-2" : ""}`} title={c.nome}>
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {c.rotulo}
        <span className="font-mono text-[10px] text-zinc-400">{c.nome}</span>
      </p>
      <p className={`mt-0.5 font-semibold break-words ${c.largo ? "text-base" : "text-lg"} ${estilo.valor}`}>
        {c.texto === null ? <span className="valor-null">NULL</span> : c.raw?.trim() === "" ? "não informado" : c.texto}
      </p>
      {detalhesVisiveis.length > 0 && (
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-600 dark:text-zinc-400">
          {detalhesVisiveis.map((d) => (
            <span key={d.j} title={d.nome}>
              {d.rotulo}: <span className="font-medium text-zinc-800 dark:text-zinc-200">{d.texto}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Coluna-chave em destaque no cabeçalho (ex.: NUMPOK do pedido). */
function BlocoChave({ campo: c, onCopiar }: { campo: CampoMontado; onCopiar: (rotulo: string, raw: string | null) => void }) {
  const semValor = c.raw === null || c.raw.trim() === "";
  return (
    <div
      className={`rounded-lg border-2 px-4 py-2 ${
        semValor
          ? "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          : "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/50"
      }`}
      title={c.nome}
    >
      <p className="flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
        {c.rotulo}
        <span className="font-mono text-[10px] font-normal tracking-normal text-zinc-400 normal-case">{c.nome}</span>
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        {semValor ? (
          <span className="text-lg text-zinc-400">{c.raw === null ? <span className="valor-null">NULL</span> : "não informado"}</span>
        ) : (
          <>
            <span className="font-mono text-2xl font-bold tracking-tight text-amber-950 dark:text-amber-100">{c.raw}</span>
            <button className="btn-icone" title="Copiar NUMPOK" aria-label={`Copiar ${c.nome}`} onClick={() => onCopiar(c.nome, c.raw)}>
              <IconeCopiar />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChipStatus({ cor, titulo, children }: { cor: CorStatus; titulo: string; children: React.ReactNode }) {
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${CORES[cor]}`}>
      {children}
    </span>
  );
}

function Secao({
  secao,
  mostrarVazios,
  inicialAberta,
  onCopiar,
}: {
  secao: SecaoMontada;
  mostrarVazios: boolean;
  inicialAberta: boolean;
  onCopiar: (rotulo: string, raw: string | null) => void;
}) {
  const [aberta, setAberta] = useState(inicialAberta);
  const visiveis = mostrarVazios ? secao.campos : secao.campos.filter((c) => !c.vazio);
  const ocultos = secao.campos.length - visiveis.length;

  if (visiveis.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 px-4 py-2 text-sm text-zinc-400 dark:border-zinc-800">
        <span className="font-medium">{secao.titulo}</span>
        <span className="text-xs">· {secao.campos.length} campo(s), todos vazios ou zerados</span>
      </section>
    );
  }

  return (
    <section className="painel">
      <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left" onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
        <IconeSeta className={`h-4 w-4 text-zinc-400 transition ${aberta ? "" : "-rotate-90"}`} />
        <h3 className="text-sm font-semibold">{secao.titulo}</h3>
        <span className="text-xs text-zinc-400 tabular-nums">
          {visiveis.length} campo(s){ocultos > 0 && ` · ${ocultos} vazio(s) oculto(s)`}
        </span>
      </button>
      {aberta && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {visiveis.map((c) => (
              <Campo key={c.j} campo={c} onCopiar={onCopiar} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Campo({ campo: c, onCopiar }: { campo: CampoMontado; onCopiar: (rotulo: string, raw: string | null) => void }) {
  return (
    <div className={`group min-w-0 ${c.largo ? "sm:col-span-2" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-400" title={c.rotulo}>
          {c.rotulo}
        </label>
        <span className="shrink-0 font-mono text-[10px] text-zinc-400">{c.nome}</span>
      </div>
      <div
        className={`relative mt-1 flex min-h-8 items-center rounded-md border px-2.5 py-1 text-sm ${
          c.vazio
            ? "border-dashed border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40"
            : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
        } ${c.numerico ? "justify-end tabular-nums" : ""}`}
        title={c.raw === null ? "NULL" : c.raw}
      >
        <span className="min-w-0 break-words whitespace-pre-wrap">
          {c.texto === null ? <span className="valor-null">NULL</span> : c.texto}
        </span>
        <button
          className="btn-icone absolute top-1/2 left-1 h-6 w-6 -translate-y-1/2 bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 dark:bg-zinc-900"
          title="Copiar valor original"
          aria-label={`Copiar ${c.nome}`}
          onClick={() => onCopiar(c.nome, c.raw)}
        >
          <IconeCopiar className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const MAX_LINHAS_BLOCO = 200;

/** Grade com os registros ligados de outra aba (ex.: itens do pedido), com totais. */
function BlocoRelacionado({ rel, abas, onAbrir }: { rel: Relacionado; abas: Aba[]; onAbrir: (linha?: number) => void }) {
  const destino = abas.find((a) => a.id === rel.abaId);
  const linhas = useMemo(
    () => (destino && rel.chave !== null ? linhasLigadas(rel.chave, destino.dados.linhas, rel.colunaDestino) : []),
    [destino, rel.chave, rel.colunaDestino],
  );
  const colunas = useMemo(() => (destino ? colunasExibidas(destino) : []), [destino]);
  if (!destino) return null;
  const { dados } = destino;
  const perfilDestino = buscarPerfil(destino.perfilId);
  const saldo = perfilDestino?.saldo ? calcularSaldo(dados, linhas, perfilDestino.saldo) : null;
  const decimais = colunas.filter((j) => {
    const c = dados.colunas[j];
    if (perfilDestino?.totais) return perfilDestino.totais.includes(c.nome) && (c.tipo === "decimal" || c.tipo === "inteiro");
    return c.tipo === "decimal";
  });
  const totais = new Map(
    decimais.map((j) => [j, linhas.reduce((s, i) => s + (Number(dados.linhas[i][j]) || 0), 0)] as const),
  );

  return (
    <section className="painel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <IconeLink className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold">{rel.rotulo}</h3>
        <span className="rounded-full bg-violet-100 px-2 text-xs text-violet-800 tabular-nums dark:bg-violet-950 dark:text-violet-300">
          {linhas.length}
        </span>
        <span className="font-mono text-[10px] text-zinc-400">
          {rel.colunaDestinoNome} = {rel.chave ?? "NULL"} · aba {destino.nome}
        </span>
        {linhas.length > 0 && (
          <button className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => onAbrir()}>
            Abrir na aba {destino.nome}
          </button>
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="px-4 py-3 text-sm text-zinc-400">Nenhum registro ligado na aba {destino.nome}.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                {colunas.map((j) => (
                  <th key={j} className={`px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap ${alinhamento(dados.colunas[j].tipo)}`}>
                    {dados.colunas[j].nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, MAX_LINHAS_BLOCO).map((i, k) => (
                <tr
                  key={i}
                  onClick={() => onAbrir(i)}
                  title="Abrir este registro"
                  className={`cursor-pointer border-t border-zinc-100 hover:bg-amber-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${k % 2 ? "bg-zinc-50/60 dark:bg-zinc-900/40" : ""}`}
                >
                  {colunas.map((j) => (
                    <td key={j} className={`px-3 py-1.5 whitespace-nowrap ${alinhamento(dados.colunas[j].tipo)}`}>
                      <Celula valor={dados.linhas[i][j]} tipo={dados.colunas[j].tipo} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {decimais.length > 0 && (
              <tfoot className="sticky bottom-0 border-t-2 border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  {colunas.map((j, k) => (
                    <td key={j} className={`px-3 py-1.5 whitespace-nowrap ${alinhamento(dados.colunas[j].tipo)}`}>
                      {totais.has(j) ? formatarNumero(totais.get(j)!, dados.colunas[j].casas) : k === 0 ? "Total" : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {saldo && (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t-2 border-zinc-200 bg-zinc-50 px-4 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900">
              <span>
                Créditos: <strong className="text-emerald-700 dark:text-emerald-400">{moedaBR(saldo.creditos)}</strong>
              </span>
              <span>
                Débitos: <strong className="text-red-700 dark:text-red-400">{moedaBR(saldo.debitos)}</strong>
              </span>
              <span className="rounded-md bg-white px-2 py-0.5 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700">
                Saldo:{" "}
                <strong className={saldo.saldo < 0 ? "text-red-700 dark:text-red-400" : saldo.saldo > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}>
                  {moedaBR(saldo.saldo)}
                </strong>
              </span>
            </div>
          )}
          {linhas.length > MAX_LINHAS_BLOCO && (
            <p className="px-4 py-2 text-xs text-zinc-500">
              Mostrando {MAX_LINHAS_BLOCO} de {linhas.length}. Abra a aba para ver todos.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moedaBR = (n: number) => FORMATO_MOEDA.format(n);

/** Relações do perfil sem aba aberta: sugere a consulta para colar. */
function BlocoPendentes({
  pendentes,
  join,
  onColar,
}: {
  pendentes: RelacaoPendente[];
  join: string | null;
  onColar: () => void;
}) {
  const [verJoin, setVerJoin] = useState(false);
  const [aviso, setAviso] = useAviso();
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ver também</h3>
        <span className="text-xs text-zinc-500">execute a consulta no MySQL e cole o resultado numa nova aba para ver aqui</span>
        {aviso && <span className="text-xs text-emerald-600">{aviso}</span>}
        <button className="btn ml-auto px-2 py-1 text-xs" onClick={onColar}>
          <IconeMais className="h-3.5 w-3.5" /> Colar resultado
        </button>
      </div>
      {join && (
        <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-violet-900 dark:text-violet-200">Tudo de uma vez (JOIN)</span>
            <span className="text-xs text-zinc-500">
              uma consulta só; ao colar o resultado, cada tabela abre na sua aba, sem linhas repetidas
            </span>
            <button className="ml-auto text-xs text-violet-700 hover:underline dark:text-violet-300" onClick={() => setVerJoin(!verJoin)}>
              {verJoin ? "Ocultar SQL" : "Ver SQL"}
            </button>
            <button
              className="btn px-2 py-1 text-xs"
              onClick={async () => setAviso((await copiarTexto(join)) ? "JOIN copiado" : "Não foi possível copiar")}
            >
              <IconeCopiar className="h-3.5 w-3.5" /> Copiar JOIN
            </button>
          </div>
          {verJoin && (
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-white p-2 font-mono text-xs leading-relaxed dark:bg-zinc-950">{join}</pre>
          )}
        </div>
      )}
      <ul className="mt-2 space-y-1.5">
        {pendentes.map((p) => {
          const chave = p.chave;
          if (chave === null) {
            // sem chave não há o que consultar, mas a relação continua visível com o motivo
            return (
              <li key={`${p.perfilDestino}-${p.colunaDestino}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-48 shrink-0 text-zinc-400">{p.rotulo}</span>
                <span className="min-w-0 flex-1 rounded border border-dashed border-zinc-200 px-2 py-1 text-xs text-zinc-400 dark:border-zinc-800">
                  Sem consulta: <span className="font-mono">{p.colunaOrigem}</span> está vazio neste registro
                </span>
              </li>
            );
          }
          const sql = sqlRelacionado(p.tabela, p.colunaDestino, chave);
          return (
            <li key={`${p.perfilDestino}-${p.colunaDestino}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-48 shrink-0 text-zinc-600 dark:text-zinc-400">{p.rotulo}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800" title={sql}>
                {sql}
              </code>
              <button
                className="btn-icone"
                title="Copiar SQL"
                onClick={async () => setAviso((await copiarTexto(sql)) ? "SQL copiado" : "Não foi possível copiar")}
              >
                <IconeCopiar />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Lista lateral de registros (virtualizada), respeitando filtro e ordenação. */
function ListaRegistros({
  aba,
  abas,
  indices,
  atual,
  onEscolher,
}: {
  aba: Aba;
  abas: Aba[];
  indices: number[];
  atual: number;
  onEscolher: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const perfil = buscarPerfil(aba.perfilId);
  const temChave = useMemo(() => colunaDestaque(aba.dados.colunas, perfil) !== null, [aba.dados.colunas, perfil]);
  const virt = useVirtualizer({ count: indices.length, getScrollElement: () => ref.current, estimateSize: () => (temChave ? 66 : 52), overscan: 8 });
  const pos = indices.indexOf(atual);

  // nível do diagnóstico por registro (bolinha colorida), calculado só para os visíveis e guardado
  const comDiagnostico = temDiagnostico(aba.perfilId);
  const cacheNivel = useMemo(() => new Map<number, ReturnType<typeof nivelGeral>>(), [aba.dados, aba.perfilId, abas]); // eslint-disable-line react-hooks/exhaustive-deps
  const nivelDe = (i: number) => {
    if (!comDiagnostico) return null;
    if (!cacheNivel.has(i)) cacheNivel.set(i, nivelGeral(diagnosticar(aba, i, abas)));
    return cacheNivel.get(i) ?? null;
  };

  // mantém o registro atual visível ao navegar com Anterior/Próximo
  useEffect(() => {
    if (pos >= 0) virt.scrollToIndex(pos, { align: "auto" });
  }, [pos, virt]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
      <p className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        {indices.length.toLocaleString("pt-BR")} registro(s)
      </p>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: virt.getTotalSize() }}>
          {virt.getVirtualItems().map((v) => {
            const i = indices[v.index];
            const r = resumoRegistro(aba.dados, i, perfil);
            const ativo = i === atual;
            return (
              <button
                key={i}
                onClick={() => onEscolher(i)}
                className={`absolute top-0 left-0 flex w-full flex-col justify-center border-b border-l-4 border-zinc-100 px-3 text-left dark:border-b-zinc-800 ${
                  ativo
                    ? "border-l-blue-600 bg-blue-50 dark:bg-blue-950/60"
                    : "border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                }`}
                style={{ height: temChave ? 66 : 52, transform: `translateY(${v.start}px)` }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-sm font-medium">{r.titulo}</span>
                  {(() => {
                    const n = nivelDe(i);
                    return n && n !== "ok" && n !== "info" ? (
                      <span className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_NIVEL[n].ponto}`} title={`Diagnóstico: ${ESTILO_NIVEL[n].rotulo}`} />
                    ) : null;
                  })()}
                </span>
                <span className="truncate text-xs text-zinc-500">{r.detalhe}</span>
                {r.chave && <span className="truncate font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">{r.chave}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
