"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Printer } from "lucide-react";

function waitForImage(image: HTMLImageElement) {
  if (image.complete) return Promise.resolve();
  return new Promise<void>((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

async function prepareDocumentImages() {
  const imagePromise = Promise.all(Array.from(document.images).map(waitForImage));
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 20_000));
  await Promise.race([imagePromise.then(() => undefined), timeout]);
  await document.fonts?.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function AdminCatalogPrintButton({
  documentTitle,
  className,
  statusClassName
}: {
  documentTitle: string;
  className?: string;
  statusClassName?: string;
}) {
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [documentTitle]);

  async function handlePrint() {
    if (preparing) return;
    setPreparing(true);
    try {
      await prepareDocumentImages();
      window.print();
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div>
      <button className={className} type="button" onClick={handlePrint} disabled={preparing}>
        {preparing ? <LoaderCircle size={17} /> : <Printer size={17} />}
        {preparing ? "Preparando imagens..." : "Imprimir / salvar em PDF"}
      </button>
      <span className={statusClassName} aria-live="polite">
        {preparing ? "A impressão abrirá assim que as imagens estiverem prontas." : ""}
      </span>
    </div>
  );
}
