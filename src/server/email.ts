import "server-only";

/**
 * Sends the magic link. Uses Resend when RESEND_API_KEY is set; otherwise logs
 * the link to the server console (development).
 */
export async function sendMagicLink(email: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`\n[magic-link] ${email} → ${link}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Sítio <onboarding@resend.dev>",
      to: email,
      subject: "Seu link para entrar no Sítio",
      text: `Olá! Toque no link para entrar no Sítio (vale por 15 minutos):\n\n${link}\n\nSe não foi você, ignore este e-mail.`,
      html: `<p>Olá!</p><p>Toque no botão para entrar no Sítio (vale por 15 minutos):</p><p><a href="${link}" style="background:#d9473f;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Entrar no Sítio</a></p><p style="color:#777">Se não foi você, ignore este e-mail.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}
