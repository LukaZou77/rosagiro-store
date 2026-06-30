"use client";

type GuideDeleteAction = (formData: FormData) => void | Promise<void>;

export function AdminGuideDeleteButton({ action }: { action: GuideDeleteAction }) {
  return (
    <button
      className="button secondary danger"
      type="submit"
      formAction={action}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm("Excluir este guia? Esta acao nao pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      Excluir guia
    </button>
  );
}
