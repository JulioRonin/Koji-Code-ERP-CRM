# KANRI · Resumen para rediseño de UI

> Brief para el rediseño visual de la plataforma. Describe qué es KANRI, quién lo usa, cómo está organizada cada pantalla y qué reglas debe respetar el nuevo diseño. El detalle funcional completo está en `docs/KANRI-Informe-Detallado.md`.

---

## 1. Qué es

**KANRI** es un ERP + MES + Calidad + CRM en la nube, **multiempresa (SaaS)**, para PyMEs de manufactura en México (talleres CNC, maquinados, fabricación). Une en un solo sistema el flujo:

**Cotización → Proyecto → Diseño → Compras → Producción → Calidad → Embarque → Facturación → Cobranza → Finanzas**

- **Cliente principal:** IMC Design (taller CNC, certificado ISO 9001).
- **Marca blanca:** cada empresa sube su **logo**, elige su **color primario**, razón social y RFC. El cliente final ve la marca de la empresa; "KANRI" es la plataforma, con una firma discreta ("powered by KANRI").
- **Idioma:** español (México). Moneda MXN. Fechas tipo `15 nov 2026`.
- **Plataformas:** web responsiva + PWA instalable. Hay 3 "caras":
  1. **App interna** (sidebar + header), para oficina y supervisores.
  2. **Portal del operador / técnico** (`/technician-portal`), pantalla táctil a pie de máquina.
  3. **Portal del cliente** (`/cliente/:token`), enlace público de seguimiento del proyecto.

---

## 2. Usuarios y permisos (impactan el diseño)

| Rol | Qué ve | Notas de UI |
|---|---|---|
| **Administrador / Administración-PM** | Todo | Único rol que ve **Finanzas, Cobranza, Nómina y Configuración**. |
| **Compras** | Dashboard, Proyectos, Clientes, Cotizaciones, Inventario, Compras, Facturación, Chat | **Sí ve montos** (cotiza y genera OC). |
| **Producción / Operador** | Dashboard, Producción, Calidad, Inventario, Mantenimiento, Técnicos, Chat | **No ve montos.** |
| **Calidad** | Dashboard, Calidad, Producción, Mantenimiento, Chat | **No ve montos.** |
| **Diseñador** | Dashboard, Proyectos, Diseño, Chat | **No ve montos.** |
| **Técnico** | Solo su portal + Chat | UI táctil, botones grandes. |

**Regla clave:** las cifras de dinero (precios, costos, valor de inventario, ventas, sueldos) solo las ven los administradores y Compras. **El diseño debe funcionar con o sin columnas/KPIs de dinero** (los KPIs se reacomodan, por ejemplo una rejilla de 4 pasa a 3).

El sidebar se filtra por rol y por plan contratado. Los módulos no disponibles no se muestran.

---

## 3. Arquitectura de navegación actual

**Layout:** sidebar oscuro fijo a la izquierda (≈240 px), header blanco con buscador, contenido sobre fondo "papel".

- **Sidebar (orden actual, lista plana de 18 entradas + Configuración):** Dashboard · Clientes · Cotizaciones · Inventario · Proyectos · Diseño · Compras · Producción · Calidad · Mantenimiento · Embarques · PMO · Técnicos · Personal · Chat · Facturación · Cobranza · Finanzas · *(abajo)* Configuración.
  - Arriba: logo de la empresa + nombre + tagline.
  - En móvil es un drawer.
- **Header:** buscador global, badge "Modo demo", campana de notificaciones (con punto rojo) y avatar con nombre y rol.
- **Banner opcional** de prueba gratis ("X días · Elegir un plan").

**Oportunidad:** agrupar el sidebar por área. Propuesta:
- Comercial: Clientes, Cotizaciones
- Ingeniería: Proyectos, Diseño, PMO
- Operación: Compras, Inventario, Producción, Calidad, Mantenimiento, Embarques, Técnicos
- Administración: Personal, Facturación, Cobranza, Finanzas
- Colaboración: Chat

