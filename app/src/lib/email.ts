import "server-only";
import { headers } from "next/headers";

/**
 * Sends email through Resend's HTTP API. Without a verified domain, Resend's
 * test sender (onboarding@resend.dev) can only deliver to the email on your
 * Resend account — see .env.example.
 */

type Mail = { to: string; subject: string; html: string; text: string };

export type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail(mail: Mail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn(`[email] RESEND_API_KEY or EMAIL_FROM not set — not sending "${mail.subject}" to ${mail.to}`);
    return { ok: false, reason: "Email isn't set up yet." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}: ${body}`);
      if (res.status === 403 && /own email|testing emails/i.test(body)) {
        return {
          ok: false,
          reason:
            "Resend's test sender can only email the address on your Resend account. Use that address, or verify a domain in Resend.",
        };
      }
      return { ok: false, reason: "The email service rejected the message." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false, reason: "Couldn't reach the email service." };
  }
}

/** Absolute base URL for links in emails (APP_URL wins, else the current request's host). */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Where the logo image in emails is loaded from (email apps can't show inline SVG). */
const assetBase = () => (process.env.APP_URL || "https://signcerely.site").replace(/\/$/, "");

const FONT = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";

/** Branded layout (sky background, white card, pill button) that renders in common email clients. */
export function layout(opts: { heading: string; body: string; button: { label: string; url: string }; footer: string }) {
  const base = assetBase();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#DCEBFB;font-family:${FONT};color:#12305C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#DCEBFB" style="background:#DCEBFB;background-image:linear-gradient(180deg,#C9E1FB 0%,#E6F1FD 55%,#F4F9FF 100%);padding:36px 12px 40px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td align="center" style="padding:0 0 22px">
<a href="${base}" style="text-decoration:none;color:#12305C"><img src="${base}/email-logo.png" width="40" height="40" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:11px"><span style="display:inline-block;vertical-align:middle;padding-left:10px;font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#12305C">Signcerely</span></a>
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #D6E4F5;border-radius:22px;box-shadow:0 14px 40px rgba(31,111,214,0.14)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:34px 36px 0">
<span style="display:inline-block;width:44px;height:6px;border-radius:6px;background:#FFDD1F;font-size:0;line-height:0">&nbsp;</span>
</td></tr>
<tr><td style="padding:14px 36px 0;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.4px;color:#12305C">${esc(opts.heading)}</td></tr>
<tr><td style="padding:14px 36px 0;font-size:16px;line-height:1.6;color:#2F4A75">${opts.body}</td></tr>
<tr><td style="padding:26px 36px 30px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#2F86E8;background-image:linear-gradient(180deg,#5AA9F5 0%,#2F86E8 55%,#1F6FD6 100%);color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px;border:1px solid #1F6FD6;box-shadow:0 6px 16px rgba(31,111,214,0.28)">${esc(opts.button.label)}</a></td></tr>
<tr><td style="padding:0 36px"><div style="border-top:1px solid #E6EFF9;font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td style="padding:20px 36px 30px;font-size:13px;line-height:1.6;color:#4A6088">${opts.footer}<br><br>Button not working? Copy this link:<br><span style="word-break:break-all;color:#1F6FD6">${esc(opts.button.url)}</span></td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.6;color:#5A6F96">
Sent by <a href="${base}" style="color:#1F6FD6;text-decoration:none;font-weight:700">Signcerely</a> · Every signature is recorded on Stellar
</td></tr>
</table></td></tr></table></body></html>`;
}

export { esc as escapeHtml };
