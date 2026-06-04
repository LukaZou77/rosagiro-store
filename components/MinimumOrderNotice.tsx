import Link from "next/link";
import { money } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";

export function MinimumOrderNotice({
  subtotalCents,
  compact = false
}: {
  subtotalCents: number;
  compact?: boolean;
}) {
  const minimum = siteConfig.wholesale.minimumOrderCents;
  const remaining = Math.max(0, minimum - subtotalCents);
  const progress = minimum > 0 ? Math.min(100, Math.round((subtotalCents / minimum) * 100)) : 100;
  const reached = remaining === 0;

  return (
    <section className={compact ? "minimum-order compact" : "minimum-order"} aria-label="Pedido mínimo">
      <div className="minimum-order-copy">
        <span>{siteConfig.wholesale.minimumOrderTitle}</span>
        <strong>{money(minimum)}</strong>
        <p>
          {reached
            ? "Pedido acima do mínimo sugerido para atacado."
            : `Faltam ${money(remaining)} para atingir o mínimo sugerido. Adicione mais itens ou fale com o atendimento.`}
        </p>
      </div>
      <div className="minimum-order-meter" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      {!compact && !reached ? (
        <Link href="/categoria/all?sort=price-asc">Adicionar mais produtos</Link>
      ) : null}
    </section>
  );
}
