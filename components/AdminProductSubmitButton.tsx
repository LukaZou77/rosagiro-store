"use client";

import { useFormStatus } from "react-dom";

export function AdminProductSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button primary wide" disabled={pending} type="submit">
      {pending ? "Salvando..." : label}
    </button>
  );
}
