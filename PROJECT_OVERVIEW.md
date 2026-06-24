# KANRI · ERP/CRM — Resumen del Proyecto

**Cliente piloto:** IMC Design (taller CNC en México)
**Producto:** plataforma ERP/CRM para talleres de manufactura por arranque de viruta
**Visión:** vender como **SaaS multi-tenant** para talleres y maquilas (suscripción mensual vía Stripe)
**Branch de desarrollo activo:** `claude/optimistic-johnson-ltqhs9`

---

## 1. Visión y propuesta de valor

Cubrir el ciclo completo de un proyecto CNC bajo un solo techo digital:

> **Cotización → Compra → Diseño → Programación (Master Plan) → Producción → Calidad (ISO 9001) → Embarque → Portal del cliente**

Hoy IMC Design lo opera para sí misma; el siguiente paso es ofrecerlo como SaaS a otros talleres.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | **React 19 + Vite + TypeScript + Tailwind v4** |
| Routing / UI | React Router v6, Radix UI, `motion/react`, lucide-react |
| Charts | **recharts v3** |
| PDF | `pdfjs-dist` (lectura de planos) + `@media print` con portales (impresión) |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) |
| Persistencia | RLS por rol/departamento + funciones `is_admin / is_quality / is_production / is_purchasing` |
| Fallback | **Modo demo** con `localStorage` cuando no hay Supabase |
| Despliegue | Vercel (`hal-studio-five.vercel.app`) |

---

## 3. Módulos construidos

### 3.1 Autenticación y permisos
- Login por departamento, "Olvidé mi contraseña", reset.
- Roles: **Administrador, Administración/PM, Compras, Diseño, Producción, Calidad, Técnico**.
- Guardas de ruta + permisos por endpoint vía RLS de Postgres.
- Funciones `is_admin / is_quality / is_production / is_purchasing` toleran que el rol esté en columna `role` **o** `department` (vital para usuarios pre-existentes).

### 3.2 Configuración de empresa (multi-tenant ready, hoy single-tenant)
- `company_settings` con razón social, RFC, régimen SAT, domicilio fiscal, contacto, **logo y color de marca**.
- Branding dinámico: sidebar, login, reportes y PDFs usan los datos de la empresa cliente, **no** "KANRI".

### 3.3 Cotizaciones y proyectos
- Wizard de **nuevo proyecto** + carga de BOM por Excel con detección de duplicados, columnas dinámicas y validación.
- Detalle del proyecto: KPIs, notas, archivos, juntas, **Master Plan, Reporte ejecutivo, Gantt descargable**.
- Plantillas de master plan (CNC estándar, PMI predictivo) + scheduler con días hábiles y escalamiento sublineal por volumen.
- **Gantt interactivo** con orden por fecha, línea hasta deadline, marcador de entrega, modo *fit* y *scrollable*, y **export PDF horizontal** con colores forzados.

### 3.4 Compras
- Tracker por proyecto: 6 KPIs (Avance, Pendientes, Solicitados, En tránsito, Recibidos, Atrasadas).
- **Importador Excel**: matching por nº de parte, modo "solo actualizar producción", template descargable.
- BOM editable inline, agrupado/filtrable estilo Airtable.
- **Gráfica de análisis configurable** (ver por estatus/categoría/proveedor, métrica piezas/monto).
- **Partes en riesgo** (⚠) marcadas y listadas bajo la gráfica.
- **Eliminar BOM** con confirmación "type-to-confirm" (`ELIMINAR`).

### 3.5 Diseño
- Carga de **planos 2D (PDF) y modelos 3D** con auto-match por nº de parte.
- Thumbnails de PDFs (render lazy de la 1ª página).
- Storage segmentado (`projects/<id>/drawings|models|images/`).

### 3.6 Producción
- **Piso de fábrica**: tarjetas de máquinas con estatus (Operando/Setup/Mantenimiento/…), pieza activa, % avance y botón **Liberar**.
- **Catálogo de máquinas** con alta/edición/baja (modal).
- **Planificación**: vista por proyecto, asignación de plan (técnico + máquina + prioridad) que **genera la orden de trabajo** y marca la máquina como Operando.
- **Filtros y agrupado por técnico** (tipo Airtable).
- **Estatus de proyectos**: distribución por estatus + avance por técnico (cuántas tiene listas).
- Portal del técnico: solo puede iniciar y mandar a Calidad — **la aprobación final es exclusiva de Calidad**.

