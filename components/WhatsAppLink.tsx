import type { ReactNode } from "react";

export function WhatsAppLink({
  href,
  className,
  children,
  ariaLabel
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a href={href} className={className} aria-label={ariaLabel} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
