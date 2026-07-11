import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  CATALOG_NATIONAL_SHIPPING_TEXT,
  catalogSkuRows,
  catalogStockLabel,
  catalogWholesaleLabel,
  customerCatalogBrandFileName,
  hasCatalogWholesalePrice,
  type CustomerCatalogDownloadData,
  type CustomerCatalogDownloadProduct
} from "@/lib/admin-customer-catalog-core";
import { money } from "@/lib/money";

export type CustomerCatalogPdfOptions = {
  headerImage: string;
  imageData: ReadonlyMap<string, string>;
  minimumOrderCents: number;
  whatsapp: string;
};

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function imageNode(source: string, imageData: ReadonlyMap<string, string>, width: number, height: number): Content | null {
  const image = imageData.get(source);
  if (!image) return null;
  return { image, fit: [width, height], alignment: "center", margin: [0, 0, 0, 4] };
}

function headerCell(text: string): TableCell {
  return {
    text,
    bold: true,
    color: "#ffffff",
    fillColor: "#982f50",
    fontSize: 6.5,
    margin: [0, 2, 0, 2]
  };
}

function productRows(
  product: CustomerCatalogDownloadProduct,
  imageData: ReadonlyMap<string, string>
): TableCell[][] {
  const skus = catalogSkuRows({
    productImage: product.image,
    productPriceCents: product.priceCents,
    mpn: product.mpn,
    skus: product.skus
  });
  const rowSpan = skus.length;

  return skus.map((sku, index) => {
    const firstRow = index === 0;
    const productImage = imageNode(product.image, imageData, 46, 46);
    const skuImage = skus.length > 1 ? imageNode(sku.image, imageData, 22, 22) : null;
    const productStack: Content[] = [];
    if (productImage) productStack.push(productImage);
    productStack.push(
      { text: product.name, bold: true, fontSize: 6.8, lineHeight: 1.15 },
      { text: product.subcategory, color: "#706a72", fontSize: 5.8, margin: [0, 2, 0, 0] }
    );
    if (skus.length > 1) {
      productStack.push({ text: `${skus.length} variações`, color: "#2f7752", fontSize: 5.6, margin: [0, 2, 0, 0] });
    }

    const modelContent: Content = skuImage
      ? {
          columns: [
            { width: 25, stack: [skuImage] },
            {
              width: "*",
              stack: [
                { text: sku.code, bold: true, color: "#7e2945", fontSize: 6.5 },
                ...(sku.name !== sku.code
                  ? [{ text: sku.name, color: "#706a72", fontSize: 5.6, margin: [0, 2, 0, 0] } as Content]
                  : [])
              ]
            }
          ],
          columnGap: 4
        }
      : {
          stack: [
            { text: sku.code, bold: true, color: "#7e2945", fontSize: 6.5 },
            ...(sku.name !== sku.code
              ? [{ text: sku.name, color: "#706a72", fontSize: 5.6, margin: [0, 2, 0, 0] } as Content]
              : [])
          ]
        };

    const productCell = firstRow
      ? ({ stack: productStack, rowSpan, margin: [0, 1, 0, 1] } as TableCell)
      : ({} as TableCell);
    const brandCell = firstRow
      ? ({ text: product.brandName, rowSpan, fontSize: 6.4 } as TableCell)
      : ({} as TableCell);
    const categoryCell = firstRow
      ? ({ text: product.categoryLabel, rowSpan, fontSize: 6.4 } as TableCell)
      : ({} as TableCell);
    const wholesaleCell = firstRow
      ? ({
          text: catalogWholesaleLabel(product.wholesalePackage),
          rowSpan,
          bold: true,
          color: hasCatalogWholesalePrice(product.wholesalePackage) ? "#982f50" : "#a55a18",
          fontSize: 6.3
        } as TableCell)
      : ({} as TableCell);
    const stockCell = firstRow
      ? ({
          text: catalogStockLabel(product.inStock),
          rowSpan,
          bold: true,
          alignment: "center",
          color: product.inStock ? "#216343" : "#9a5a12",
          fillColor: product.inStock ? "#edf8f2" : "#fff7ed",
          fontSize: 6.1
        } as TableCell)
      : ({} as TableCell);

    return [
      productCell,
      brandCell,
      categoryCell,
      modelContent as TableCell,
      { text: money(sku.priceCents), bold: true, color: "#982f50", fontSize: 6.6 } as TableCell,
      wholesaleCell,
      stockCell
    ];
  });
}

