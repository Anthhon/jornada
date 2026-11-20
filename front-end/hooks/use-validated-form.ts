"use client";

import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";

/** Bridge domain validation (including cross-field rules) to RHF's error state. */
export function useValidatedForm<T extends FieldValues>(defaultValues: T) {
  const form = useForm<T>({ defaultValues: defaultValues as DefaultValues<T> });
  const validationErrors: Record<string, string> = {};
  for (const [key, error] of Object.entries(form.formState.errors.root ?? {})) {
    if (error && typeof error === "object" && "message" in error) {
      validationErrors[key] = String(error.message);
    }
  }
  function setValidationErrors(errors: Record<string, string>) {
    form.clearErrors("root");
    for (const [key, message] of Object.entries(errors)) {
      form.setError(`root.${key}`, { type: "validate", message });
    }
  }
  return { ...form, validationErrors, setValidationErrors };
}
