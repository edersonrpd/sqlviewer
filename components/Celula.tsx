import { formatarValor } from "@/lib/formatacao";
import type { TipoColuna, Valor } from "@/lib/tipos";

/** NULL em itálico esmaecido; string vazia como célula vazia; demais valores formatados. */
export function Celula({ valor, tipo }: { valor: Valor; tipo: TipoColuna }) {
  if (valor === null) return <span className="valor-null">NULL</span>;
  if (valor === "") return null;
  return <>{formatarValor(valor, tipo)}</>;
}

export function alinhamento(tipo: TipoColuna): string {
  return tipo === "inteiro" || tipo === "decimal" ? "text-right tabular-nums" : "text-left";
}
