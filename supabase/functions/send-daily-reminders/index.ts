import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PatientRow {
  id: string;
  email: string;
  full_name: string | null;
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Café con RS | Bitácora <bitacora@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://bitacora.app';

function greeting(name: string | null): string {
  if (!name) return 'Hola';
  const first = name.trim().split(/\s+/)[0];
  return `Hola, ${first}`;
}

function buildSubject(): string {
  return 'Un momento para ti hoy';
}

function buildHtml(patient: PatientRow, daysSince: number): string {
  const intro = greeting(patient.full_name);
  const daysText =
    daysSince <= 0
      ? 'hoy'
      : daysSince === 1
      ? 'ayer'
      : `hace ${daysSince} días`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Café con RS | Bitácora</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f8fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:28px 40px 8px 40px;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#6B8E23;color:#fff;text-align:center;line-height:28px;font-size:16px;">♥</span>
                <strong style="font-size:14px;color:#2C3E50;letter-spacing:0.2px;">Café con RS | Bitácora</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <h1 style="margin:0;font-size:22px;font-weight:600;line-height:1.3;color:#0f172a;">${intro} 👋</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px 40px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                Me di cuenta de que no has escrito en tu bitácora desde ${daysText}, y quería acercarme un momento.
                No es un reclamo ni una obligación; solo un pequeño recordatorio de que este espacio está aquí,
                esperándote cuando sientas que es el momento adecuado.
              </p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                A veces escribir unas líneas basta para poner en palabras lo que llevas dentro, y eso, aunque parezca
                poco, ya es un acto de cuidado hacia ti. Tampoco hace falta que sea largo ni perfecto: lo que cuentes
                vale, porque eres tú quien lo cuenta.
              </p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">
                Si hoy te sientes con energía, anímate a registrar tu ánimo. Y si no, también está bien: descansa,
                sé amable contigo y vuelve cuando quieras. Aquí seguiré acompañándote.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px 40px;">
              <a href="${APP_URL}" style="display:inline-block;background:#6B8E23;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Abrir mi bitácora</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Un abrazo,<br/>
                <strong style="color:#2C3E50;">Tu bitácora</strong>
              </p>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Recibes este correo porque tienes una cuenta en Café con RS | Bitácora y no has registrado tu ánimo en las últimas 24 horas.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(patient: PatientRow, daysSince: number): string {
  const intro = greeting(patient.full_name);
  const daysText = daysSince <= 0 ? 'hoy' : daysSince === 1 ? 'ayer' : `hace ${daysSince} días`;
  return `${intro},

Me di cuenta de que no has escrito en tu bitácora desde ${daysText}, y quería acercarme un momento. No es un reclamo ni una obligación; solo un pequeño recordatorio de que este espacio está aquí, esperándote cuando sientas que es el momento adecuado.

A veces escribir unas líneas basta para poner en palabras lo que llevas dentro, y eso, aunque parezca poco, ya es un acto de cuidado hacia ti. Tampoco hace falta que sea largo ni perfecto: lo que cuentes vale, porque eres tú quien lo cuenta.

Si hoy te sientes con energía, anímate a registrar tu ánimo. Y si no, también está bien: descansa, sé amable contigo y vuelve cuando quieras. Aquí seguiré acompañándote.

Abre tu bitácora: ${APP_URL}

Un abrazo,
Tu bitácora`;
}

async function sendReminderEmail(patient: PatientRow, daysSince: number): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: patient.email,
      subject: buildSubject(),
      html: buildHtml(patient, daysSince),
      text: buildText(patient, daysSince),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend error for ${patient.email}: ${res.status} ${body}`);
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // All patient profiles
    const { data: patients, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'patient');
    if (pErr) throw pErr;
    if (!patients || patients.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, message: 'No patients found.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Latest check-in per patient (within last 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCheckins, error: cErr } = await supabase
      .from('checkins')
      .select('user_id, created_at')
      .gte('created_at', cutoff);
    if (cErr) throw cErr;

    const recentUserIds = new Set((recentCheckins ?? []).map((c) => c.user_id));

    // For each patient not recent, also fetch their last check-in date for the email copy
    const toRemind = (patients as PatientRow[]).filter((p) => !recentUserIds.has(p.id));

    if (toRemind.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: patients.length, message: 'All patients checked in recently.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch last check-in timestamps for the patients to remind
    const { data: lastCheckins } = await supabase
      .from('checkins')
      .select('user_id, created_at')
      .in(
        'user_id',
        toRemind.map((p) => p.id)
      )
      .order('created_at', { ascending: false });

    const lastByUser = new Map<string, string>();
    for (const c of lastCheckins ?? []) {
      if (!lastByUser.has(c.user_id)) lastByUser.set(c.user_id, c.created_at);
    }

    let sent = 0;
    let failed = 0;
    for (const patient of toRemind) {
      const last = lastByUser.get(patient.id);
      const daysSince = last
        ? Math.floor((Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000))
        : 0;
      const ok = await sendReminderEmail(patient, daysSince);
      if (ok) sent++;
      else failed++;
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        total_patients: patients.length,
        reminded: toRemind.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
