import Link from "next/link";

export function StoreTrustSignals({
  signals,
  title = "Compra com loja identificada",
  body = "Confira dados da loja, atendimento, entrega e políticas antes de finalizar.",
  compact = false,
  showLink = true
}: {
  signals: string[];
  title?: string;
  body?: string;
  compact?: boolean;
  showLink?: boolean;
}) {
  const visibleSignals = signals.filter(Boolean).slice(0, compact ? 3 : 5);

  return (
    <aside className={compact ? "store-trust-card compact" : "store-trust-card"} aria-label="Informações de confiança da loja">
      <span>Loja confiável</span>
      <strong>{title}</strong>
      {compact ? null : <p>{body}</p>}
      <div>
        {visibleSignals.map((signal) => (
          <small key={signal}>{signal}</small>
        ))}
      </div>
      {showLink ? <Link href="/informacoes-da-loja">Ver informações da loja</Link> : null}
    </aside>
  );
}
