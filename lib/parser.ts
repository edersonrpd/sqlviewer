import type { Aviso, Coluna, ResultadoParse, TipoColuna, Valor } from "./tipos";

/**
 * Parser do texto copiado do grid do cliente MySQL.
 *
 * - Colunas separadas por TAB, primeira linha = cabeçalho.
 * - Valores entre aspas duplas (com "" como aspa escapada) ou sem aspas.
 * - Um campo entre aspas pode conter TAB e quebra de linha.
 * - `\N` ou `NULL` sem aspas = NULL; `"NULL"` entre aspas = texto; `""` = string vazia.
 *
 * Todo valor é mantido como a string original; os tipos inferidos servem só
 * para exibir, ordenar e calcular.
 */

type Registro = { campos: Valor[]; linha: number; vazio: boolean };

/** Divide o texto em registros com um parser de estado (não usa split). */
export function tokenizar(texto: string): Registro[] {
  const registros: Registro[] = [];
  const n = texto.length;
  let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0; // BOM
  let linha = 1;

  let campos: Valor[] = [];
  let inicioRegistro = 1;
  let algumCitado = false;

  const fecharRegistro = () => {
    const vazio = !algumCitado && campos.length === 1 && (campos[0] ?? "x").trim() === "";
    registros.push({ campos, linha: inicioRegistro, vazio });
    campos = [];
    algumCitado = false;
  };

  while (i <= n) {
    // início de um campo
    if (i === n) {
      // fim do texto: só fecha se há algo pendente na linha atual
      if (campos.length > 0) {
        campos.push("");
        fecharRegistro();
      }
      break;
    }
    if (campos.length === 0) inicioRegistro = linha;

    let valor: Valor;
    if (texto[i] === '"') {
      algumCitado = true;
      i++;
      let partes = "";
      let inicio = i;
      for (;;) {
        if (i >= n) {
          // aspas sem fechamento: aproveita o que veio
          partes += texto.slice(inicio, i);
          break;
        }
        const c = texto[i];
        if (c === '"') {
          if (texto[i + 1] === '"') {
            partes += texto.slice(inicio, i + 1);
            i += 2;
            inicio = i;
            continue;
          }
          partes += texto.slice(inicio, i);
          i++;
          break;
        }
        if (c === "\n") linha++;
        else if (c === "\r" && texto[i + 1] !== "\n") linha++;
        i++;
      }
      // tolera caracteres soltos depois da aspa de fechamento
      let resto = i;
      while (resto < n && texto[resto] !== "\t" && texto[resto] !== "\n" && texto[resto] !== "\r") resto++;
      if (resto > i) partes += texto.slice(i, resto);
      i = resto;
      valor = partes;
    } else {
      const inicio = i;
      while (i < n && texto[i] !== "\t" && texto[i] !== "\n" && texto[i] !== "\r") i++;
      const bruto = texto.slice(inicio, i);
      valor = bruto === "\\N" || bruto === "NULL" ? null : bruto;
    }
    campos.push(valor);

    // separador depois do campo
    if (i >= n) {
      fecharRegistro();
      break;
    }
    const sep = texto[i];
    if (sep === "\t") {
      i++;
      if (i === n) {
        campos.push("");
        fecharRegistro();
        break;
      }
      continue;
    }
    // quebra de linha (\n, \r\n ou \r)
    i += sep === "\r" && texto[i + 1] === "\n" ? 2 : 1;
    linha++;
    fecharRegistro();
    if (i === n) break;
  }

  return registros;
}

const RE_DECIMAL = /^-?\d+\.\d+$/;
const RE_INTEIRO = /^-?(0|[1-9]\d{0,14})$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}:\d{2}$/;
const RE_DATAHORA = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;

