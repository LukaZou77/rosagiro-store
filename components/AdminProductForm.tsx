import type { Prisma } from "@/src/generated/prisma/client";
import { AdminCategorySubcategorySelect } from "@/components/AdminCategorySubcategorySelect";
import { AdminProductGalleryManager } from "@/components/AdminProductGalleryManager";
import { AdminProductSubmitButton } from "@/components/AdminProductSubmitButton";
import { AdminSkuManager } from "@/components/AdminSkuManager";
import { formatImportMoney, normalizeProductGallery, pipeListValue } from "@/lib/product-import-shared";
import { INTERNAL_AVAILABLE_STOCK_QUANTITY, stockAvailabilityValue } from "@/lib/product-stock";
import { createAdminTranslator, type AdminLocale } from "@/lib/admin-i18n";

type AdminProductFormProduct = Prisma.ProductGetPayload<{
  include: { brand: true; category: true; inventory: true; skus: true };
}>;

type ProductFormAction = (formData: FormData) => void | Promise<void>;

type AdminProductFormProps = {
  action: ProductFormAction;
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; label: string; subcategories: Array<{ id: string; label: string }> }>;
  mode: "create" | "edit";
  locale: AdminLocale;
  product?: AdminProductFormProduct;
};

function textValue(value: string | null | undefined, fallback = "") {
  return value ?? fallback;
}

function numberValue(value: number | null | undefined, fallback: number | string = "") {
  return value ?? fallback;
}

