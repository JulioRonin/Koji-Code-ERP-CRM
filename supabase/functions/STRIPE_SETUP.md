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

## Precios
Los montos se calculan en `stripe-checkout` (MXN) y reflejan `plans.ts` + la
oferta de `promo.ts` (Profesional $8,500 hasta la fecha límite). No necesitas
crear *Price IDs* en Stripe: se usan precios `price_data` en línea. Si cambias
precios en el front, actualiza el catálogo `PRICES`/`PROMO` de la función.

## Flujo
1. El usuario elige un plan en `/subscription` → `stripe-checkout` → Stripe.
2. Paga → Stripe redirige a `/subscription?checkout=success`.
3. `stripe-webhook` recibe el evento y pone `tenants.status = 'active'` con
   `current_period_end`. La app refresca y desbloquea el acceso.
