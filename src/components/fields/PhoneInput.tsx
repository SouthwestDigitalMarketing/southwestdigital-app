"use client";

import { useMemo, useRef, useState } from "react";
import {
  PHONE_COUNTRY_OPTIONS,
  formatNationalNumber,
  splitStoredPhone,
  toE164,
} from "@/lib/phone";

const fieldClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function PhoneInput({
  name = "phone",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const initial = useMemo(() => splitStoredPhone(defaultValue), [defaultValue]);
  const [countryCode, setCountryCode] = useState(initial.countryCode);
  const [national, setNational] = useState(initial.national);
  const [error, setError] = useState<string | null>(null);
  const telRef = useRef<HTMLInputElement>(null);

  const e164 = useMemo(() => {
    try {
      return toE164(countryCode, national) ?? "";
    } catch {
      return "";
    }
  }, [countryCode, national]);

  function syncValidity(nextCountry: string, nextNational: string) {
    const el = telRef.current;
    if (!el) return;
    if (!nextNational.replace(/\D/g, "")) {
      el.setCustomValidity("");
      setError(null);
      return;
    }
    try {
      toE164(nextCountry, nextNational);
      el.setCustomValidity("");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enter a valid phone number.";
      el.setCustomValidity(message);
      setError(message);
    }
  }

  const placeholder = countryCode === "+1" ? "(555) 123-4567" : "Phone number";

  return (
    <div className="min-w-0">
      <input type="hidden" name={name} value={e164} />
      <div className="grid min-w-0 grid-cols-[6.75rem_minmax(0,1fr)] gap-2">
        <select
          value={countryCode}
          aria-label="Country code"
          onChange={(event) => {
            const next = event.target.value;
            setCountryCode(next);
            const formatted = formatNationalNumber(next, national);
            setNational(formatted);
            syncValidity(next, formatted);
          }}
          className={`${fieldClass} min-w-0 bg-white`}
        >
          {PHONE_COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          ref={telRef}
          value={national}
          onChange={(event) => {
            const formatted = formatNationalNumber(countryCode, event.target.value);
            setNational(formatted);
            const el = telRef.current;
            if (!el) return;
            if (!formatted.replace(/\D/g, "")) {
              el.setCustomValidity("");
              setError(null);
              return;
            }
            try {
              toE164(countryCode, formatted);
              el.setCustomValidity("");
              setError(null);
            } catch (err) {
              el.setCustomValidity(
                err instanceof Error ? err.message : "Enter a valid phone number.",
              );
            }
          }}
          onBlur={() => syncValidity(countryCode, national)}
          aria-invalid={Boolean(error)}
          className={`${fieldClass} min-w-0 w-full ${error ? "border-rose-400" : ""}`}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
