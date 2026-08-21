const CHECKOUT_BASE = import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL as string | undefined;

export function isCheckoutConfigured(): boolean {
  return !!CHECKOUT_BASE;
}

interface CheckoutIdentity {
  userId: string;
  email?: string | null;
  name?: string | null;
}

/**
 * Construye la URL de checkout de Lemon Squeezy prellenada con el email del
 * usuario y su user_id en custom_data, para que el webhook (ver
 * supabase/functions/lemonsqueezy-webhook) pueda marcar el perfil correcto
 * como premium cuando llegue el pago.
 */
export function buildCheckoutUrl({ userId, email, name }: CheckoutIdentity): string | null {
  if (!CHECKOUT_BASE) return null;
  const url = new URL(CHECKOUT_BASE);
  if (email) url.searchParams.set('checkout[email]', email);
  if (name) url.searchParams.set('checkout[name]', name);
  url.searchParams.set('checkout[custom][user_id]', userId);
  return url.toString();
}

function ensureOverlayScript(): void {
  if (document.getElementById('lemonsqueezy-overlay-script')) return;
  const script = document.createElement('script');
  script.id = 'lemonsqueezy-overlay-script';
  script.src = 'https://assets.lemonsqueezy.com/lemon.js';
  script.defer = true;
  document.head.appendChild(script);
}

/**
 * Abre el checkout de Lemon Squeezy en un overlay (si el script ya cargó) o,
 * si no, en una pestaña nueva como respaldo.
 */
export function openCheckout(identity: CheckoutIdentity): void {
  const url = buildCheckoutUrl(identity);
  if (!url) {
    console.warn('VITE_LEMONSQUEEZY_CHECKOUT_URL no está configurado.');
    return;
  }
  ensureOverlayScript();
  const LemonSqueezy = (window as any).LemonSqueezy;
  if (LemonSqueezy?.Url?.Open) {
    LemonSqueezy.Url.Open(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