### 3.7 Calidad (ISO 9001)
- Bandeja por estatus (En calidad / Aprobada / Rechazada).
- **Reporte de inspección dimensional** con:
  - **Plano globalizado**: render del PDF, click = nueva burbuja, arrastre para reposicionar.
  - Tabla de mediciones con **Nominal + Tol± + LSL/USL** y **OK/NG automático**.
  - Tipo de característica: **Dimensión** (numérica) o **Rosca / Dowel** (calibre pasa/no pasa OK/NOK).
  - Entrada decimal con drafts (acepta coma o punto, hasta 5 decimales).
  - Tamaño de muestra ajustable, inspector, observaciones, dictamen.
  - Export a PDF con formato ISO (encabezado, plano globalizado, tabla, firmas).
- Botón "Aprobar" en la bandeja → mueve a TERMINADO (RLS exclusiva para Calidad/Admin).
- NCRs con severidad/estatus/causa raíz/acción correctiva.
- Catálogo de **instrumentos de medición** (calibración).

### 3.8 Embarques
- Packing lists, etiquetas y estados (Preparando → Listo → Tránsito → Entregado).

### 3.9 Portal del cliente
- Vía **magic link público** (sin login del ERP) por proyecto, con acceso a master plan, avance y entregables.

### 3.10 PMO
- Reportes ejecutivos para gerencia con métricas, salud y riesgos por proyecto.

### 3.11 Chat
- Canales por proyecto y por departamento; eventos del sistema se publican como mensajes.

### 3.12 Juntas + **Minutas de junta**
- Calendario de juntas (Kick-off / Semanal / Quincenal / Mensual / Hito / Cierre) generado automáticamente.
- Edición de fecha/hora, marcar realizada/cancelada.
- **Minutas con redacción asistida**: el usuario describe propósito, discusión, acuerdos, compromisos; un compositor algorítmico genera un documento **profesional y empático**.
- **Editor de texto enriquecido** (negritas, títulos, listas, alineación, **tablas e imágenes**) sobre el cuerpo generado.
- Export PDF con marca de empresa, datos de junta, cuerpo formateado y **firmas (proveedor / cliente)**.
- *Listo para conectar con LLM real* (Edge Function + Claude) cuando se requiera; el motor de redacción está aislado en `composeMinute()`.

---

## 4. Estrategias clave

### 4.1 RLS robusta y tolerante
- Funciones `is_admin / is_quality / is_production / is_purchasing` revisan tanto `role` como `department` con `ILIKE` por seguridad.
- Detección de **bloqueo silencioso** en frontend: cada hook hace `.select('id')` post-update y lanza error claro si la política rechaza ("Verifica que tu rol sea…").

### 4.2 Diseño SaaS-ready (parcial)
- Branding dinámico (logo/color/RFC) + reportes white-label.
- **Falta**: `tenant_id` en cada tabla + scopes en RLS + onboarding por organización + segregación de Storage por tenant. (Ver §6.)

### 4.3 Resiliencia y modo demo
- Cada hook tiene fallback `localStorage` (`koji_demo_*`) para que la app sea **demostrable sin Supabase**.
- Útil para presentaciones comerciales y onboarding de nuevos talleres antes de conectar su base.

### 4.4 Impresión / PDFs profesionales
- Patrón uniforme: `createPortal` al `body` + CSS `@media print` que **oculta todo** menos el documento.
- `print-color-adjust: exact` en todas las salidas para que los colores no se omitan.
- Vista horizontal apaisada para Gantt, vertical para minutas y dimensionales.

### 4.5 Scheduler de manufactura realista
- Días hábiles, holguras, escalamiento de duración sublineal por volumen (exponente 0.75).
- Cálculo hacia atrás desde la fecha de entrega para validar viabilidad.
- Recalcula y reordena al agregar/quitar tareas.

### 4.6 UX para grandes volúmenes
- BOM de **647 partes paginado** (fix de límite 1000 de Supabase JS).
- Tabla con filtros, agrupación y búsqueda configurables.
- Confirmaciones **type-to-confirm** para acciones destructivas masivas.

---

## 5. Estructura de datos (alto nivel)

| Tabla | Propósito |
|-------|-----------|
| `company_settings` | Razón social, RFC, branding |
| `profiles` | Usuarios (rol + departamento) |
| `customers`, `suppliers` | Cartera |
| `quotes`, `quote_items` | Cotizaciones |
| `projects`, `project_tasks`, `project_notes`, `project_files` | Núcleo de proyecto |
| `master_plans`, `master_plan_tasks`, `project_meetings` | Planificación PMI |
| `bom_items` | BOM extendido (compra, producción, planos, **at_risk**, **production_quantity**) |
| `requisitions`, `purchase_orders`, `purchase_order_items` | Compras |
| **`machines`** | Catálogo del piso |
| `work_orders`, `work_order_stages`, `time_entries` | Ejecución |
| `quality_inspections`, `ncrs`, `measurement_instruments` | Calidad |
| **`dimensional_reports`** | FAIR/dimensional (payload JSONB con burbujas + características) |
| `shipments`, `shipping_labels`, `shipping_label_items` | Embarque |
| `chat_channels`, `chat_messages` | Mensajería |
| `automation_events`, `audit_logs` | Trazabilidad |
| `project_meetings.minutes` (JSONB) | Minutas con `bodyHtml` enriquecido |