---

## 4. Inventario de pantallas

Cada módulo sigue el mismo esqueleto:
- **título + subtítulo + acciones primarias** (derecha);
- **fila de KPIs** (tarjetas con ícono, valor grande, sublínea y a veces sparkline);
- **barra de pestañas** tipo "segmented control";
- **filtros** (búsqueda, selects, "agrupar por");
- **tabla** (desktop) o **tarjetas** (móvil);
- **modales** para crear y editar.

| Módulo | Ruta | Pestañas | Contenido clave y acciones |
|---|---|---|---|
| **Dashboard** | `/` | — | Alertas (NCR alta, máquina parada) · 4 KPIs con sparkline (proyectos activos, piezas en producción, aprobación QA, NCR abiertas) · selector "Detalle de proyecto" · gráfica de área "Producción semanal" · dona "Pipeline por etapa" · próximas entregas. Variante **Ventas** para giros comerciales (solo roles con montos). |
| **Clientes (CRM)** | `/customers` | Directorio · Roadmap | KPIs de cartera · tabla de clientes con ventas · ficha del cliente. |
| **Cotizaciones** | `/quotes`, `/quotes/:id` | Cotizaciones · Precios de materiales | Lista con filtro y agrupación por estatus, KPIs de pipeline. **Constructor:** datos del cliente, parámetros (margen, tarifa de máquina), partidas (material + maquinado + extras), totales, **fotos anexas (máx. 5)**, Documento PDF (portada, cotización, términos, anexo fotográfico), enviar por correo, convertir a proyecto. |
| **Inventario** | `/inventory` | — | KPIs (SKU, valor*, bajo mínimo, agotados) · tabla con semáforo de stock y resurtido · movimientos entrada/salida/ajuste · importar Excel. |
| **Proyectos** | `/projects`, `/projects/:id` | (detalle) Plan de control · Acciones correctivas · No conformidades | Lista con búsqueda, filtros por estado y cliente, agrupación, barra de progreso y fecha de entrega. **Detalle:** BOM, archivos y planos, juntas/minutas, Gantt (Master Plan), galería de imágenes para el cliente, reporte de proyecto, calidad del proyecto. |
| **Diseño** | `/design` | Tareas · Planos 2D/3D · Checklist fab. | Tablero de tareas de ingeniería y planos por pieza. |
| **Compras** | `/purchasing` | Por proyecto · Requisiciones · BOM / Listas · Órdenes de compra · Proveedores | KPIs de avance de compras (pendientes, solicitados, en tránsito, atrasadas) · seguimiento por proyecto · OC con recepción a inventario · CRM de proveedores con gasto. |
| **Producción** | `/production`, `/production/wo/:id` | Piso de fábrica · Planificación · Estatus de proyectos | Tarjetas de máquina (estado por color, OT activa, progreso, próximo preventivo) · KPI "producción real" · gráficas · detalle de la orden de trabajo por etapas. |
| **Calidad** | `/quality` | Control por proyecto · Historial inspecciones · No conformidades · Acciones correctivas · Instrumentos | Inspecciones (primera pieza, en proceso, final), reporte dimensional, NCR con flujo B2–B6 (PR-CAL-001 §8), CAPA multiárea, calibración de instrumentos. |
| **Mantenimiento** | `/maintenance` | Tablero · Equipos y plan · Órdenes · Checklist diario | KPIs (cumplimiento, vencidos, órdenes abiertas, paros, MTTR) · plan por equipo · órdenes preventivas y correctivas con LOTO · checklist de arranque FR-MTO-001. |
| **Embarques** | `/shipping` | — | Embarques por proyecto, cajas con etiqueta QR imprimible, estatus y paquetería. |
| **PMO** | `/pmo` | — | Reportes de proyecto por mes (gráficas), portafolio. |
| **Técnicos** | `/technicians` | — | Coordinación de técnicos y carga por persona. |
| **Personal** | `/personnel` | Directorio · Roles y facultades · Checador · Nómina* | Perfiles, permisos por usuario, asistencia, nómina (solo admin). |
| **Chat** | `/chat` | — | Canales por departamento y proyecto; mensajes del sistema (alertas automáticas). |
| **Facturación** | `/billing` | — | CFDI 4.0 (Facturapi). |
| **Cobranza** | `/cobranza` | — | Cuentas por cobrar, anticipos/abonos, semáforo de vencimiento. |
| **Finanzas** | `/finance` | Resumen (P&L) · Rentabilidad por proyecto | P&L por periodo, ingresos vs. egresos (barras), egresos por categoría, rentabilidad por proyecto. |
| **Configuración** | `/settings` | — | Identidad (logo por archivo, color), datos fiscales, domicilio, banco, términos de cotización, modo de tablero e inventario. |
| **Portal operador** | `/technician-portal` | — | Turno actual, KPIs de piezas (asignadas, pendientes, en proceso, terminadas), buscar pieza, **Reportar incidencia**, **Checklist de arranque**, iniciar/terminar pieza, chat de la pieza. |
| **Portal cliente** | `/cliente/:token` | — | Marca de la empresa, avance, hitos del proyecto, inspecciones aprobadas, galería de imágenes, archivos visibles. **Sin montos.** |
| **Públicas** | `/welcome`, `/login`, `/pricing`, `/onboarding` | — | Landing, login, planes (Básico / Profesional / Enterprise) y alta de empresa por giro. |

