import "./admin.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  other: { google: "notranslate" }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="notranslate" translate="no">{children}</div>;
}
