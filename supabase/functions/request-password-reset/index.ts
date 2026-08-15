import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Calivia <onboarding@resend.dev>';

type Lang = 'es' | 'en' | 'pt';

function normalizeLang(value: unknown): Lang {
  return value === 'en' || value === 'pt' ? value : 'es';
}

const GENERIC_MESSAGE: Record<Lang, string> = {
  es: 'Si el nombre existe y tiene un correo de recuperación configurado, le enviamos un código.',
  en: 'If the name exists and has a recovery email set up, we sent a code to it.',
  pt: 'Se o nome existe e tem um e-mail de recuperação configurado, enviamos um código para ele.',
};

const EMAIL_COPY: Record<Lang, { subject: string; heading: string; intro: string; footer: string; text: (code: string) => string }> = {
  es: {
    subject: 'Tu código para recuperar el acceso a Calivia',
    heading: 'Recupera tu acceso',
    intro: 'Usa este código en la app para elegir una contraseña nueva. Vence en 15 minutos.',
    footer: 'Si no pediste este código, puedes ignorar este correo con tranquilidad.',
    text: (code) => `Tu código de recuperación es: ${code}\n\nVence en 15 minutos. Si no lo pediste tú, ignora este correo.`,
  },
  en: {
    subject: 'Your code to recover access to Calivia',
    heading: 'Recover your access',
    intro: 'Use this code in the app to choose a new password. It expires in 15 minutes.',
    footer: "If you didn't request this code, you can safely ignore this email.",
    text: (code) => `Your recovery code is: ${code}\n\nIt expires in 15 minutes. If you didn't request it, ignore this email.`,
  },
  pt: {
    subject: 'Seu código para recuperar o acesso ao Calivia',
    heading: 'Recupere seu acesso',
    intro: 'Use este código no app para escolher uma nova senha. Expira em 15 minutos.',
    footer: 'Se você não pediu este código, pode ignorar este e-mail com tranquilidade.',
    text: (code) => `Seu código de recuperação é: ${code}\n\nExpira em 15 minutos. Se você não pediu, ignore este e-mail.`,
  },
};

function buildEmail(code: string, lang: Lang): { subject: string; html: string; text: string } {
  const copy = EMAIL_COPY[lang];
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<body style="margin:0;padding:0;background:#F5F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="width:40px;height:40px;border-radius:12px;background:#708238;color:#fff;text-align:center;line-height:40px;font-size:18px;">♥</div>
          <h1 style="margin:16px 0 0;font-size:20px;color:#1a1d1a;">${copy.heading}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <p style="font-size:14px;line-height:1.6;color:#3a3a36;">${copy.intro}</p>
          <div style="margin:20px 0;padding:16px;background:#F5F3EE;border-radius:12px;text-align:center;">
            <span style="font-size:32px;font-weight:800;letter-spacing:0.1em;color:#1a1d1a;">${code}</span>
          </div>
          <p style="font-size:12px;color:#8c8a7e;">${copy.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: copy.subject, html, text: copy.text(code) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  let lang: Lang = 'es';
  const genericResponse = () =>
    new Response(
      JSON.stringify({ message: GENERIC_MESSAGE[lang] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  try {
    const { name, lang: rawLang } = await req.json();
    lang = normalizeLang(rawLang);

    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta el nombre' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .rpc('create_password_reset_code', { p_name: name })
      .maybeSingle();

    // Nunca revelamos si el nombre existe o no (evita enumerar cuentas):
    // siempre devolvemos el mismo mensaje genérico al cliente.
    if (error || !data || !data.recovery_email) {
      return genericResponse();
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY no configurado: no se pudo enviar el código de recuperación.');
      return genericResponse();
    }

    const { subject, html, text } = buildEmail(data.code, lang);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: data.recovery_email, subject, html, text }),
    });
    if (!res.ok) {
      console.error('Resend error:', res.status, await res.text().catch(() => ''));
    }

    return genericResponse();
  } catch (err) {
    console.error('request-password-reset failed:', err);
    return genericResponse();
  }
});