\* Solo roles con montos.

**Documentos imprimibles** (no son pantallas, pero son parte de la marca):
- cotización de 3–4 hojas;
- reporte de proyecto;
- reporte dimensional;
- minuta;
- Gantt;
- etiqueta de caja con QR;
- registros de mantenimiento y NCR.

Todos usan el logo y el color de la empresa, y deben verse bien en carta (Letter).

---

## 5. Sistema visual actual (tokens en `src/index.css`)

| Token | Valor | Uso |
|---|---|---|
| Ink | `#16181D` | Texto principal, sidebar |
| Bermellón (primario) | `#E2401F` (hover `#C2330F`, soft `#FBE7E0`) | Botón primario, activo, acentos. *La empresa puede sobrescribir el color primario.* |
| Steel | `#8A9099` | Texto terciario |
| Paper (fondo) | `#F7F5F0` | Fondo de página |
| Surface / alt | `#FFFFFF` / `#EFECE5` | Tarjetas / headers de tabla, pestañas |
| Bordes | `#E6E2DA` / `#D3CFC6` | Normal / fuerte |
| Estados | success `#15803D`, warning `#B45309`, danger `#B91C1C`, info `#1D4ED8` (+ variantes *soft*) | Badges y semáforos |

- **Tipografía:**
  - Inter (UI);
  - Poppins (display: títulos y marca);
  - JetBrains Mono (IDs como `IMC-2026-042`, folios y cifras tabulares).
- **Componentes base:** shadcn/ui sobre Radix: Button, Input, Select, Dialog, Dropdown, Badge, Card, Table, Progress, Combobox y Popover.
- **Gráficas:** Recharts (área, barras, dona y sparklines).
- **Íconos:** Lucide.
- **Stack:** React 19 + Vite + Tailwind CSS v4 + Supabase.

**Semáforos y estados** (deben conservar significado de color):

| Concepto | Estados |
|---|---|
| Proyecto | Cotización (ámbar), Diseño/Compras (gris), En Producción (azul), Calidad/Embarque (verde), Entregado |
| Máquina | Operando (verde), Setup (ámbar), Mantenimiento/Fuera de servicio (rojo), Disponible (gris) |
| Stock | Agotado (rojo), Bajo mínimo (ámbar), OK (verde), Sobre máximo (gris) |
| NCR | Alta (rojo), Media (ámbar), Baja (gris) |
| Cobranza | Vencido (rojo), Parcial (ámbar), Liquidado (verde) |
| Preventivo | Vencido (rojo), Próximo ≤7 días (ámbar), Al día (verde) |

