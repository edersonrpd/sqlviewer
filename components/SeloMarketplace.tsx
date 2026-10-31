import { identificarMarketplace, type IdMarketplace } from "@/lib/marketplace";

const CORES: Record<IdMarketplace, string> = {
  mercadolivre: "bg-yellow-300 text-[#2d3277] ring-yellow-400 dark:bg-yellow-300/90 dark:ring-yellow-300",
  shopee: "bg-orange-500 text-white ring-orange-600 dark:bg-orange-500/90 dark:ring-orange-400",
  amazon: "bg-[#232f3e] text-[#ff9900] ring-[#131a22] dark:bg-[#ff9900] dark:text-[#131a22] dark:ring-[#ff9900]",
  magalu: "bg-[#0086ff] text-white ring-[#0070d6] dark:bg-[#0086ff]/90 dark:ring-[#3aa0ff]",
};

/** Selo com o marketplace de origem do pedido, identificado pelo NUMPOK. Nada aparece se não for reconhecido. */
export function SeloMarketplace({ valor, compacto }: { valor: string | null | undefined; compacto?: boolean }) {
  const m = identificarMarketplace(valor);
  if (!m) return null;
  return (
    <span
      title={`Pedido ${m.nome} (prefixo ${m.prefixo})`}
      className={`inline-flex shrink-0 items-center rounded-full font-sans font-semibold whitespace-nowrap ring-1 ring-inset ${CORES[m.id]} ${
        compacto ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      {m.nome}
    </span>
  );
}
