import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Calivia <onboarding@resend.dev>';

function buildEmail(code: string): { subject: string; html: string; text: string } {
  const subject = 'Tu código para recuperar el acceso a Calivia';
  const text = `Tu código de recuperación es: ${code}\n\nVence en 15 minutos. Si no lo pediste tú, ignora este correo.`;
  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#F5F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="width:40px;height:40px;border-radius:12px;background:#708238;color:#fff;text-align:center;line-height:40px;font-size:18px;">♥</div>
          <h1 style="margin:16px 0 0;font-size:20px;color:#1a1d1a;">Recupera tu acceso</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <p style="font-size:14px;line-height:1.6;color:#3a3a36;">Usa este código en la app para elegir una contraseña nueva. Vence en 15 minutos.</p>
          <div style="margin:20px 0;padding:16px;background:#F5F3EE;border-radius:12px;text-align:center;">
            <span style="font-size:32px;font-weight:800;letter-spacing:0.1em;color:#1a1d1a;">${code}</span>
          </div>
          <p style="font-size:12px;color:#8c8a7e;">Si no pediste este código, puedes ignorar este correo con tranquilidad.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  const genericResponse = () =>
    new Response(
      JSON.stringify({ message: 'Si el nombre existe y tiene un correo de recuperación configurado, le enviamos un código.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  try {
    const { name } = await req.json();
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

    const { subject, html, text } = buildEmail(data.code);
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