---

## 6. Requisitos y restricciones para el nuevo diseño

1. **Marca blanca real.** El color primario y el logo vienen de la empresa. Hay que diseñar con un color de acento variable que se vea bien en cualquier tono y con logos cuadrados o rectangulares.
2. **Densidad de datos.** Son tablas largas (BOM de cientos de piezas, inventario). Hacen falta tablas compactas, encabezados fijos, columnas numéricas tabulares y alineadas a la derecha, y vistas de tarjeta en móvil.
3. **Montos condicionales.** Los KPIs y columnas de dinero desaparecen según el rol; los layouts no deben quedar con huecos.
4. **Piso de fábrica.** El portal del operador se usa con guantes o en tableta: objetivos táctiles de ≥44 px, alto contraste y acciones críticas (Reportar incidencia, Checklist) muy visibles.
5. **Impresión.** Los documentos (cotización, reportes, etiquetas) se imprimen o guardan en PDF. Necesitan una versión clara, sobria y con la marca de la empresa.
6. **Español largo.** Los textos en español son ~25 % más largos que en inglés (p. ej. "Acciones correctivas", "Historial inspecciones"). Las pestañas deben poder desplazarse o colapsar.
7. **Estados vacíos, de carga y de error.** Todas las listas tienen estado vacío con mensaje y acción. Ya existe una pantalla de error ("Algo salió mal en esta pantalla") con Reintentar/Recargar.
8. **Accesibilidad.** Las pestañas actuales son botones sin `role="tab"`; conviene un componente Tabs accesible. Contraste AA en badges *soft*.
9. **Responsivo.** Ya no hay scroll horizontal en móvil (verificado a 390 px). El sidebar pasa a drawer.

---

## 7. Oportunidades detectadas para el rediseño

- **Sidebar:** agrupar por área (ver §3), con secciones colapsables y "favoritos/recientes". 18 entradas planas es mucho.
- **Header:** el buscador global podría ser una *command palette* (⌘K): buscar proyecto, pieza, OC o cliente.
- **KPIs:** unificar el componente (hoy hay variantes con y sin sparkline, distintos tamaños de valor).
- **Pestañas:** un solo componente Tabs (hoy cada módulo tiene su propia copia).
- **Tablas:** un componente único con filtros, agrupación y paginación (hoy varía por módulo).
- **Detalle de proyecto:** es la pantalla más cargada (BOM, archivos, Gantt, calidad, juntas, imágenes). Necesita jerarquía clara: resumen arriba y secciones con navegación lateral o pestañas.
- **Tipografía:** convivir con 3 familias. Evaluar reducir a Inter + mono, o definir bien cuándo usar Poppins.
- **Tokens heredados:** existen alias `cyber-*`, `erp-*` y `neon-*` de una versión anterior. El rediseño puede limpiarlos.
- **Portal del cliente:** es la cara externa; merece un trato más "premium" (hero con avance, línea de tiempo de hitos, galería).

---

## 8. Entregables sugeridos para Claude Design

1. Sistema de diseño: tokens (color con acento variable, tipografía, espaciado, radios, sombras) y componentes (Button, Input, Select, Tabs, Badge/semáforo, KPI card, Table, Modal, Empty state, Toast).
2. Shell: sidebar agrupado + header + drawer móvil.
3. Pantallas clave:
   - Dashboard;
   - lista y detalle de Proyecto;
   - Constructor de cotización;
   - Producción (piso de fábrica);
   - Calidad (NCR);
   - Mantenimiento;
   - Portal del operador;
   - Portal del cliente.
4. Plantilla de documento imprimible (cotización) con la marca de la empresa.
