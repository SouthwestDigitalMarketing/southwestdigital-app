function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error(`Cannot normalize phone number: ${input}`);
}

export async function sendSms(to: string, content: string): Promise<void> {
  const apiKey = process.env.QUO_API_KEY;
  const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) throw new Error("Quo API not configured");

  const normalized = normalizePhone(to);

  const res = await fetch("https://api.quo.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      phoneNumberId,
      to: [normalized],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Quo SMS failed ${res.status}: ${body}`);
  }
}
