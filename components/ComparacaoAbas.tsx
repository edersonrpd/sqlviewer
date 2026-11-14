"use client";

import { useEffect, useMemo, useState } from "react";
import { colunasComuns, colunasMaisDiferentes, compararAbas, sugerirChave } from "@/lib/compararAbas";
import type { Aba } from "@/lib/estado";
import { gerarInsert } from "@/lib/exportar";
import { formatarValor } from "@/lib/formatacao";
import { separarValores } from "@/lib/montar";
import { buscarPerfil } from "@/lib/perfis";
import type { ResultadoParse, Valor } from "@/lib/tipos";
import { updatesDaComparacao } from "@/lib/update";
import { IconeCopiar, IconeX } from "./Icones";
import { copiarTexto, useAviso, useDebounce } from "./util";

const MAX_LISTA = 200;
const tabelaDe = (aba: Aba) => buscarPerfil(aba.perfilId)?.tabela ?? aba.perfilId ?? aba.nome.replace(/\W+/g, "_");

/** Duas abas da mesma tabela, registro a registro: o que mudou, o que só existe em uma delas. */
export function ComparacaoAbas({ aba, abas, onFechar }: { aba: Aba; abas: Aba[]; onFechar: () => void }) {
  const outras = useMemo(() => abas.filter((x) => x.id !== aba.id && x.procedure === undefined && x.dados.colunas.length > 0), [abas, aba.id]);
  // começa pela outra aba do mesmo perfil (ex.: FATGOR × FATGOR 2)
  const [idB, setIdB] = useState(() => (outras.find((x) => x.perfilId !== null && x.perfilId === aba.perfilId) ?? outras[0])?.id ?? "");
  const b = outras.find((x) => x.id === idB) ?? null;
  const [aviso, setAviso] = useAviso(2500);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const cols = useMemo(() => (b ? colunasComuns(aba.dados, b.dados) : null), [aba.dados, b]);
  const sugerida = useMemo(
    () => (b && cols ? sugerirChave(aba.dados, b.dados, cols.comuns, buscarPerfil(aba.perfilId)) : null),
    [aba.dados, aba.perfilId, b, cols],
  );
  // escolha do usuário por aba B (trocar de aba volta para a chave sugerida)
  const [escolha, setEscolha] = useState<{ id: string; chave: string; chave2: string } | null>(null);
  const chave1 = escolha?.id === idB ? escolha.chave : (sugerida ?? "");
  const chave2 = escolha?.id === idB ? escolha.chave2 : "";
  const [ignorarTexto, setIgnorarTexto] = useState("");
  const ignorar = useDebounce(ignorarTexto, 300);

  const comp = useMemo(
    () => (b && chave1 ? compararAbas(aba.dados, b.dados, [chave1, chave2].filter(Boolean), separarValores(ignorar)) : null),
    [aba.dados, b, chave1, chave2, ignorar],
  );
  const frequentes = useMemo(() => (comp ? colunasMaisDiferentes(comp) : []), [comp]);

  const copiar = async (texto: string | null, ok: string) => {
    if (!texto) return setAviso("Nada para copiar");
    setAviso((await copiarTexto(texto)) ? ok : "Não foi possível copiar");
  };

  const valor = (v: Valor, dados: ResultadoParse, j: number) =>
    v === null ? <span className="valor-null">NULL</span> : v === "" ? <span className="text-zinc-400">{'""'}</span> : formatarValor(v, dados.colunas[j].tipo);
  const rotuloChave = (partes: string[]) => partes.map((p) => p || "(vazio)").join(" · ");
  const n = (x: number) => x.toLocaleString("pt-BR");

  const seletor = "campo h-9 max-w-56 py-0";
  const etiquetaA = <span className="rounded bg-blue-100 px-1.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">A</span>;
  const etiquetaB = <span className="rounded bg-violet-100 px-1.5 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">B</span>;

  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside className="gaveta max-w-5xl" onClick={(e) => e.stopPropagation()} aria-label="Comparar abas">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold">Comparar abas</h2>
            <p className="text-xs text-zinc-500">
              Mesma tabela em dois momentos ou duas bases: os registros são casados pela chave e comparados coluna a coluna.
            </p>
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <IconeX />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{etiquetaA} esta aba</span>
            <span className="flex h-9 items-center font-medium">{aba.nome}</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{etiquetaB} comparar com</span>
            <select className={seletor} value={idB} onChange={(e) => setIdB(e.target.value)}>
              {outras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome} ({n(x.dados.linhas.length)})
                </option>
              ))}
            </select>
          </label>
          {cols && cols.comuns.length > 0 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Chave</span>
                <select className={seletor} value={chave1} onChange={(e) => setEscolha({ id: idB, chave: e.target.value, chave2 })}>
                  {cols.comuns.map((c) => (
                    <option key={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">+ chave (opcional)</span>
                <select className={seletor} value={chave2} onChange={(e) => setEscolha({ id: idB, chave: chave1, chave2: e.target.value })}>
                  <option value="">—</option>
                  {cols.comuns
                    .filter((c) => c.nome !== chave1)
                    .map((c) => (
                      <option key={c.nome}>{c.nome}</option>
                    ))}
                </select>
              </label>
              <label className="flex min-w-48 flex-1 flex-col gap-1">
                <span className="text-xs text-zinc-500">Ignorar colunas (trechos do nome, separados por vírgula)</span>
                <input className="campo h-9" placeholder="ex.: DTAALT, HORALT, AUTOINCREM" value={ignorarTexto} onChange={(e) => setIgnorarTexto(e.target.value)} spellCheck={false} />
              </label>
            </>
          )}
        </div>

        {!b ? (
          <p className="p-8 text-center text-sm text-zinc-500">Abra outra aba com a mesma tabela para comparar.</p>
        ) : !cols || cols.comuns.length === 0 || !comp ? (
          <p className="p-8 text-center text-sm text-zinc-500">As duas abas não têm nenhuma coluna com o mesmo nome.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800">
              <Contador cor="emerald" qtd={comp.iguais} texto="iguais" />
              <Contador cor="amber" qtd={comp.diferentes.length} texto="diferentes" />
              <Contador cor="blue" qtd={comp.apenasA.length} texto="só em A" />
              <Contador cor="violet" qtd={comp.apenasB.length} texto="só em B" />
              <span className="text-xs text-zinc-500">{comp.comparadas.length} coluna(s) comparada(s)</span>
              <div className="relative ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  className="btn h-8 px-2.5 text-xs"
                  disabled={comp.diferentes.length === 0}
                  title={`Um UPDATE por registro diferente: ${b.nome} recebe os valores de ${aba.nome}`}
                  onClick={() => copiar(updatesDaComparacao(comp, aba.dados, b.dados, "b", tabelaDe(b)), `UPDATE copiado: ${comp.diferentes.length} registro(s), B ← A`)}
                >
                  <IconeCopiar className="h-3.5 w-3.5" /> UPDATE B ← A
                </button>
                <button
                  className="btn h-8 px-2.5 text-xs"
                  disabled={comp.diferentes.length === 0}
                  title={`Um UPDATE por registro diferente: ${aba.nome} recebe os valores de ${b.nome}`}
                  onClick={() => copiar(updatesDaComparacao(comp, aba.dados, b.dados, "a", tabelaDe(aba)), `UPDATE copiado: ${comp.diferentes.length} registro(s), A ← B`)}
                >
                  <IconeCopiar className="h-3.5 w-3.5" /> UPDATE A ← B
                </button>
                <button
                  className="btn h-8 px-2.5 text-xs"
                  disabled={comp.apenasA.length === 0}
                  title="INSERT dos registros de A que não existem em B (todas as colunas de A)"
                  onClick={() =>
                    copiar(
                      gerarInsert(aba.dados, comp.apenasA, aba.dados.colunas.map((_, j) => j), tabelaDe(b)),
                      `INSERT copiado: ${comp.apenasA.length} registro(s) que faltam em B`,
                    )
                  }
                >
                  <IconeCopiar className="h-3.5 w-3.5" /> INSERT dos que faltam em B
                </button>
                {aviso && (
                  <span role="status" className="absolute top-full right-0 z-50 mt-1 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {aviso}
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3 text-sm">
              {(comp.repetidasA > 0 || comp.repetidasB > 0 || cols.soA.length > 0 || cols.soB.length > 0) && (
                <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                  {(comp.repetidasA > 0 || comp.repetidasB > 0) && (
                    <p>
                      Chave repetida em {comp.repetidasA > 0 ? `${n(comp.repetidasA)} linha(s) de A` : ""}
                      {comp.repetidasA > 0 && comp.repetidasB > 0 ? " e " : ""}
                      {comp.repetidasB > 0 ? `${n(comp.repetidasB)} linha(s) de B` : ""}: só a primeira de cada chave foi comparada. Escolha outra chave ou
                      acrescente uma segunda coluna.
                    </p>
                  )}
                  {cols.soA.length > 0 && <p>Colunas só em A: <span className="font-mono">{cols.soA.join(", ")}</span></p>}
                  {cols.soB.length > 0 && <p>Colunas só em B: <span className="font-mono">{cols.soB.join(", ")}</span></p>}
                </div>
              )}

              {frequentes.length > 0 && (
                <p className="text-xs text-zinc-500">
                  Colunas que mais diferem:{" "}
                  {frequentes.slice(0, 12).map((f, k) => (
                    <span key={f.nome}>
                      {k > 0 && " · "}
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{f.nome}</span> ({n(f.qtd)})
                    </span>
                  ))}
                  {frequentes.length > 12 && ` · e mais ${frequentes.length - 12}`}
                </p>
              )}

              {comp.diferentes.length === 0 && comp.apenasA.length === 0 && comp.apenasB.length === 0 && (
                <p className="py-8 text-center text-zinc-500">
                  {comp.iguais > 0 ? "As duas abas têm os mesmos registros, iguais em todas as colunas comparadas." : "Nenhum registro para comparar."}
                </p>
              )}

              {comp.diferentes.slice(0, MAX_LISTA).map((l) => (
                <section key={l.ia} className="painel overflow-hidden">
                  <h3 className="border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-white/5">
                    <span className="text-zinc-500">{comp.chave.map((c) => c.nome).join(" + ")}:</span>{" "}
                    <strong className="font-mono">{rotuloChave(l.chave)}</strong>
                    <span className="ml-2 text-zinc-500">{l.colunas.length} coluna(s)</span>
                  </h3>
                  <table className="w-full table-fixed text-xs">
                    <tbody>
                      {l.colunas.map((c) => (
                        <tr key={c.nome} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-800">
                          <td className="w-52 px-3 py-1 align-top font-mono text-[11px] text-zinc-500">{c.nome}</td>
                          <td className="px-3 py-1 align-top font-mono break-words">
                            <span className="mr-1.5">{etiquetaA}</span>
                            {valor(c.a, aba.dados, c.ja)}
                          </td>
                          <td className="px-3 py-1 align-top font-mono break-words">
                            <span className="mr-1.5">{etiquetaB}</span>
                            {valor(c.b, b.dados, c.jb)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
              {comp.diferentes.length > MAX_LISTA && (
                <p className="text-xs text-zinc-500">
                  Mostrando os {MAX_LISTA} primeiros de {n(comp.diferentes.length)} registros diferentes (o UPDATE copiado inclui todos).
                </p>
              )}

              <ListaChaves titulo="Só em A" etiqueta={etiquetaA} nome={aba.nome} dados={aba.dados} linhas={comp.apenasA} js={comp.chave.map((c) => c.ja)} rotulo={rotuloChave} />
              <ListaChaves titulo="Só em B" etiqueta={etiquetaB} nome={b.nome} dados={b.dados} linhas={comp.apenasB} js={comp.chave.map((c) => c.jb)} rotulo={rotuloChave} />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

const CORES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
  violet: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
};

function Contador({ cor, qtd, texto }: { cor: keyof typeof CORES; qtd: number; texto: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${qtd === 0 ? "border-zinc-200 text-zinc-400 dark:border-white/10" : CORES[cor]}`}>
      <strong className="tabular-nums">{qtd.toLocaleString("pt-BR")}</strong> {texto}
    </span>
  );
}

function ListaChaves({
  titulo,
  etiqueta,
  nome,
  dados,
  linhas,
  js,
  rotulo,
}: {
  titulo: string;
  etiqueta: React.ReactNode;
  nome: string;
  dados: ResultadoParse;
  linhas: number[];
  js: number[];
  rotulo: (partes: string[]) => string;
}) {
  if (linhas.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold">
        {etiqueta} {titulo} <span className="font-normal text-zinc-500">({nome}) · {linhas.length.toLocaleString("pt-BR")} registro(s)</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {linhas.slice(0, MAX_LISTA).map((i) => (
          <span key={i} className="rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[11px] dark:border-white/10">
            {rotulo(js.map((j) => (dados.linhas[i][j] ?? "").trim()))}
          </span>
        ))}
        {linhas.length > MAX_LISTA && <span className="text-xs text-zinc-500">e mais {(linhas.length - MAX_LISTA).toLocaleString("pt-BR")}</span>}
      </div>
    </section>
  );
}
