"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const WhatsAppPhoneContext = createContext<string | null>(null);

export function WhatsAppProvider({ children, phone }: { children: ReactNode; phone?: string | null }) {
  return <WhatsAppPhoneContext.Provider value={phone || null}>{children}</WhatsAppPhoneContext.Provider>;
}

export function useWhatsAppPhone() {
  return useContext(WhatsAppPhoneContext);
}
