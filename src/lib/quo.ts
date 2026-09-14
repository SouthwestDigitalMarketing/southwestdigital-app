export type SmsCredentials = {
  apiKey: string;
  from: string;
  phoneNumberId?: string;
};

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error(`Cannot normalize phone number: ${input}`);
}

export async function sendSms(to: string, content: string, credentials: SmsCredentials): Promise<void> {
  const apiKey = credentials.apiKey.trim();
  const from = credentials.from.trim();
  const phoneNumberId = credentials.phoneNumberId?.trim();
  if (!apiKey || !from) throw new Error("SMS is not configured for this brand.");

  const normalized = normalizePhone(to);

  const res = await fetch("https://api.quo.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [normalized],
      content,
      ...(phoneNumberId ? { phoneNumberId } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Quo SMS failed ${res.status}: ${body}`);
  }
}
