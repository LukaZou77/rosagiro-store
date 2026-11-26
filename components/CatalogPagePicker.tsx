"use client";

import { useRouter } from "next/navigation";

type PageOption = {
  href: string;
  page: number;
};

export function CatalogPagePicker({
  currentPage,
  totalPages,
  pages
}: {
  currentPage: number;
  totalPages: number;
  pages: PageOption[];
}) {
  const router = useRouter();

  return (
    <label className="catalog-page-picker">
      <span>Página</span>
      <select
        aria-label={`Escolher página, atual ${currentPage} de ${totalPages}`}
        value={pages.find(({ page }) => page === currentPage)?.href || ""}
        onChange={(event) => router.push(event.currentTarget.value)}
      >
        {pages.map(({ href, page }) => (
          <option key={page} value={href}>
            {page} de {totalPages}
          </option>
        ))}
      </select>
    </label>
  );
}
