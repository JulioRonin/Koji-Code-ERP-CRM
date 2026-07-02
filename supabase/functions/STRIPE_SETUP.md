# Pago en línea con Stripe — guía de activación

Tres Edge Functions sincronizan la suscripción con la tabla `tenants`:

| Función           | JWT        | Qué hace                                                        |
|-------------------|------------|----------------------------------------------------------------|
| `stripe-checkout` | sí         | Crea la sesión de pago (suscripción) con el precio del plan.    |
| `stripe-webhook`  | **no**     | Stripe avisa el resultado; activa/actualiza el tenant.         |
| `stripe-portal`   | sí         | Abre el portal de facturación (tarjeta, facturas, cancelar).   |

## 1. Crea tu cuenta y llaves de Stripe
En el dashboard de Stripe → *Developers → API keys*, copia la **Secret key**
(`sk_live_…` o `sk_test_…` para pruebas).

## 2. Configura los secrets en Supabase
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
# El webhook secret se obtiene en el paso 4:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya existen por defecto.

## 3. Despliega las funciones
```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 4. Registra el webhook en Stripe
En *Developers → Webhooks → Add endpoint*, usa la URL:
```
https://<TU-PROYECTO>.supabase.co/functions/v1/stripe-webhook
```
Suscríbelo a estos eventos:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copia el *Signing secret* (`whsec_…`) y guárdalo como `STRIPE_WEBHOOK_SECRET`
(paso 2). Vuelve a desplegar `stripe-webhook` si lo cambiaste.

## 5. Activa el portal de facturación
En *Settings → Billing → Customer portal*, activa el portal (una vez) para que
`stripe-portal` funcione.

## Precios — dos formas

`stripe-checkout` acepta **dos modos** (elige uno):

### A) Automático (sin productos en Stripe)
No configuras nada extra. La función crea el precio "en línea" (MXN) según
`plans.ts` + la oferta `promo.ts` (Profesional $8,500 hasta la fecha límite).
Simple, pero los cobros no quedan ligados a tus productos de Stripe.

### B) Ligado a TUS productos/precios de Stripe (recomendado)
Si ya creaste los productos, liga cada **Price ID** con un secret. La función
usa el Price ID cuando existe y, si no, cae al modo automático.

**1. Obtén el Price ID de cada producto** (no el Product ID):
Stripe → *Products* → abre el producto → en *Pricing* copia el id que empieza
con `price_...` (uno por cada ciclo mensual/anual que hayas creado).

**2. Crea los secrets en Supabase** con estos nombres exactos:
```bash
supabase secrets set STRIPE_PRICE_BASICO_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_BASICO_ANNUAL=price_xxx
supabase secrets set STRIPE_PRICE_PROFESIONAL_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PROFESIONAL_ANNUAL=price_xxx
# Opcional: precio de oferta del Profesional ($8,500). Si no lo pones,
# durante la promo se usa el mensual/anual normal de arriba.
supabase secrets set STRIPE_PRICE_PROFESIONAL_PROMO_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PROFESIONAL_PROMO_ANNUAL=price_xxx
```
> Enterprise no lleva Price ID: es "a cotizar" (botón Contactar ventas).
> El precio (monto) vive en el propio Price de Stripe; asegúrate de que el
> monto del Price coincida con el plan (Básico $5,500, Profesional $12,000, y el
> promo $8,500).

**3. Vuelve a desplegar** para que tome los secrets:
```bash
supabase functions deploy stripe-checkout
```

Regla de resolución por plan/ciclo:
`STRIPE_PRICE_<PLAN>_<CICLO>` — PLAN ∈ {BASICO, PROFESIONAL}, CICLO ∈ {MONTHLY, ANNUAL}.
En promo, si existe `STRIPE_PRICE_PROFESIONAL_PROMO_<CICLO>` se usa ese.

## Flujo
1. El usuario elige un plan en `/subscription` → `stripe-checkout` → Stripe.
2. Paga → Stripe redirige a `/subscription?checkout=success`.
3. `stripe-webhook` recibe el evento y pone `tenants.status = 'active'` con
   `current_period_end`. La app refresca y desbloquea el acceso.
