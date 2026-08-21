import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
};

const PREMIUM_ON_EVENTS = new Set([
  'order_created',
  'subscription_created',
  'subscription_payment_success',
  'subscription_resumed',
]);

const PREMIUM_OFF_EVENTS = new Set([
  'subscription_cancelled',
  'subscription_expired',
]);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = new Uint8Array(digest);
  try {
    return timingSafeEqual(computed, hexToBytes(signatureHeader));
  } catch {
    return false;
  }
}

// Espera un evento de Lemon Squeezy: https://docs.lemonsqueezy.com/help/webhooks
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const secret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'LEMONSQUEEZY_WEBHOOK_SECRET no configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');
  const valid = await verifySignature(rawBody, signature, secret);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventName: string | undefined = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data ?? {};
    const userId: string | undefined = customData.user_id;
    const attributes = payload?.data?.attributes ?? {};
    const customerId: string | undefined = attributes.customer_id ? String(attributes.customer_id) : undefined;
    const subscriptionId: string | undefined = payload?.data?.type === 'subscriptions' ? String(payload.data.id) : undefined;

    if (!eventName) {
      return new Response(JSON.stringify({ error: 'Evento sin nombre' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (PREMIUM_ON_EVENTS.has(eventName)) {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Falta custom_data.user_id en el checkout' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      await supabase.from('profiles').update({
        is_premium: true,
        premium_since: new Date().toISOString(),
        ...(customerId ? { lemonsqueezy_customer_id: customerId } : {}),
        ...(subscriptionId ? { lemonsqueezy_subscription_id: subscriptionId } : {}),
      }).eq('id', userId);
    } else if (PREMIUM_OFF_EVENTS.has(eventName)) {
      const query = supabase.from('profiles').update({ is_premium: false });
      if (userId) await query.eq('id', userId);
      else if (subscriptionId) await query.eq('lemonsqueezy_subscription_id', subscriptionId);
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
