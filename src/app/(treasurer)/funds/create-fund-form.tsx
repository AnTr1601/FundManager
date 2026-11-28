"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFundAction } from "./actions";
import type { CreateFundState } from "./fund-form-state";

const initialState: CreateFundState = { status: "idle" };

const fieldClass =
  "w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 aria-[invalid=true]:border-red-500";

export function CreateFundForm() {
  const [state, action, pending] = useActionState(
    createFundAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium">
          Tên quỹ <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={fieldClass}
        />
        {errors.name && (
          <p id="name-error" className="text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          Mô tả <span className="text-foreground/40">(tùy chọn)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
          className={fieldClass}
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-red-600">
            {errors.description}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="targetPerMember" className="block text-sm font-medium">
          Mức đóng mỗi người{" "}
          <span className="text-foreground/40">(đồng, để trống = 0)</span>
        </label>
        <input
          id="targetPerMember"
          name="targetPerMember"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          aria-invalid={Boolean(errors.targetPerMember)}
          aria-describedby={
            errors.targetPerMember ? "target-error" : undefined
          }
          className={fieldClass}
        />
        {errors.targetPerMember && (
          <p id="target-error" className="text-sm text-red-600">
            {errors.targetPerMember}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3" aria-live="polite">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition disabled:opacity-50"
        >
          {pending ? "Đang tạo…" : "Tạo quỹ"}
        </button>
        {state.status === "success" && (
          <span className="text-sm text-green-600">Đã tạo quỹ.</span>
        )}
      </div>
    </form>
  );
}
