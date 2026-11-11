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

/** Simple branded layout that renders in common email clients. */
export function layout(opts: { heading: string; body: string; button: { label: string; url: string }; footer: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F5F7FB;font-family:Arial,Helvetica,sans-serif;color:#0F1B3D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FB;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3E8F2;border-radius:16px">
<tr><td style="padding:28px 32px 8px;font-size:18px;font-weight:bold">
<span style="display:inline-block;background:#1F6FD6;color:#FFDD1F;border-radius:8px;padding:4px 8px;margin-right:8px">✓</span>Signcerely</td></tr>
<tr><td style="padding:12px 32px 0;font-size:24px;font-weight:bold;line-height:1.25">${esc(opts.heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:16px;line-height:1.55;color:#33406A">${opts.body}</td></tr>
<tr><td style="padding:24px 32px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#1F6FD6;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 22px;border-radius:10px">${esc(opts.button.label)}</a></td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.5;color:#4A5578">${opts.footer}<br><br>Button not working? Copy this link:<br><span style="word-break:break-all;color:#1F6FD6">${esc(opts.button.url)}</span></td></tr>
</table></td></tr></table></body></html>`;
}

export { esc as escapeHtml };