---

## 6. Hoja de ruta para SaaS multi-tenant + Stripe

### Fase 1 — **Multi-tenancy estricta** (1–2 semanas)
1. Tablas `tenants` y `tenant_members` (qué usuario pertenece a qué empresa).
2. `tenant_id UUID` + índice en **todas** las tablas (~25).
3. Función `current_tenant()` y reescribir **cada política RLS** para añadir `tenant_id = current_tenant()`.
4. Carpetas de Storage por tenant + RLS de Storage.
5. **Onboarding/signup** de empresa + invitación de usuarios.
6. Migrar IMC Design como `tenant 1` (CRUD masivo controlado).

### Fase 2 — **Stripe + suscripciones** (3–5 días, post-Fase 1)
- Tabla `subscriptions` (tenant_id, plan, status, current_period_end, trial_end, stripe_customer_id, stripe_subscription_id).
- Edge Functions: `create-checkout-session`, `create-billing-portal`, `stripe-webhook` (escucha `customer.subscription.*` e `invoice.*`).
- Hook `useSubscription()` → bloqueos/avisos por estado y días restantes.

### Fase 3 — **Pantallas de billing**
- **Configuración → Suscripción**: plan actual, próxima fecha de cobro, badge de estado, botones para cambiar plan / actualizar tarjeta / cancelar / historial de facturas (vía Stripe Portal).
- **Banner global**: cuando faltan ≤7 días, trial por vencer o pago fallido.
- **Pantalla bloqueante**: cuando la suscripción no está activa/trial.
- **Página pública de planes** (`/signup`): comparativa Básico/Plus/Enterprise + trial 14 días.
- **Dashboard interno (admin de la plataforma)**: MRR, churn, clientes activos.

### Fase 4 — **Marketing & ventas**
- Landing pública (Vercel) con plans, demo guiada y "Solicitar onboarding".
- Documentación: guía rápida por rol + videos cortos.

---

## 7. Pendientes y mejoras sugeridas

- 🔒 Política RLS `is_purchasing()` para UPDATE de `bom_items` (hoy reutiliza Producción/Admin).
- 🟥 **Resaltar fila roja** y contador de "X en riesgo" entre los KPIs de Compras.
- 📊 Vista de **avance de recepción** (barra apilada por categoría) en el módulo de Compras.
- 📅 **Filtros del Gantt** por departamento y por estatus.
- 🧠 **Conexión a Claude real** para la generación de minutas vía Edge Function de Supabase con `ANTHROPIC_API_KEY` secreta (motor ya aislado).
- 📤 Portal del cliente: descarga de **dimensionales aprobados** y minutas firmadas.
- 📲 PWA: ya está habilitada (`generateSW`), falta optimizar offline-first para el portal del técnico.
- 🌐 Internacionalización (es-MX por ahora; inglés sería un valor agregado para clientes maquiladores).

---

## 8. Operación y despliegue

- **Repos:** `julioronin/koji-code-erp-crm`
- **Rama de trabajo:** `claude/optimistic-johnson-ltqhs9`
- **Comandos clave:**
  - `npm run lint` → `tsc --noEmit`
  - `npm run build` → producción
- **Schema:** correr `database_schema.sql` (idempotente; usa `CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS` → no borra datos).
- **Buckets Storage:** `project-files` (privado).
- **Secrets requeridos:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. (A futuro: `STRIPE_*` y `ANTHROPIC_API_KEY` como server secrets en Edge Functions.)

---

## 9. Diferenciadores comerciales (para venta SaaS)

1. **Reporte dimensional ISO 9001 ballooned drawing** — pocos ERP de talleres lo incluyen nativo.
2. **Master Plan PMI con escalamiento por volumen** — más realista que Gantt manual o Trello.
3. **Minutas de junta asistidas, listas para firmar** — ahorra horas administrativas.
4. **Portal del cliente con magic link** — diferencial frente a competencia que exige login del cliente.
5. **Branding white-label completo** — el cliente final ve "su" plataforma, no "KANRI".
6. **Modo demo offline** — comercializar sin necesidad de conectar nada de Supabase.

---

**Última actualización:** sesión de desarrollo del 16 de junio de 2026
**Estado:** producto sólido para uso interno de IMC Design; **pendiente Fase 1 de multi-tenancy** para vender como SaaS.
