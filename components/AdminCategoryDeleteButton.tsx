"use client";

type CategoryDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminCategoryDeleteButton({ action }: { action: CategoryDeleteAction }) {
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm("Excluir esta categoria? Esta ação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      Excluir categoria
    </button>
  );
}
