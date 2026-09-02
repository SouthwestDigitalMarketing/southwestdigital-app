import type { EmailConfig } from "next-auth/providers/email";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { normalizeEmail } from "@/lib/email/normalize";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function magicLinkHtml(input: {
  brandName: string;
  url: string;
  lightColor: string;
  accentColor: string;
}): string {
  const brandName = escapeHtml(input.brandName);
  const url = escapeHtml(input.url);
  const lightColor = escapeHtml(input.lightColor);
  const accentColor = escapeHtml(input.accentColor);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#17202a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:18px">
            <tr>
              <td style="padding:32px">
                <div style="height:5px;border-radius:999px;background:${accentColor};margin-bottom:24px"></div>
                <h1 style="margin:0;font-size:24px;color:${lightColor}">Sign in to ${brandName}</h1>
                <p style="margin:16px 0 24px;line-height:1.6;color:#475569">Use the secure button below to finish signing in. This link expires automatically and can be used only once.</p>
                <a href="${url}" style="display:inline-block;border-radius:999px;background:${lightColor};color:#fff;text-decoration:none;font-weight:700;padding:13px 22px">Sign in securely</a>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#64748b">If you did not request this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function BrandedResend(config: { apiKey: string; from: string }): EmailConfig {
  return {
    id: "resend",
    type: "email",
    name: "Email",
    apiKey: config.apiKey,
    from: config.from,
    maxAge: 20 * 60,
    normalizeIdentifier: normalizeEmail,
    async sendVerificationRequest({ identifier, url, provider }) {
      const hostname = new URL(url).hostname;
      const brand = await resolveAppBrandByHostname(hostname);
      const isPlatform = isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL);

      if (!brand && !isPlatform) {
        throw new Error("Refusing to send a magic link for an unverified application hostname");
      }

      const brandName = brand?.name ?? "Southwest Digital App";
      const lightColor = brand?.theme?.lightColor ?? "#17324d";
      const accentColor = brand?.theme?.accentColor ?? "#d79b3b";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: provider.from,
          to: normalizeEmail(identifier),
          subject: `Sign in to ${brandName}`,
          html: magicLinkHtml({ brandName, url, lightColor, accentColor }),
          text: `Sign in to ${brandName}: ${url}\n\nIf you did not request this email, ignore it.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Transactional email request failed with status ${response.status}`);
      }
    },
  };
}

