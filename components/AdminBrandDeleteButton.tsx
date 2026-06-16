"use client";

type BrandDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminBrandDeleteButton({ action }: { action: BrandDeleteAction }) {
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm("Excluir esta marca? Esta ação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      Excluir marca
    </button>
  );
}
