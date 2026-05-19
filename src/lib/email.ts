export function getConfirmationEmail(email: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Váš dotaz byl přijat — jede.online</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#050508">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="540" cellpadding="0" cellspacing="0" role="presentation"
          style="background:#0B0B12;border:1px solid rgba(201,169,97,0.2);border-radius:6px;overflow:hidden;max-width:540px;width:100%;">

          <!-- Gold top bar -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,#C9A961,#D4AF37,#C9A961);"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:48px 40px 40px;">

              <!-- Logo -->
              <p style="margin:0 0 48px 0;font-size:1.125rem;font-weight:600;letter-spacing:-0.02em;color:#F4F4F6;">
                jede<span style="color:#C9A961;">.</span>online
              </p>

              <!-- Headline -->
              <h1 style="margin:0 0 16px 0;font-size:1.75rem;font-weight:600;color:#F4F4F6;line-height:1.2;letter-spacing:-0.02em;">
                Váš dotaz byl přijat.
              </h1>

              <!-- Gold line -->
              <div style="width:2.5rem;height:1px;background:#C9A961;opacity:0.6;margin:24px 0;"></div>

              <!-- Body -->
              <p style="margin:0 0 32px 0;font-size:0.9375rem;color:#94A3B8;line-height:1.75;">
                Děkujeme za zájem o <strong style="color:#E2E8F0;">jede.online</strong>.<br/>
                Ozveme se na adresu <strong style="color:#C9A961;">${email}</strong> do 48 hodin s návrhem dalšího postupu.
              </p>

              <!-- What to expect -->
              <div style="background:#14141C;border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:24px 28px;margin-bottom:40px;">
                <p style="margin:0 0 14px 0;font-size:0.6875rem;color:#475569;letter-spacing:0.1em;text-transform:uppercase;">
                  Co vás čeká
                </p>
                <p style="margin:0;font-size:0.9375rem;color:#94A3B8;line-height:2;">
                  → Bezplatná konzultace a analýza vašich tabulek<br/>
                  → Návrh architektury aplikace přesně pro váš byznys<br/>
                  → Časový a cenový odhad bez závazků
                </p>
              </div>

              <!-- Disclaimer -->
              <p style="margin:0;font-size:0.8125rem;color:#475569;line-height:1.6;">
                Pokud jste o konzultaci nežádali, tento email ignorujte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:0.75rem;color:#475569;">
                jede.online © ${new Date().getFullYear()} ·
                <a href="https://jede.online" style="color:#C9A961;text-decoration:none;"> jede.online</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
