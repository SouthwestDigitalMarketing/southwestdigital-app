import { EmailInput } from "@/components/fields/EmailInput";
import { PhoneInput } from "@/components/fields/PhoneInput";
import { Plus } from "lucide-react";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

export type ContactCreationOptions = {
  tags: Array<{ id: string; label: string; kind: ContactTagKindName }>;
  clients: Array<{ id: string; label: string }>;
  brands: Array<{ id: string; label: string }>;
};

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ContactCreateFields({
  tags,
  clients,
  brands,
  autoFocusFirstName = false,
  defaultSelectedClientIds = [],
  defaultSelectedTagIds = [],
  onAddClient,
  onAddTag,
}: ContactCreationOptions & {
  autoFocusFirstName?: boolean;
  defaultSelectedClientIds?: readonly string[];
  defaultSelectedTagIds?: readonly string[];
  onAddClient?: () => void;
  onAddTag?: () => void;
}) {
  return (
    <>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        First name
        <input
          name="firstName"
          required
          autoComplete="given-name"
          autoFocus={autoFocusFirstName}
          className={inputClass}
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Last name
        <input name="lastName" required autoComplete="family-name" className={inputClass} />
      </label>
      <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Email
        <div className="mt-1.5">
          <EmailInput />
        </div>
      </label>
      <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Phone
        <div className="mt-1.5">
          <PhoneInput />
        </div>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Company
        <input name="company" autoComplete="organization" className={inputClass} />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Role / title
        <input
          name="roleTitle"
          autoComplete="organization-title"
          placeholder="Owner, bookkeeper, CPA…"
          className={inputClass}
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-2">
        Notes
        <textarea name="notes" rows={3} className={inputClass} />
      </label>

      {onAddClient || clients.length > 0 ? (
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Clients
          </legend>
          <p className="mt-1 text-[11px] text-slate-400">
            Companies this brand serves. A person can belong to more than one.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onAddClient ? (
              <button
                type="button"
                onClick={onAddClient}
                className="ui-action-secondary inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-semibold transition"
              >
                <Plus size={12} />
                Add new client
              </button>
            ) : null}
            {clients.map((client) => (
              <label key={client.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="clientIds"
                  value={client.id}
                  defaultChecked={defaultSelectedClientIds.includes(client.id)}
                  className="peer sr-only"
                />
                <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                  {client.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {brands.length > 0 ? (
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Brands
          </legend>
          <p className="mt-1 text-[11px] text-slate-400">
            App tenants this person is tied to. Check every brand that applies.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {brands.map((brand) => (
              <label key={brand.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="relatedBrandIds"
                  value={brand.id}
                  className="peer sr-only"
                />
                <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                  {brand.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {onAddTag || tags.length > 0 ? (
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tags
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {onAddTag ? (
              <button
                type="button"
                onClick={onAddTag}
                className="ui-action-secondary inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-semibold transition"
              >
                <Plus size={12} />
                Add new tag
              </button>
            ) : null}
            {tags.map((tag) => (
              <label key={tag.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={defaultSelectedTagIds.includes(tag.id)}
                  className="peer sr-only"
                />
                <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                  {tag.label}
                  <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                    {TAG_KIND_LABELS[tag.kind]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