/** Inferência conservadora: todos os valores não nulos precisam casar com o mesmo padrão. */
export function inferirTipo(valores: Iterable<Valor>): { tipo: TipoColuna; casas: number } {
  const candidatos: Record<Exclude<TipoColuna, "texto">, RegExp> = {
    inteiro: RE_INTEIRO,
    decimal: RE_DECIMAL,
    data: RE_DATA,
    hora: RE_HORA,
    datahora: RE_DATAHORA,
  };
  let restantes = Object.keys(candidatos) as Exclude<TipoColuna, "texto">[];
  let algum = false;
  let casas = 0;
  for (const v of valores) {
    if (v === null) continue;
    algum = true;
    restantes = restantes.filter((t) => candidatos[t].test(v));
    if (restantes.length === 0) return { tipo: "texto", casas: 0 };
    if (restantes[0] === "decimal") casas = Math.max(casas, v.length - v.indexOf(".") - 1);
  }
  if (!algum) return { tipo: "texto", casas: 0 };
  const tipo = restantes[0];
  return { tipo, casas: tipo === "decimal" ? casas : 0 };
}

function nomesUnicos(originais: string[], avisos: Aviso[]): string[] {
  const usados = new Set<string>();
  const contagem = new Map<string, number>();
  const repetidos: string[] = [];
  const nomes = originais.map((nome) => {
    if (!usados.has(nome)) {
      usados.add(nome);
      return nome;
    }
    let k = contagem.get(nome) ?? 1;
    let novo: string;
    do {
      k++;
      novo = `${nome} (${k})`;
    } while (usados.has(novo));
    contagem.set(nome, k);
    usados.add(novo);
    if (!repetidos.includes(nome)) repetidos.push(nome);
    return novo;
  });
  if (repetidos.length > 0) {
    avisos.push({
      tipo: "colunas-duplicadas",
      mensagem: `Colunas com nome repetido foram renomeadas (ex.: "${repetidos[0]} (2)"): ${repetidos.join(", ")}.`,
    });
  }
  return nomes;
}

function listarLinhas(linhas: number[]): string {
  const max = 20;
  const lista = linhas.slice(0, max).join(", ");
  return linhas.length > max ? `${lista} e mais ${linhas.length - max}` : lista;
}

export function parsearConsulta(texto: string): ResultadoParse {
  const avisos: Aviso[] = [];
  const registros = tokenizar(texto);

  // ignora linhas totalmente vazias no final (e no início, antes do cabeçalho)
  while (registros.length > 0 && registros[registros.length - 1].vazio) registros.pop();
  while (registros.length > 0 && registros[0].vazio) registros.shift();

  if (registros.length === 0) return { colunas: [], linhas: [], avisos };

  const cabecalho = registros[0].campos.map((v, j) => {
    const nome = (v ?? "NULL").trim();
    return nome === "" ? `(coluna ${j + 1})` : nome;
  });
  const nomes = nomesUnicos(cabecalho, avisos);
  const qtd = nomes.length;

  const linhas: Valor[][] = [];
  const divergentes: number[] = [];
  const vaziasNoMeio: number[] = [];
  for (let r = 1; r < registros.length; r++) {
    const reg = registros[r];
    if (reg.vazio && qtd > 1) {
      vaziasNoMeio.push(reg.linha);
      continue;
    }
    let campos = reg.campos;
    if (campos.length !== qtd) {
      divergentes.push(reg.linha);
      campos = campos.length > qtd ? campos.slice(0, qtd) : [...campos, ...Array<Valor>(qtd - campos.length).fill(null)];
    }
    linhas.push(campos);
  }

  if (divergentes.length > 0) {
    avisos.push({
      tipo: "colunas-divergentes",
      mensagem:
        `${divergentes.length} linha(s) com número de colunas diferente do cabeçalho (${qtd}). ` +
        `Campos faltantes viraram NULL e os excedentes foram descartados. Linhas do texto: ${listarLinhas(divergentes)}.`,
    });
  }
  if (vaziasNoMeio.length > 0) {
    avisos.push({
      tipo: "linhas-vazias",
      mensagem: `${vaziasNoMeio.length} linha(s) vazia(s) no meio do texto foram ignoradas: ${listarLinhas(vaziasNoMeio)}.`,
    });
  }

  const colunas: Coluna[] = nomes.map((nome, j) => {
    const { tipo, casas } = inferirTipo(valoresDaColuna(linhas, j));
    return { nome, original: cabecalho[j], tipo, casas };
  });

  return { colunas, linhas, avisos };
}

function* valoresDaColuna(linhas: Valor[][], j: number): Generator<Valor> {
  for (const l of linhas) yield l[j];
}
