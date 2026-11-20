"use client";

import { unstable_rethrow } from "next/navigation";
import { createContext, startTransition, useActionState, useRef, type FormEvent, type ReactNode } from "react";

type ProductEditorFailure = { error: string; loginRequired?: boolean };

export type ProductEditorAction = (formData: FormData) => Promise<ProductEditorFailure>;

export const AdminProductEditorStatus = createContext<{ failure: ProductEditorFailure | null; pending: boolean }>({ failure: null, pending: false });

export function AdminProductEditorForm({ action, failureMessage, children }: {
  action: ProductEditorAction;
  failureMessage: string;
  children: ReactNode;
}) {
  const submitted = useRef(false);
  const [failure, dispatch, pending] = useActionState<ProductEditorFailure | null, FormData>(async (_state, data) => {
    try {
      return await action(data);
    } catch (error) {
      unstable_rethrow(error);
      return { error: failureMessage };
    } finally {
      submitted.current = false;
    }
  }, null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || pending) return;
    submitted.current = true;
    const data = new FormData(event.currentTarget);
    // Dispatch separately so React does not reset uncontrolled fields or file inputs on a returned error.
    startTransition(() => dispatch(data));
  }

  return (
    <form method="post" onSubmit={submit} className="admin-detail-grid product-editor">
      <AdminProductEditorStatus.Provider value={{ failure: pending ? null : failure, pending }}>
        {children}
      </AdminProductEditorStatus.Provider>
    </form>
  );
}