export function AdminProductForm({ action, brands, categories, mode, locale, product }: AdminProductFormProps) {
  const t = createAdminTranslator(locale);
  const isEdit = mode === "edit";
  const gallery = product ? normalizeProductGallery(product.image, product.gallery) : [];
  const currentImage = product?.image || "";
  const submitLabel = isEdit ? t("Salvar ficha completa", "保存完整商品资料") : t("Criar produto", "创建商品");
  const skuStock = product?.skus?.length
    ? product.skus.filter((sku) => sku.active).reduce((total, sku) => total + Math.max(0, sku.quantity), 0)
    : null;

  return (
    <form action={action} className="admin-detail-grid product-editor">
      {isEdit && product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <section className="import-panel">
        <div className="product-editor-main-image">
          {currentImage ? (
            <img className="product-editor-image" src={currentImage} alt={product?.name || t("Produto", "商品")} />
          ) : (
            <div className="product-editor-image placeholder" aria-hidden="true">
              {t("Sem imagem", "暂无图片")}
            </div>
          )}
          <span>{t("Imagem principal", "主图")}</span>
        </div>
        <div className="form-grid">
          <label>
            Slug
            <input
              name={isEdit ? undefined : "slug"}
              value={isEdit ? product?.slug || "" : undefined}
              readOnly={isEdit}
              placeholder={isEdit ? undefined : t("Gerado pelo nome se ficar vazio", "留空时根据商品名自动生成")}
            />
          </label>
          <label>
            {t("Rank de vitrine", "前台排序")}
            <input name="featuredRank" type="number" min="0" defaultValue={numberValue(product?.featuredRank, 1000)} />
          </label>
        </div>
        <label>
          {t("Caminho ou URL manual", "手动图片路径或 URL")}
          <input
            name="image"
            defaultValue={currentImage}
            placeholder="/assets/... ou /uploads/products/... ou URL http(s)"
            required={isEdit}
          />
        </label>
        <p className="table-note">
          {t("Em produto novo, você pode preencher um caminho manual ou apenas enviar imagens abaixo. Aceita /assets/..., /uploads/products/..., /placeholder... ou URL http(s).", "新建商品时可填写图片路径，也可以只在下方上传图片。支持 /assets/...、/uploads/products/...、/placeholder... 或 http(s) URL。")}
        </p>

        <label>
          {t("Imagem da bandeja/atacado (uso interno)", "货盘参考图（仅内部使用）")}
          <input
            name="trayImage"
            defaultValue={product?.trayImage || ""}
            placeholder={t("URL interna da imagem de referência do atacado", "内部货盘参考图 URL")}
          />
        </label>
        <p className="table-note">
          {t("Esta imagem fica apenas no admin para conferência. Ela não entra na galeria da loja nem nas imagens de SKU.", "该图片仅用于后台核对，不会进入前台商品图库或 SKU 图片。")}
        </p>

        <AdminProductGalleryManager currentImage={currentImage} gallery={gallery} isEdit={isEdit} />
      </section>

      <section className="import-panel">
        <div className="form-grid">
          <label>
            {t("Nome", "商品名")}
            <input name="name" defaultValue={product?.name || ""} required />
          </label>
          <label>
            {t("Marca", "品牌")}
            <select name="brandId" defaultValue={product?.brandId || brands[0]?.id || ""} required>
              {!brands.length ? <option value="">{t("Cadastre uma marca primeiro", "请先创建品牌")}</option> : null}
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
          {t("Descrição", "商品描述")}
          <textarea name="descriptionPt" defaultValue={product?.descriptionPt || ""} required />
        </label>

        <div className="form-grid">
          <label>
            {t("Preço base", "基础单价")}
            <input name="price" defaultValue={formatImportMoney(product?.basePriceCents ?? product?.priceCents)} required />
          </label>
          <label>
            {t("Disponibilidade", "库存状态")}
            <select
              name="quantity"
              defaultValue={stockAvailabilityValue(skuStock ?? product?.inventory?.quantity) === "in" ? String(INTERNAL_AVAILABLE_STOCK_QUANTITY) : "0"}
            >
              <option value={INTERNAL_AVAILABLE_STOCK_QUANTITY}>{t("Em estoque", "有货")}</option>
              <option value="0">{t("Sem estoque", "缺货")}</option>
            </select>
          </label>
          <label>
            {t("Peso unitario (g)", "单件重量（克）")}
            <input name="weightGrams" type="number" min="1" defaultValue={numberValue(product?.weightGrams)} placeholder={t("Opcional", "选填")} />
          </label>
          <label>
            GTIN / EAN
            <input name="gtin" inputMode="numeric" defaultValue={textValue(product?.gtin)} placeholder={t("Somente código conferido", "仅填写已核对的编码")} />
          </label>
          <label>
            {t("Modelo do fabricante (MPN)", "厂家型号（MPN）")}
            <input name="mpn" defaultValue={textValue(product?.mpn)} placeholder="Ex: HB-L6203" />
          </label>
          <label className="checkbox-label">
            <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
            {t("Produto ativo", "启用商品")}
          </label>
        </div>
        <p className="table-note">
          {t("O cliente verá apenas Em estoque ou Sem estoque. Se cadastrar SKU ativo, a disponibilidade geral será recalculada pelas variações ativas.", "客户只会看到“有货”或“缺货”。存在启用的 SKU 时，商品总体库存状态会根据启用规格重新计算。")}
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
              <strong>{t("Dados de atacado", "批发资料")}</strong>
              <small>{t("Informações exibidas no produto e enviadas na consulta por WhatsApp.", "这些信息会显示在商品页，并随 WhatsApp 咨询发送。")}</small>
            </div>
          </div>
          <div className="form-grid">
            <label>
              {t("Caixa fechada / atacado", "整件包装 / 批发")}
              <input
                name="wholesalePackage"
                defaultValue={textValue(product?.wholesalePackage)}
                placeholder={t("Ex: Caixa com 12 un. sob consulta", "例如：整件 12 个，详情请咨询")}
              />
            </label>
            <label>
              {t("Validade / lote", "保质期 / 批次")}
              <input
                name="validityNote"
                defaultValue={textValue(product?.validityNote)}
                placeholder={t("Ex: Validade minima 12 meses", "例如：保质期至少 12 个月")}
              />
            </label>
            <label>
              {t("Observacao de compra", "采购备注")}
              <textarea
                name="purchaseNote"
                defaultValue={textValue(product?.purchaseNote)}
                placeholder={t("Ex: Confirmar estoque para volume pelo WhatsApp", "例如：大批量采购请通过 WhatsApp 确认库存")}
              />
            </label>
          </div>
          <p className="table-note">
            {t("Use esses campos para orientar revendedoras e lojistas. Eles não alteram o checkout.", "这些字段用于向经销商和店主说明批发条件，不会改变结账逻辑。")}
          </p>
        </div>

        <div className="form-grid">
          <label>
            {t("Beneficios", "卖点 / 功效")}
            <textarea name="benefits" defaultValue={pipeListValue(product?.benefits)} />
          </label>
          <label>
            {t("Ingredientes", "成分")}
            <textarea name="ingredients" defaultValue={pipeListValue(product?.ingredients)} />
          </label>
          <label>
            {t("Tags / badges", "标签 / 徽标")}
            <textarea name="badges" defaultValue={pipeListValue(product?.badges)} />
          </label>
        </div>
        <p className="table-note">{t("Use | para separar vários itens, igual ao CSV.", "多个内容请使用 | 分隔，与 CSV 格式相同。")}</p>

        <div className="form-grid">
          <label>
            {t("Tipo de pele / uso", "适用肤质 / 用途")}
            <input name="skinType" defaultValue={product?.skinType || ""} />
          </label>
          <label>
            {t("Acabamento / textura", "妆效 / 质地")}
            <input name="finish" defaultValue={product?.finish || ""} />
          </label>
          <label>
            {t("Volume / tamanho", "容量 / 尺寸")}
            <input name="volume" defaultValue={product?.volume || ""} />
          </label>
          <label>
            Rating
            <input name="rating" defaultValue={product?.rating ? String(product.rating).replace(".", ",") : ""} />
          </label>
          <label>
            {t("Avaliações", "评价数量")}
            <input name="reviewCount" type="number" min="0" defaultValue={product?.reviewCount ? product.reviewCount : ""} />
          </label>
        </div>

        <AdminProductSubmitButton label={submitLabel} />
      </section>
    </form>
  );
}
