import { createPipelineLeadAction } from "./actions";

type StageOption = { id: string; name: string };

const field =
  "ui-focus-ring w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-slate-500 focus:outline-none";

export function LeadCreateForm({
  pipelineKey,
  stages,
}: {
  pipelineKey: string;
  stages: StageOption[];
}) {
  if (!stages.length) return null;

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-4 text-base font-semibold text-slate-900">
        Add an opportunity
        <span className="ml-2 text-sm font-normal text-slate-500">Saved in this brand</span>
      </summary>
      <form action={createPipelineLeadAction} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
        <input type="hidden" name="pipelineKey" value={pipelineKey} />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Person’s name
          <input name="name" required maxLength={200} autoComplete="name" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Starting stage
          <select name="stageId" required defaultValue={stages[0].id} className={field}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Business (optional)
          <input name="company" maxLength={200} autoComplete="organization" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Email (optional)
          <input name="email" type="email" maxLength={254} autoComplete="email" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Phone (optional)
          <input name="phone" type="tel" maxLength={64} autoComplete="tel" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Service type
          <select name="offerType" defaultValue="bookkeeping" className={field}>
            <option value="bookkeeping">Monthly bookkeeping</option>
            <option value="onsite">On-site work</option>
            <option value="training">Training / consult</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Value basis
          <select name="valueBasis" defaultValue="unpriced" className={field}>
            <option value="unpriced">Not priced yet</option>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Estimated value (optional)
          <input name="value" type="number" min="0" step="0.01" inputMode="decimal" className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
          Notes (optional)
          <textarea name="notes" maxLength={2000} rows={3} className={field} />
        </label>
        <p className="text-sm text-slate-600 sm:col-span-2">Monthly estimates feed Lead MRR. One-time estimates stay out of MRR.</p>
        <div className="sm:col-span-2">
          <button type="submit" className="ui-action-primary min-h-12 w-full rounded-full px-5 text-base font-semibold sm:w-auto">
            Add opportunity
          </button>
        </div>
      </form>
    </details>
  );
}
