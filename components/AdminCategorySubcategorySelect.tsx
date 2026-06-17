"use client";

import { useMemo, useState } from "react";

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
        Categoria
        <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
          {!categories.length ? <option value="">Cadastre uma categoria primeiro</option> : null}
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcategoria
        <select
          key={categoryId}
          name="subcategoryId"
          defaultValue={defaultSelectedSubcategoryId}
          required
          disabled={!options.length}
        >
          {!options.length ? <option value="">Cadastre subcategorias para esta categoria</option> : null}
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
