# Koji Code ERP

ERP / CRM para talleres CNC. Cubre cotización, diseño, compras, producción,
calidad, embarque y reportes PMO para clientes.

Stack: **React 19 + Vite + Tailwind + Supabase**, listo para desplegarse en
**Vercel**.

---

## Modos de operación

La app tiene **dos modos** que se activan automáticamente según las variables
de entorno:

| Modo | Cuándo | Qué hace |
|---|---|---|
| **Demo** | No hay `VITE_SUPABASE_URL` configurada | Usa datos mock locales. Útil para demos sin backend. El header muestra el chip `Modo demo`. |
| **Producción** | Hay `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Conecta a Supabase real, auth real, datos reales. |

Esto permite que el sitio funcione en Vercel desde el primer push, aunque
todavía no tengas el proyecto de Supabase creado.

---

## Desarrollo local

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # tsc --noEmit
npm run build        # produce dist/
```

Variables (todas opcionales para modo demo):

```bash
cp .env.example .env.local
# Edita .env.local con tus URLs / keys
```

---

## Despliegue en Vercel

1. **Conecta el repo** en [vercel.com/new](https://vercel.com/new).
   Vercel detecta Vite automáticamente — no necesitas tocar build settings;
   `vercel.json` ya configura las rewrites de SPA y caché de assets.

2. **(Opcional) Agrega las variables de entorno** en
   `Project Settings → Environment Variables`:

   | Variable | Requerida | Descripción |
   |---|---|---|
   | `VITE_SUPABASE_URL`      | Para producción | URL del proyecto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Para producción | Anon key pública |
   | `VITE_N8N_WEBHOOK_URL`   | Opcional | Webhook para automatizaciones |

   Sin estas variables el sitio carga en **modo demo**, lo cual está bien
   para mostrarlo a clientes/equipo antes de tener Supabase.

3. **Push** al branch — Vercel hace deploy automático.

---

## Setup de Supabase (cuando quieras pasar a modo producción)

```bash
# 1. Crea el proyecto en https://supabase.com/dashboard
# 2. Aplica el schema:
psql $SUPABASE_DB_URL < database_schema.sql
# o pega su contenido en el SQL editor del dashboard.

# 3. Copia URL y anon key a Vercel (paso 2 de arriba) y a tu .env.local
```

El schema (`database_schema.sql`) cubre el workflow completo:

- `customers`, `suppliers`, `profiles`
- `projects`, `project_files` (OC cliente, planos, fotos)
- `bom_items`, `requisitions`, `purchase_orders` (+ items)
- `machines`, `work_orders`, `work_order_stages`, `time_entries`
- `quality_inspections`, `ncrs`, `measurement_instruments`
- `shipments`, `shipping_labels` (+ items) — para etiquetas con QR
- `pmo_reports` — snapshots para portal del cliente
- `chat_channels`, `chat_messages`
- `automation_events` — cola consumida por n8n

Incluye triggers `updated_at`, RLS base, función `is_admin()`, y seed inicial
de canales de chat.

---

## Arquitectura

```
src/
├── lib/
│   ├── supabase.ts          # Cliente único; expone `isSupabaseConfigured`
│   └── api/                 # Capa de datos con fallback Supabase ↔ mock
│       ├── projects.ts      # useProjects, useProject, useCreateProject, ...
│       ├── bom.ts           # useBomItems, useUpdateBomStatus, ...
│       ├── purchasing.ts    # useRequisitions, useSuppliers
│       ├── production.ts    # useMachines, useWorkOrders
│       ├── quality.ts       # useInspections, useNcrs, useInstruments, ...
│       ├── profiles.ts      # useProfiles, useProfile
│       └── mocks.ts         # Fuente única de los mocks de demo
├── types/database.ts        # Tipos del schema (espejean la DB)
├── contexts/
│   ├── AuthContext.tsx      # Supabase Auth + fallback demo
│   └── ChatContext.tsx
├── pages/                   # Una página por módulo
└── components/
    ├── layout/              # Shell, Sidebar, Header
    └── ui/                  # Componentes base (shadcn-style)
```

**Regla de oro:** los componentes **nunca** importan `supabase` directo.
Pasan por hooks de `src/lib/api/*` que devuelven `{ data, loading, error, refetch }`
y manejan el fallback transparentemente.

---

## Estado por módulo

| Módulo | UI redesign | Capa de datos | Funcionalidad |
|---|---|---|---|
| Dashboard           | ✅ | ✅ Hooks | KPIs derivados de proyectos / WO / inspecciones / NCRs |
| Proyectos (lista)   | ✅ | ✅ Hooks | Tabla, búsqueda, creación rápida + wizard de intake |
| **Intake wizard**   | ✅ | ✅ Hooks | Datos básicos → OC → BOM Excel → planos → confirmar |
| Proyecto detalle    | ✅ | ✅ Hooks | Detalle + **portal cliente** (magic link) |
| Diseño              | ✅ | 🟡 Mock | — |
| Compras             | ✅ | ✅ Hooks | Requisiciones, BOMs |
| Producción          | ✅ | ✅ Hooks | Máquinas + WO + link a detalle |
| **WO detalle**      | ✅ | ✅ Hooks | Etapas con start/pause/complete y time tracking |
| Calidad             | ✅ | ✅ Hooks | Inspecciones, NCRs, instrumentos |
| **Embarques**       | ✅ | ✅ Hooks | Packing list + cajas con etiquetas QR imprimibles |
| **Portal cliente**  | ✅ | ✅ Hooks | Ruta pública `/cliente/:token` con timeline visual |
| **PMO Reports**     | ✅ | ✅ Hooks | Generar, ver y enviar reportes ejecutivos al cliente |
| **Integraciones**   | ✅ | ✅ Hooks | Config n8n + cola de eventos + replay manual |
| Personal            | ✅ | ✅ Hooks | Portfolio en `profiles.metadata` JSONB |
| Técnicos            | ✅ | ✅ Hooks | Profiles filtrados + WO asignadas reales |
| Chat                | ✅ | ✅ Hooks | Supabase Realtime cuando hay credenciales, demo localStorage si no |
| Auth                | n/a | ✅ Supabase Auth + fallback | Dual-mode |

### Workflow end-to-end

1. **PM crea proyecto** vía wizard (`/projects/new`) — sube OC del cliente,
   BOM en Excel y planos 2D/3D.
2. **Compras** ve los items del BOM en `Compras > BOM/Listas`, levanta
   requisiciones, emite POs.
3. **Producción** crea Work Orders por pieza, accede al detalle de cada WO
   (`/production/wo/:id`) y carga la plantilla de etapas CNC. El técnico
   inicia/pausa/completa cada etapa — el tiempo real se registra automáticamente.
4. **Calidad** registra inspecciones por pieza, abre NCRs si rechaza.
5. **Embarque** (`/shipping`) — empaqueta en cajas, genera etiquetas QR que
   se pueden imprimir. Cada QR linka al portal del cliente.
6. **PMO** (`/pmo`) — el PM genera un reporte snapshot y lo envía al cliente
   con un click. El envío dispara un evento `pmo.report_sent` en la cola.
7. **Portal cliente** (`/cliente/:token`) — el cliente abre el link y ve el
   avance: timeline, KPIs, inspecciones, documentos compartidos. Sin login.

### Automatizaciones (n8n)

Triggers PostgreSQL en `database_schema.sql` insertan automáticamente en
`automation_events` cuando ocurren eventos críticos:

| Evento | Cuándo se dispara |
|---|---|
| `project.status_changed`  | Cambia el `status` de un proyecto |
| `ncr.opened`              | Se inserta un NCR |
| `inspection.final_approved` | Inspección tipo `Final` con resultado `Aprobado` |
| `shipment.listo` / `en_tránsito` / `entregado` | Cambia el estado del embarque |
| `pmo.report_sent`         | Reporte PMO marcado como enviado al cliente |

**Para consumir desde n8n** (3 opciones):

1. **Database Webhooks (recomendado):** Supabase Dashboard → Database → Webhooks
   → apunta a tu webhook de n8n filtrando por la tabla `automation_events`.
2. **Polling:** nodo Supabase en n8n que consulta `SELECT * FROM
   automation_events WHERE delivered = false` cada N minutos, procesa, y llama
   `mark_event_delivered(event_id, error)` vía RPC.
3. **Replay manual:** desde `Configuración → Integraciones (n8n)` puedes
   reenviar cualquier evento al webhook con un click.

La URL del webhook se configura en Vercel como `VITE_N8N_WEBHOOK_URL`.

### Realtime (Supabase)

El schema ya añade a la publicación `supabase_realtime` las tablas:
`chat_messages`, `chat_channels`, `automation_events`, `work_order_stages`.

Esto permite que:
- El chat se actualice en vivo sin reload cuando alguien manda mensaje.
- El portal del técnico vea cambios de etapa en tiempo real.
- Los eventos automatizados aparezcan en `/settings/integrations` al instante.

En modo demo (sin Supabase), un fallback con localStorage + eventos de
ventana simula este comportamiento dentro del mismo browser tab.

**Siguiente:** Edge Function de Supabase que automatice el POST a n8n
(elimina la necesidad de configurar Database Webhook manualmente), envío
automático del reporte PMO semanal vía cron, mejoras de exportación PDF.
