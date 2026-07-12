"use client";

import { useMemo, useState } from "react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";

type AdminSubcategoryOption = {
  id: string;
  label: string;
};

type AdminCategoryOption = {
  id: string;
  label: string;
  subcategories: AdminSubcategoryOption[];
};

export function AdminCategorySubcategorySelect({
  categories,
  defaultCategoryId,
  defaultSubcategoryId
}: {
  categories: AdminCategoryOption[];
  defaultCategoryId?: string | null;
  defaultSubcategoryId?: string | null;
}) {
  const { t } = useAdminLanguage();
  const initialCategoryId = defaultCategoryId || categories[0]?.id || "";
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) || categories[0],
    [categories, categoryId]
  );
  const options = selectedCategory?.subcategories || [];
  const defaultSelectedSubcategoryId = options.some((option) => option.id === defaultSubcategoryId)
    ? defaultSubcategoryId || ""
    : options[0]?.id || "";

  return (
    <>
      <label>
        {t("Categoria", "品类")}
        <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
          {!categories.length ? <option value="">{t("Cadastre uma categoria primeiro", "请先创建品类")}</option> : null}
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Subcategoria", "子品类")}
        <select
          key={categoryId}
          name="subcategoryId"
          defaultValue={defaultSelectedSubcategoryId}
          required
          disabled={!options.length}
        >
          {!options.length ? <option value="">{t("Cadastre subcategorias para esta categoria", "请先为该品类创建子品类")}</option> : null}
          {options.map((option) => (
            <option value={option.id} key={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
