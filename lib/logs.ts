/**
 * Logs acumulados em um campo de texto (ex.: FAT_LOGMSG da FATAUT), no formato
 *
 *   ------------------------------------------------
 *   31/10/2026 12:28:53 - Data ainda não permitida para faturamento, ...
 *
 * O robô tenta de novo a cada poucos segundos e grava a mesma mensagem dezenas de
 * vezes; o resumo agrupa as mensagens iguais para o suporte ver o que aconteceu.
 */

export type EntradaLog = { quando: string; texto: string };
export type MensagemLog = { texto: string; qtd: number; primeira: string; ultima: string };
export type ResumoLog = { entradas: EntradaLog[]; mensagens: MensagemLog[]; ultima: EntradaLog | null };

const ENTRADA = /^(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(?::\d{2})?)\s*-\s*([\s\S]*)$/;

/** Separa as entradas do log (na ordem em que foram gravadas) e agrupa as mensagens repetidas. */
export function resumirLog(raw: string | null | undefined): ResumoLog {
  const entradas: EntradaLog[] = [];
  for (const bloco of (raw ?? "").split(/^\s*-{10,}\s*$/m)) {
    const m = ENTRADA.exec(bloco.trim());
    if (!m) continue;
    // aspas dobradas ("") vêm do próprio texto gravado pela procedure
    entradas.push({ quando: m[1], texto: m[2].replace(/""/g, '"').replace(/\s+/g, " ").trim() });
  }
  const porTexto = new Map<string, MensagemLog>();
  for (const e of entradas) {
    const g = porTexto.get(e.texto);
    if (g) {
      g.qtd++;
      g.ultima = e.quando;
    } else porTexto.set(e.texto, { texto: e.texto, qtd: 1, primeira: e.quando, ultima: e.quando });
  }
  return { entradas, mensagens: [...porTexto.values()], ultima: entradas.at(-1) ?? null };
}

/** Texto curto para a Tela: total, última tentativa e cada mensagem distinta com a contagem. */
export function textoResumoLog(raw: string | null | undefined): string | null {
  const r = resumirLog(raw);
  if (!r.ultima) return null;
  const linhas = [`${r.entradas.length} registro(s) no log · último em ${r.ultima.quando}`];
  for (const m of r.mensagens) {
    const periodo = m.qtd > 1 ? ` (de ${m.primeira} a ${m.ultima})` : ` (${m.primeira})`;
    linhas.push(`• ${m.qtd}× ${m.texto}${periodo}`);
  }
  return linhas.join("\n");
}
