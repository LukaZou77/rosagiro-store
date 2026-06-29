import type { Prisma } from "@/src/generated/prisma/client";
import { AdminCategorySubcategorySelect } from "@/components/AdminCategorySubcategorySelect";
import { AdminProductGalleryManager } from "@/components/AdminProductGalleryManager";
import { AdminProductSubmitButton } from "@/components/AdminProductSubmitButton";
import { AdminSkuManager } from "@/components/AdminSkuManager";
import { formatImportMoney, normalizeProductGallery, pipeListValue } from "@/lib/product-import-shared";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY, stockAvailabilityValue } from "@/lib/product-stock";

type AdminProductFormProduct = Prisma.ProductGetPayload<{
  include: { brand: true; category: true; inventory: true; skus: true };
}>;

type ProductFormAction = (formData: FormData) => void | Promise<void>;

type AdminProductFormProps = {
  action: ProductFormAction;
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; label: string; subcategories: Array<{ id: string; label: string }> }>;
  mode: "create" | "edit";
  product?: AdminProductFormProduct;
};

function textValue(value: string | null | undefined, fallback = "") {
  return value ?? fallback;
}

function numberValue(value: number | null | undefined, fallback: number | string = "") {
  return value ?? fallback;
}

export function AdminProductForm({ action, brands, categories, mode, product }: AdminProductFormProps) {
  const isEdit = mode === "edit";
  const gallery = product ? normalizeProductGallery(product.image, product.gallery) : [];
  const currentImage = product?.image || "";
  const submitLabel = isEdit ? "Salvar ficha completa" : "Criar produto";
  const skuStock = product?.skus?.length
    ? product.skus.filter((sku) => sku.active).reduce((total, sku) => total + Math.max(0, sku.quantity), 0)
    : null;

  return (
    <form action={action} className="admin-detail-grid product-editor">
      {isEdit && product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <section className="import-panel">
        <div className="product-editor-main-image">
          {currentImage ? (
            <img className="product-editor-image" src={currentImage} alt={product?.name || "Produto"} />
          ) : (
            <div className="product-editor-image placeholder" aria-hidden="true">
              Sem imagem
            </div>
          )}
          <span>Imagem principal</span>
        </div>
        <div className="form-grid">
          <label>
            Slug
            <input
              name={isEdit ? undefined : "slug"}
              value={isEdit ? product?.slug || "" : undefined}
              readOnly={isEdit}
              placeholder={isEdit ? undefined : "Gerado pelo nome se ficar vazio"}
            />
          </label>
          <label>
            Rank de vitrine
            <input name="featuredRank" type="number" min="0" defaultValue={numberValue(product?.featuredRank, 1000)} />
          </label>
        </div>
        <label>
          Caminho ou URL manual
          <input
            name="image"
            defaultValue={currentImage}
            placeholder="/assets/... ou /uploads/products/... ou URL http(s)"
            required={isEdit}
          />
        </label>
        <p className="table-note">
          Em produto novo, você pode preencher um caminho manual ou apenas enviar imagens abaixo. Aceita /assets/...,
          /uploads/products/..., /placeholder... ou URL http(s).
        </p>

        <AdminProductGalleryManager currentImage={currentImage} gallery={gallery} isEdit={isEdit} />
      </section>

      <section className="import-panel">
        <div className="form-grid">
          <label>
            Nome
            <input name="name" defaultValue={product?.name || ""} required />
          </label>
          <label>
            Marca
            <select name="brandId" defaultValue={product?.brandId || brands[0]?.id || ""} required>
              {!brands.length ? <option value="">Cadastre uma marca primeiro</option> : null}
              {brands.map((brand) => (
                <option value={brand.id} key={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <AdminCategorySubcategorySelect
            categories={categories}
            defaultCategoryId={product?.categoryId}
            defaultSubcategoryId={product?.subcategoryId}
          />
        </div>

        <label>
          Descrição
          <textarea name="descriptionPt" defaultValue={product?.descriptionPt || ""} required />
        </label>

        <div className="form-grid">
          <label>
            Preço base
            <input name="price" defaultValue={formatImportMoney(product?.basePriceCents ?? product?.priceCents)} required />
          </label>
          <label>
            Disponibilidade
            <select
              name="quantity"
              defaultValue={stockAvailabilityValue(skuStock ?? product?.inventory?.quantity) === "in" ? String(INTERNAL_AVAILABLE_STOCK_QUANTITY) : "0"}
            >
              <option value={INTERNAL_AVAILABLE_STOCK_QUANTITY}>Em estoque</option>
              <option value="0">Sem estoque</option>
            </select>
          </label>
          <label>
            Peso unitario (g)
            <input name="weightGrams" type="number" min="1" defaultValue={numberValue(product?.weightGrams)} placeholder="Opcional" />
          </label>
          <label className="checkbox-label">
            <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
            Produto ativo
          </label>
        </div>
        <p className="table-note">
          O cliente verá apenas Em estoque ou Sem estoque. Se cadastrar SKU ativo, a disponibilidade geral será recalculada pelas variações ativas.
        </p>

        <AdminSkuManager
          skus={(product?.skus || []).map((sku) => ({
            id: sku.id,
            name: sku.name,
            code: sku.code,
            image: sku.image,
            priceCents: sku.priceCents,
            basePriceCents: sku.basePriceCents,
            quantity: sku.quantity,
            active: sku.active,
            sortOrder: sku.sortOrder
          }))}
        />

        <div className="admin-form-block">
          <div className="product-gallery-heading">
            <div>
              <strong>Dados de atacado</strong>
              <small>Informações exibidas no produto e enviadas na consulta por WhatsApp.</small>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Caixa fechada / atacado
              <input
                name="wholesalePackage"
                defaultValue={textValue(product?.wholesalePackage)}
                placeholder="Ex: Caixa com 12 un. sob consulta"
              />
            </label>
            <label>
              Validade / lote
              <input
                name="validityNote"
                defaultValue={textValue(product?.validityNote)}
                placeholder="Ex: Validade minima 12 meses"
              />
            </label>
            <label>
              Observacao de compra
              <textarea
                name="purchaseNote"
                defaultValue={textValue(product?.purchaseNote)}
                placeholder="Ex: Confirmar estoque para volume pelo WhatsApp"
              />
            </label>
          </div>
          <p className="table-note">
            Use esses campos para orientar revendedoras e lojistas. Eles não alteram o checkout.
          </p>
        </div>

        <div className="form-grid">
          <label>
            Beneficios
            <textarea name="benefits" defaultValue={pipeListValue(product?.benefits)} />
          </label>
          <label>
            Ingredientes
            <textarea name="ingredients" defaultValue={pipeListValue(product?.ingredients)} />
          </label>
          <label>
            Tags / badges
            <textarea name="badges" defaultValue={pipeListValue(product?.badges)} />
          </label>
        </div>
        <p className="table-note">Use | para separar vários itens, igual ao CSV.</p>

        <div className="form-grid">
          <label>
            Tipo de pele / uso
            <input name="skinType" defaultValue={product?.skinType || ""} />
          </label>
          <label>
            Acabamento / textura
            <input name="finish" defaultValue={product?.finish || ""} />
          </label>
          <label>
            Volume / tamanho
            <input name="volume" defaultValue={product?.volume || ""} />
          </label>
          <label>
            Rating
            <input name="rating" defaultValue={product?.rating ? String(product.rating).replace(".", ",") : ""} />
          </label>
          <label>
            Avaliações
            <input name="reviewCount" type="number" min="0" defaultValue={product?.reviewCount ? product.reviewCount : ""} />
          </label>
        </div>

        <AdminProductSubmitButton label={submitLabel} />
      </section>
    </form>
  );
}
