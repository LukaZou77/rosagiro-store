"use client";

type SubcategoryDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminSubcategoryDeleteButton({ action }: { action: SubcategoryDeleteAction }) {
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm("Excluir esta subcategoria? Esta ação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      Excluir subcategoria
    </button>
  );
}
