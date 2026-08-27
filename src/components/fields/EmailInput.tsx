"use client";

import { useState } from "react";
import { isValidEmail, normalizeEmailInput } from "@/lib/email";

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function EmailInput({
  name = "email",
  defaultValue = "",
  required = false,
  placeholder = "name@company.com",
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const showError = touched && value.trim().length > 0 && !isValidEmail(value);

  return (
    <div>
      <input
        name={name}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/\s/g, ""))}
        onBlur={() => {
          setTouched(true);
          setValue(normalizeEmailInput(value));
        }}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = event.clipboardData.getData("text");
          setValue(normalizeEmailInput(pasted));
        }}
        aria-invalid={showError}
        className={`${fieldClass} ${showError ? "border-rose-400" : ""}`}
      />
      {showError && (
        <p className="mt-1 text-[11px] text-rose-600">Use a full address, like name@company.com.</p>
      )}
    </div>
  );
}
