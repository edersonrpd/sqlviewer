import type { Perfil } from "@/config/perfis";
import type { Diagnostico, NivelAchado } from "./diagnostico";
import { identificarMarketplace } from "./marketplace";
import type { CampoMontado, TelaMontada } from "./tela";

/**
 * Resumo do registro para colar no chamado: identificação, situação, valores,
 * o resultado do diagnóstico automático e os registros ligados nas outras abas.
 * Texto puro, sem formatação, para funcionar em qualquer sistema de chamados.
 */

const ROTULO_NIVEL: Record<NivelAchado, string> = { erro: "ERRO", alerta: "ALERTA", info: "INFO", ok: "OK" };

const campo = (c: CampoMontado) => `${c.rotulo}: ${c.texto === null ? "NULL" : c.texto.replace(/\s*\n\s*/g, " ").trim() || "(vazio)"}`;

export type LigadoResumo = { rotulo: string; aba: string; quantidade: number };

export function resumoParaChamado(tela: TelaMontada, perfil: Perfil | undefined, diagnostico: Diagnostico | null, ligados: LigadoResumo[] = []): string {
  const linhas: string[] = [];
  linhas.push(perfil ? `${tela.titulo} (${perfil.id} · ${perfil.nome})` : tela.titulo);
  if (tela.chave) {
    const mkt = identificarMarketplace(tela.chave.raw);
    linhas.push(`${campo(tela.chave)}${mkt ? ` (${mkt.nome})` : ""}`);
  }
  if (tela.subtitulo.length) linhas.push(tela.subtitulo.map(campo).join(" · "));
  if (tela.status.length) linhas.push(`Situação: ${tela.status.map((s) => `${s.rotulo}: ${s.texto}`).join(" · ")}`);
  for (const ind of tela.indicadores) {
    const detalhes = ind.detalhes.filter((d) => !d.vazio).map(campo);
    linhas.push(`${campo(ind.campo)}${detalhes.length ? ` (${detalhes.join(" · ")})` : ""}`);
  }
  if (tela.destaques.length) linhas.push(`Valores: ${tela.destaques.map(campo).join(" · ")}`);

  if (diagnostico && (diagnostico.achados.length > 0 || diagnostico.pendentes.length > 0)) {
    linhas.push("", "DIAGNÓSTICO");
    for (const a of diagnostico.achados) linhas.push(`[${ROTULO_NIVEL[a.nivel]}] ${a.titulo}${a.detalhe ? ` — ${a.detalhe}` : ""}`);
    if (diagnostico.pendentes.length) linhas.push(`Não verificado (consulta não aberta): ${diagnostico.pendentes.join(", ")}`);
  }

  if (ligados.length) {
    linhas.push("", "REGISTROS LIGADOS");
    for (const l of ligados) linhas.push(`${l.rotulo} (${l.aba}): ${l.quantidade}`);
  }
  return linhas.join("\n");
}
