export async function waitForRecordedProposalPayment({
  engagementId,
  headers,
  attempts = 10,
  delayMs = 400,
}: {
  engagementId: string;
  headers: HeadersInit;
  attempts?: number;
  delayMs?: number;
}): Promise<"paid" | "pending"> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(`/api/proposal/${engagementId}/confirm-payment`, {
      method: "POST",
      headers,
    });
    if (response.ok) {
      const data = (await response.json().catch(() => ({}))) as { paid?: boolean };
      if (data.paid === true) return "paid";
    }
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return "pending";
}