export function collectCustomerCatalogImageSources(data: CustomerCatalogDownloadData, headerImage: string) {
  const sources = new Set<string>([headerImage]);
  for (const group of data.groups) {
    for (const product of group.products) {
      sources.add(product.image);
      const skus = catalogSkuRows({
        productImage: product.image,
        productPriceCents: product.priceCents,
        mpn: product.mpn,
        skus: product.skus
      });
      if (skus.length > 1) {
        for (const sku of skus) sources.add(sku.image);
      }
    }
  }
  return Array.from(sources).filter(Boolean);
}

export function buildCustomerCatalogPdfDefinition(
  data: CustomerCatalogDownloadData,
  options: CustomerCatalogPdfOptions
): TDocumentDefinitions {
  const content: Content[] = [];
  const headerImage = imageNode(options.headerImage, options.imageData, 190, 39);

  content.push({
    columns: [
      headerImage ? { width: 200, stack: [headerImage] } : { width: 200, text: "RosaGiro", bold: true, fontSize: 22 },
      {
        width: "*",
        stack: [
          { text: "CATÁLOGO DE ATACADO", alignment: "right", color: "#2f7752", bold: true, fontSize: 7 },
          { text: data.brand.name, alignment: "right", color: "#982f50", bold: true, fontSize: 20 },
          {
            text: `${countLabel(data.productCount, "produto", "produtos")} · ${countLabel(data.skuCount, "modelo", "modelos")}`,
            alignment: "right",
            color: "#706a72",
            fontSize: 7
          }
        ]
      }
    ],
    columnGap: 16,
    margin: [0, 0, 0, 10]
  });

  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        [
          { text: [{ text: "PEDIDO MÍNIMO\n", color: "#706a72", fontSize: 6 }, { text: money(options.minimumOrderCents), bold: true, color: "#982f50", fontSize: 8 }] },
          { text: [{ text: "ATENDIMENTO\n", color: "#706a72", fontSize: 6 }, { text: options.whatsapp, bold: true, color: "#982f50", fontSize: 8 }] },
          { text: [{ text: "ENTREGA\n", color: "#706a72", fontSize: 6 }, { text: CATALOG_NATIONAL_SHIPPING_TEXT, bold: true, color: "#982f50", fontSize: 8 }] }
        ] as TableCell[]
      ]
    },
    layout: {
      hLineColor: () => "#ded8da",
      vLineColor: () => "#ded8da",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6
    },
    margin: [0, 0, 0, 12]
  });

  if (data.groups.length > 1) {
    content.push({
      text: [
        { text: "Encontre por categoria: ", bold: true, color: "#332e31" },
        { text: data.groups.map((group) => `${group.label} (${group.products.length})`).join(" | "), color: "#706a72" }
      ],
      fontSize: 6.5,
      margin: [0, 0, 0, 12]
    });
  }

  data.groups.forEach((group, groupIndex) => {
    content.push({
      stack: [
        { text: "CATEGORIA", color: "#2f7752", bold: true, fontSize: 6 },
        {
          columns: [
            { text: group.label, color: "#982f50", bold: true, fontSize: 12 },
            { text: countLabel(group.products.length, "produto", "produtos"), alignment: "right", color: "#706a72", fontSize: 6.5 }
          ]
        }
      ],
      pageBreak: groupIndex > 0 ? "before" : undefined,
      margin: [0, 0, 0, 5]
    });

    const rows: TableCell[][] = [
      [
        headerCell("Produto"),
        headerCell("Marca"),
        headerCell("Categoria"),
        headerCell("Modelo"),
        headerCell("Unitário"),
        headerCell("Embalagem fechada"),
        headerCell("Estoque")
      ]
    ];
    for (const product of group.products) rows.push(...productRows(product, options.imageData));

    content.push({
      table: {
        headerRows: 1,
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        widths: [150, 55, 65, 105, 55, 125, 75],
        body: rows
      },
      layout: {
        hLineColor: () => "#ded8da",
        vLineColor: () => "#ded8da",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4
      }
    });
  });

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 24, 24, 32],
    info: {
      title: customerCatalogBrandFileName(data.brand.name),
      author: "RosaGiro",
      subject: `Catálogo de atacado ${data.brand.name}`
    },
    compress: true,
    defaultStyle: { font: "Roboto", color: "#332e31", fontSize: 7, lineHeight: 1.15 },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: "Estoque e preços sujeitos à confirmação antes do fechamento do pedido.",
          color: "#706a72",
          fontSize: 6,
          margin: [24, 0, 0, 0]
        },
        {
          text: `WhatsApp ${options.whatsapp} · ${currentPage}/${pageCount}`,
          alignment: "right",
          color: "#2f7752",
          bold: true,
          fontSize: 6,
          margin: [0, 0, 24, 0]
        }
      ]
    })
  };
}
