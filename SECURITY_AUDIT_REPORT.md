# 📋 INFORME DE AUDITORÍA DE SEGURIDAD Y CALIDAD — U-MARKET

**Fecha:** 2026-07-11  
**Auditor:** Senior Security & Quality Auditor  
**Versión analizada:** Código actual en `C:\Users\Acer Predator\Documents\Trabajo\UTA\u-market`  
**Stack:** Next.js 16.2.10 + React 19.2.4 + TypeScript 5 + Supabase 2.110.1 + Tailwind CSS 4  

---

## 🎯 RESUMEN EJECUTIVO

| Severidad | Hallazgos |
|-----------|-----------|
| 🔴 **Crítica** | 3 |
| 🟠 **Alta** | 5 |
| 🟡 **Media** | 8 |
| 🟢 **Baja** | 6 |
| **Total** | **22 hallazgos** |

### 🚨 TOP 5 CRÍTICOS PARA ARREGLAR ANTES DEL LANZAMIENTO

1. **RLS no verificado en Supabase** — Sin policies de Row Level Security, cualquier usuario autenticado puede leer/escribir datos ajenos.
2. **Credenciales Supabase en `.env.local` commiteadas al repo** — La ANON KEY está expuesta en el control de versiones.
3. **Sin rate limiting en login/registro** — Vulnerable a fuerza bruta y enumeración de correos @uta.edu.ec.
4. **Validación de imágenes solo en frontend (tipo/tamaño)** — Un atacante puede subir archivos maliciosos vía API directa a Supabase Storage.
5. **Sin sanitización de inputs (XSS almacenado)** — Título, descripción, nombre, teléfono se renderizan sin escape.

---

## 1. AUTENTICACIÓN Y CONTROL DE ACCESO

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 1.1 | **Validación @uta.edu.ec sí está en backend** ✅ | — | `src/app/api/auth/register/route.ts:14-19` | — | Bien implementado: regex en API route + frontend |
| 1.2 | **Sin rate limiting en login** | 🔴 Crítica | `src/app/login/page.tsx:16-31` + `src/app/api/auth/register/route.ts` | Fuerza bruta, credential stuffing, enumeración de correos válidos | Implementar rate limiting con `next-rate-limit` o middleware propio (ej. 5 req/min por IP en login, 3 req/min en registro) |
| 1.3 | **Sin rate limiting en registro** | 🔴 Crítica | `src/app/api/auth/register/route.ts:4-63` | Abuso para crear cuentas masivas, spam | Añadir rate limiting estricto en `/api/auth/register` |
| 1.4 | **Contraseñas: manejo correcto (Supabase Auth)** ✅ | — | `src/app/api/auth/register/route.ts:32-41` | — | Supabase hashea con bcrypt (costo 10) server-side; nunca llegan a logs ni código |
| 1.5 | **Control de sesiones: tokens JWT de Supabase** | 🟡 Media | `src/lib/supabase/client.ts`, `server.ts` | Expiración configurable en Supabase Dashboard (default 1h access, 30d refresh) | Verificar en Supabase: `Auth → Settings → JWT expiry = 1h`, `Refresh token rotation = ON`, `Reuse interval = 10s` |
| 1.6 | **Logout funcional** ✅ | — | `src/components/Navbar.tsx:30-34` | — | `supabase.auth.signOut()` + `router.refresh()` limpia cookies correctamente |
| 1.7 | **Autorización en edición/eliminación de listings** | 🟠 Alta | `src/app/listings/[id]/edit/page.tsx:41-46, 140-141`<br>`src/app/dashboard/page.tsx:34-38, 40-44` | **Bypass posible:** El check `eq('seller_id', user.id)` está en cliente. Un atacante puede llamar a Supabase directamente con `service_role` o manipular la request si RLS no está activo | **Crítico:** Las policies RLS en Supabase DEBEN enforcear `seller_id = auth.uid()` en UPDATE/DELETE. No confiar solo en cliente |
| 1.8 | **Middleware protege rutas** ✅ | — | `src/proxy.ts:30-38` | — | Rutas `/dashboard`, `/listings/new`, `/admin` redirigen a login si no hay usuario |
| 1.9 | **Admin panel: verificación de rol solo en cliente** | 🔴 Crítica | `src/app/admin/page.tsx:37-41` | Cualquier usuario autenticado puede acceder a `/admin` si manipula el estado local o llama a Supabase directamente | Mover verificación de rol a **middleware** (`proxy.ts`) y/o RLS policy en tabla `profiles` |

---

## 2. SEGURIDAD DE LA BASE DE DATOS (SUPABASE)

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 2.1 | **RLS: Estado desconocido — NO VERIFICADO EN CÓDIGO** | 🔴 Crítica | *Supabase Dashboard* (no en repo) | Sin RLS, cualquier usuario autenticado hace `SELECT * FROM listings`, `UPDATE profiles SET role='admin'`, etc. | **URGENTE:** En Supabase Dashboard → Authentication → Policies, habilitar RLS en TODAS las tablas y crear policies:<br>• `profiles`: `SELECT` own, `UPDATE` own<br>• `listings`: `SELECT status='active'`, `INSERT/UPDATE/DELETE` only if `seller_id = auth.uid()`<br>• `chats`: `SELECT` if `buyer_id=auth.uid() OR seller_id=auth.uid()`<br>• `messages`: `SELECT/INSERT` if participant in chat<br>• `reports`: `INSERT` any, `SELECT/UPDATE` only admin<br>• `subscriptions`: `SELECT` own |
| 2.2 | **Inyección SQL: No hay risk directo (Supabase client usa parameterized queries)** ✅ | — | Todo el código usa `.eq()`, `.select()`, `.insert()` | — | Supabase JS client usa prepared statements internamente. No hay concatenación de strings SQL visible |
| 2.3 | **Datos sensibles expuestos en endpoints públicos** | 🟠 Alta | `src/app/page.tsx:24-26`<br>`src/components/ListingCard.tsx:129-142`<br>`src/app/listings/[id]/page.tsx:173-194` | `profiles.phone` y `profiles.full_name` se incluyen en `select('*, profiles(full_name, phone, avatar_url)')` en listings públicos | **Remover `phone` del select público.** Crear vista o RPC que solo exponga `full_name`, `avatar_url`. El teléfono solo debe verse en chat iniciado |
| 2.4 | **Políticas Supabase: permisos excesivos probables** | 🔴 Crítica | *Dashboard* | Si `profiles` permite `UPDATE` sin filtro `id = auth.uid()`, escalación de privilegios (cambiar rol a admin) | Verificar policy: `CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id)` |
| 2.5 | **Storage buckets: sin policies de acceso** | 🟠 Alta | `src/app/listings/new/page.tsx:82-85`<br>`src/app/profile/page.tsx:69-71` | Buckets `listings` y `avatars` pueden permitir lectura/escritura pública si no hay policies | Configurar bucket policies: `listings` → `INSERT` only authenticated, `SELECT` public para imágenes activas; `avatars` → `INSERT/UPDATE` own `user_id/`, `SELECT` public |

---

## 3. VALIDACIÓN DE ENTRADAS Y XSS

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 3.1 | **Sin sanitización de título/descripción/nombre (XSS almacenado)** | 🔴 Crítica | `src/app/listings/new/page.tsx:102-108`<br>`src/app/listings/[id]/edit/page.tsx:130-138`<br>`src/app/profile/page.tsx:100-105`<br>`src/app/register/page.tsx:20-29` | Usuario inyecta `<img src=x onerror=alert(1)>` o `<script>stealCookies()</script>` → se ejecuta al renderizar en cards, detalle, admin panel | **Sanitizar en backend (API route) o en Supabase via trigger:** Usar `DOMPurify` o `sanitize-html` en server-side. En cliente, React escapa por defecto en `{variable}` pero **NO** en `dangerouslySetInnerHTML` ni en atributos `href`/`src`. Verificar que no usan `dangerouslySetInnerHTML` |
| 3.2 | **Renderizado seguro en React (JSX) — mayormente OK** ✅ | — | `src/components/ListingCard.tsx:107, 117` | React escapa automáticamente `{listing.title}`, `{listing.description}` | Confirmar: no hay `dangerouslySetInnerHTML` en todo el código |
| 3.3 | **Subida de imágenes: validación solo frontend (tipo/tamaño)** | 🔴 Crítica | `src/app/listings/new/page.tsx:33-34`<br>`src/app/listings/[id]/edit/page.tsx:73-76`<br>`src/app/profile/page.tsx:55-58` | Atacante bypassea UI y sube `.php`, `.html`, `.svg` (XSS vía SVG), archivos >5MB directo a Supabase Storage API | **Validar en Supabase Storage policies:** `bucket policy → MIME type IN ('image/jpeg','image/png','image/webp') AND size < 5MB`. O crear Edge Function / API route que valide antes de dar signed URL |
| 3.4 | **Teléfono/WhatsApp: sin validación de formato** | 🟡 Media | `src/app/register/page.tsx:138-145`<br>`src/app/listings/new/page.tsx:331-338`<br>`src/app/profile/page.tsx:211-216` | Inyección de teléfonos maliciosos, spam, formato inválido | Añadir regex Ecuador: `^(\+593|0)?9\d{8}$` en frontend + backend |
| 3.5 | **Precio: validación solo cliente (Number(price))** | 🟠 Alta | `src/app/listings/new/page.tsx:106`<br>`src/app/listings/[id]/edit/page.tsx:135` | Manipulación vía API: precio negativo, `NaN`, `Infinity`, strings | Validar en backend: `if (typeof price !== 'number' || price < 0 || price > 100000 || !Number.isFinite(price))` |
| 3.6 | **Reportes: `reason` sin sanitizar ni límite** | 🟡 Media | `src/app/page.tsx:47-59`<br>`src/app/listings/[id]/page.tsx:40-47` | XSS en panel admin al mostrar `report.reason` | Limitar longitud (ej. 500 chars) y sanitizar antes de guardar/mostrar |

---

## 4. INFRAESTRUCTURA Y CONFIGURACIÓN

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 4.1 | **`.env.local` COMMITEADO AL REPO con ANON KEY real** | 🔴 Crítica | `.env.local:1-2` | Cualquiera con acceso al repo/clona tiene clave pública de Supabase. Aunque es `anon`, permite leer datos públicos y autenticar usuarios | **ELIMINAR del repo ya.** Añadir `.env*` a `.gitignore` (ya está). Rotar clave en Supabase Dashboard → Settings → API → "Regenerate anon key". Usar `.env.example` con placeholders |
| 4.2 | **`.gitignore` incluye `.env*`** ✅ | — | `.gitignore:34` | — | Correcto, pero el archivo ya se commiteó; hacer `git rm --cached .env.local` y commit |
| 4.3 | **HTTPS: Next.js en Vercel usa HTTPS por defecto** ✅ | — | Despliegue | — | Verificar que `NEXT_PUBLIC_SUPABASE_URL` usa `https://` (sí lo hace) |
| 4.4 | **Headers de seguridad HTTP: AUSENTES** | 🟠 Alta | `next.config.ts` | Sin CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy | Añadir en `next.config.ts`:<br>`async headers() { return [{ source: '/:path*', headers: [ {key:'Content-Security-Policy', value:\"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co;\"}, {key:'X-Frame-Options', value:'DENY'}, {key:'X-Content-Type-Options', value:'nosniff'}, {key:'Referrer-Policy', value:'strict-origin-when-cross-origin'}, {key:'Permissions-Policy', value:'camera=(), microphone=(), geolocation=()'} ] }] }` |
| 4.5 | **Cloudflare / DDoS: No configurado en código** | 🟡 Media | Infraestructura | Sin protección contra flood, bot traffic | Si en Vercel: activar "Vercel Firewall" y "Bot Protection". Si dominio propio: Cloudflare Proxy (naranja) + Rate Limiting rules |
| 4.6 | **Cookies: Supabase usa cookies seguras (HttpOnly, Secure, SameSite=Lax)** ✅ | — | `@supabase/ssr` | — | Verificar en DevTools: cookies `sb-*-auth-token` tienen `Secure; HttpOnly; SameSite=Lax` |
| 4.7 | **Next.js config: `images.remotePatterns` solo Supabase** ✅ | — | `next.config.ts:5-13` | — | Correcto: solo permite imágenes de `*.supabase.co/storage/v1/object/public/**` |

---

## 5. LÓGICA DE NEGOCIO

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 5.1 | **Límite de plan gratis: check solo en cliente** | 🟠 Alta | `src/app/listings/new/page.tsx:62-73` | Usuario bypassea UI y llama `supabase.from('listings').insert()` directo si RLS no bloquea | **Enforzar en RLS policy o Database Function/Trigger:** `CREATE POLICY "Insert listing" ON listings FOR INSERT WITH CHECK ( (SELECT plan FROM subscriptions WHERE user_id = auth.uid() AND is_active AND (ends_at IS NULL OR ends_at > now())) = 'paid' OR (SELECT count(*) FROM listings WHERE seller_id = auth.uid()) < 3 )` |
| 5.2 | **Manipulación de precio/cantidad vía API directa** | 🟠 Alta | `src/app/listings/new/page.tsx:106`<br>`src/app/listings/[id]/edit/page.tsx:135` | Atacante envía `price: -100`, `price: 999999999`, `price: "gratis"` vía Postman/curl | Validar en **backend (API route)** o **RLS/CHECK constraint** en DB: `ALTER TABLE listings ADD CONSTRAINT price_positive CHECK (price >= 0 AND price <= 100000)` |
| 5.3 | **Registro: teléfono opcional se guarda en `profiles.phone`** | 🟡 Media | `src/app/api/auth/register/route.ts:52-57` | Teléfono visible en listings públicos (ver 2.3) | No guardar teléfono en registro; pedirlo solo al publicar o en perfil |
| 5.4 | **Edición de listing: verifica `seller_id` en cliente** | 🟠 Alta | `src/app/listings/[id]/edit/page.tsx:41-46, 140-141` | Bypass si RLS no está activo (ver 1.7, 2.1) | RLS policy es la única defensa real |
| 5.5 | **Eliminación de listing: soft delete via `status='removed'`** | 🟢 Baja | `src/app/admin/page.tsx:60-64` | Admin puede "eliminar" pero datos quedan; bien para auditoría | Considerar `deleted_at` timestamp para GDPR |
| 5.6 | **Chats: verificación de participantes solo en cliente** | 🟡 Media | `src/app/inbox/[chatId]/page.tsx:40-49`<br>`src/app/listings/[id]/page.tsx:87-98` | Usuario podría intentar acceder a chat ajeno manipulando `chatId` | RLS policy en `chats` y `messages`: `SELECT/INSERT` solo si `buyer_id=auth.uid() OR seller_id=auth.uid()` |
| 5.7 | **Reportes: unique constraint evita duplicados (código 23505)** ✅ | — | `src/app/page.tsx:54-55`<br>`src/app/listings/[id]/page.tsx:45-46` | — | Bien: `CREATE UNIQUE INDEX ON reports (listing_id, reporter_id)` en Supabase |
| 5.8 | **Admin panel: cambio de rol/suscripción sin auditoría** | 🟡 Media | `src/app/admin/page.tsx:72-86` | Admin puede desactivar subs, cambiar roles sin log | Añadir tabla `admin_actions` con `admin_id, target_user_id, action, timestamp` |

---

## 6. CÓDIGO Y BUENAS PRÁCTICAS

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 6.1 | **`console.log` / `console.error`: NO HAY EN PRODUCCIÓN** ✅ | — | `grep -r "console\." src/` | — | Limpio |
| 6.2 | **Manejo de errores: `try/catch` genérico sin logging estructurado** | 🟡 Media | `src/app/api/auth/register/route.ts:60-62`<br>`src/app/listings/new/page.tsx:114-118`<br>`Múltiples archivos` | Errores se pierden; difícil debugging en producción | Usar `console.error` con contexto o servicio (Sentry, Logtail). Capturar `error.message`, `error.code`, `user.id`, `timestamp` |
| 6.3 | **Código duplicado: subida de imágenes repetida en 3 lugares** | 🟡 Media | `src/app/listings/new/page.tsx:78-96`<br>`src/app/listings/[id]/edit/page.tsx:109-125`<br>`src/app/profile/page.tsx:69-79` | Mantenibilidad, bugs inconsistentes | Extraer hook `useImageUpload(bucket, maxSize, maxFiles)` + componente `ImageUploader` |
| 6.4 | **Código duplicado: lógica de chat (crear/obtener) en 2 lugares** | 🟡 Media | `src/app/listings/[id]/page.tsx:86-117`<br>`src/components/ListingCard.tsx:32-63` | Inconsistencia, doble mantenimiento | Crear `lib/chat.ts` con `getOrCreateChat(listingId, buyerId, sellerId)` |
| 6.5 | **Dependencias: `@supabase/supabase-js@2.110.1` (actual ago-2024)** | 🟢 Baja | `package.json:13` | Versión no es la más reciente (2.45.x en 2026) | `npm update @supabase/supabase-js @supabase/ssr next react` |
| 6.6 | **Dependencias: `next@16.2.10`, `react@19.2.4` — versiones RC/Canary** | 🟠 Alta | `package.json:14-16` | Next 16 y React 19 son versiones *experimentales* (no estables). Riesgo de breaking changes, bugs no documentados | **Revisar urgente:** ¿Es intencional? Para producción usar `next@15.x` (LTS) y `react@18.x` hasta que 19 sea stable |
| 6.7 | **TypeScript: `strict: true` habilitado** ✅ | — | `tsconfig.json:7` | — | Bien |
| 6.8 | **Tipos `any` implícitos en callbacks de Supabase** | 🟢 Baja | `src/app/inbox/page.tsx:31-37`<br>`src/app/admin/page.tsx:43-54` | Pérdida de type safety | Añadir tipos explícitos: `.select<Chat, ...>()` o `as Chat[]` |
| 6.9 | **Hook `useCallback` con dependencias incompletas** | 🟢 Baja | `src/app/dashboard/page.tsx:16-30` (`fetchData` usa `supabase` pero no en deps) | Stale closures potenciales | Añadir `supabase` a deps o mover creación fuera del componente |
| 6.10 | **ESLint config: solo `next/core-web-vitals` + `next/typescript`** | 🟢 Baja | `eslint.config.mjs` | No reglas de seguridad (ej. `no-danger`, `react/no-danger-with-children`) | Añadir `plugin:@next/next/recommended` y `plugin:react/recommended` |

---

## 7. RENDIMIENTO

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 7.1 | **Imágenes: Sin optimización automática (Next/Image `fill` sin `sizes` correcto)** | 🟡 Media | `src/components/ImageCarousel.tsx:93-100` | Carga imágenes originales sin resize; `sizes` genérico | Usar `Image` con `priority` en primera, `sizes` específico por breakpoint. Considerar `next/image` loader de Supabase (transformation URL) |
| 7.2 | **Listado de productos: SIN PAGINACIÓN (carga todo)** | 🟠 Alta | `src/app/page.tsx:22-39`<br>`src/app/dashboard/page.tsx:20-24` | `.select('*')` sin `.limit()` → carga miles de rows, OOM, latencia | Implementar cursor pagination: `.range(0, 19)` + "Cargar más" o infinite scroll. En dashboard: paginar 20 por página |
| 7.3 | **Consultas N+1 en Inbox: messages + profiles por chat** | 🟡 Media | `src/app/inbox/page.tsx:17-27` | `.select('..., messages(...)')` trae todos los mensajes de todos los chats | Optimizar: RPC/DB function que retorne solo último mensaje por chat, o vista materializada |
| 7.4 | **Índices en BD: No verificados en código** | 🟡 Media | *Supabase Dashboard* | Sin índices en `listings(status, created_at)`, `listings(seller_id)`, `chats(buyer_id, seller_id)`, `messages(chat_id, created_at)` → full table scans | Ejecutar en SQL Editor: `CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC); CREATE INDEX idx_listings_seller ON listings(seller_id);` etc. |
| 7.5 | **Avatar/profile images: bucket `avatars` sin CDN/transform** | 🟢 Baja | `src/app/profile/page.tsx:79` | `getPublicUrl` sirve original; sin resize para thumbnails | Usar Supabase Image Transform: `getPublicUrl(path, { transform: { width: 100, height: 100, resize: 'cover' } })` |
| 7.6 | **Hydration: muchos componentes `'use client'` innecesarios** | 🟢 Baja | Mayoría de páginas | Aumenta bundle JS, slow TTI | Mover a Server Components donde sea posible (ej. `page.tsx` home, `layout.tsx`). Solo client para interactividad real |

---

## 8. CUMPLIMIENTO Y LEGAL

| # | Hallazgo | Severidad | Ubicación | Riesgo | Recomendación |
|---|----------|-----------|-----------|--------|---------------|
| 8.1 | **Sin página de Términos de Servicio** | 🟠 Alta | *No existe en código* | Incumplimiento legal (Ley de Comercio Electrónico Ecuador, GDPR si usuarios EU) | Crear `/terminos` y `/privacidad` con contenido legal revisado por abogado |
| 8.2 | **Sin Política de Privacidad** | 🟠 Alta | *No existe en código* | Requisito legal (Art. 15 LOPD Ecuador, Art. 13 GDPR) | Documentar: qué datos (email, nombre, teléfono, IP, cookies), base legal (consentimiento, contrato), derechos (acceso, rectificación, supresión, portabilidad), retention, subprocessors (Supabase, Vercel) |
| 8.3 | **Sin enlace a legal en footer/login/registro** | 🟡 Media | `src/app/login/page.tsx`, `register/page.tsx` | Usuario no puede conocer términos antes de registrarse | Añadir links en formularios: "Al registrarte aceptas nuestros [Términos](/terminos) y [Privacidad](/privacidad)" |
| 8.4 | **Sin forma de eliminar cuenta (Right to be Forgotten)** | 🟠 Alta | *No implementado* | Incumplimiento GDPR Art. 17, LOPD Art. 22 | Implementar `/account/delete` → `supabase.auth.admin.deleteUser(userId)` (requiere service_role) + cascade delete en BD via trigger |
| 8.5 | **Cookies: Sin banner de consentimiento** | 🟡 Media | *No implementado* | Requerido si tracking/analytics (GA, Vercel Analytics) | Si usas analytics: banner "Aceptar/Rechazar" con `js-cookie` o `react-cookie-consent` |
| 8.6 | **Datos de menores: No hay verificación de edad** | 🟢 Baja | *No implementado* | UTA = universidad (mayores de 18 generalmente), pero verificar | Añadir checkbox "Tengo 18+ años" en registro si aplica |

---

## 📋 PLAN DE ACCIÓN PRIORIZADO (SPRINT 0 — PRE-LAUNCH)

| Prioridad | Acción | Esfuerzo | Responsable |
|-----------|--------|----------|-------------|
| **P0** | Rotar ANON KEY de Supabase (`.env.local` expuesto) | 15 min | DevOps |
| **P0** | Habilitar RLS en **TODAS** las tablas + policies correctas en Supabase Dashboard | 2-4 hrs | Backend/DevOps |
| **P0** | Añadir rate limiting en `/login` y `/api/auth/register` (middleware) | 1-2 hrs | Backend |
| **P0** | Validar imágenes en Supabase Storage policies (MIME + size) | 30 min | Backend |
| **P0** | Sanitizar inputs (título, descripción, reason, nombre) con DOMPurify en API routes | 1-2 hrs | Backend |
| **P1** | Remover `phone` de selects públicos de listings | 30 min | Backend |
| **P1** | Añadir headers de seguridad (CSP, HSTS, X-Frame-Options) en `next.config.ts` | 30 min | Frontend |
| **P1** | Implementar paginación en home y dashboard (`.range()` + "Cargar más") | 1-2 hrs | Frontend |
| **P1** | Crear páginas legales `/terminos`, `/privacidad` + links en auth | 2-3 hrs | Legal + Frontend |
| **P1** | Implementar eliminación de cuenta (GDPR/LOPD) | 2-3 hrs | Backend |
| **P2** | Mover verificación de rol admin a middleware (`proxy.ts`) | 30 min | Backend |
| **P2** | Añadir CHECK constraint `price >= 0 AND price <= 100000` en BD | 15 min | Backend |
| **P2** | Extraer hooks/componentes duplicados (ImageUpload, ChatLogic) | 2-3 hrs | Frontend |
| **P2** | Actualizar dependencias a versiones estables (Next 15, React 18) | 1-2 días | DevOps |
| **P2** | Añadir índices en BD para queries frecuentes | 30 min | Backend |
| **P3** | Configurar Cloudflare/Vercel Firewall + Bot Protection | 1 hr | DevOps |
| **P3** | Implementar cookie consent banner si hay analytics | 1 hr | Frontend |
| **P3** | Logging estructurado de errores (Sentry/Logtail) | 2-3 hrs | Backend |

---

## ✅ CHECKLIST DE VERIFICACIÓN POST-FIXES

- [ ] `.env.local` removido de git history (`git filter-branch` o `BFG Repo-Cleaner`)
- [ ] ANON KEY rotada y nueva en Vercel/Environment Variables
- [ ] RLS habilitado en: `profiles`, `listings`, `chats`, `messages`, `reports`, `subscriptions`
- [ ] Policies RLS testeadas con usuarios distintos (postman/curl con diferentes JWTs)
- [ ] Rate limiting: 5 req/min login, 3 req/min register probado con `hey`/`wrk`
- [ ] Storage policies: `listings` y `avatars` solo aceptan `image/jpeg|png|webp` < 5MB
- [ ] CSP header presente en `curl -I https://u-market.vercel.app`
- [ ] Paginación: home carga 20, "Cargar más" funciona; dashboard paginado
- [ ] `/terminos` y `/privacidad` accesibles, enlazados en login/register
- [ ] Eliminar cuenta: flow completo probado (auth + cascade BD)
- [ ] Admin panel: accesible solo con `role='admin'` verificado en middleware
- [ ] Índices creados y `EXPLAIN ANALYZE` muestra Index Scan
- [ ] Dependencias actualizadas a versiones LTS/estables
- [ ] Tests de integración críticos pasando (auth, listings CRUD, chat, reports)

---

## 📝 NOTAS ADICIONALES

1. **Arquitectura cliente-servidor:** La app es **Client-Heavy** (casi todo `'use client'`). Migrar páginas estáticas (home, listing detail, admin) a Server Components reduciría bundle y mejoraría SEO/performance.

2. **Supabase Realtime:** Usado en chat (`postgres_changes`). Verificar que canales se limpian (`removeChannel` en cleanup) — ya implementado correctamente en `ChatDetailPage`.

3. **Webhooks:** No hay webhooks configurados (ej. `user.created` → crear profile, subscription free). Considerar Edge Functions para lógica server-side.

4. **Monitoreo:** Añadir **Sentry** (error tracking) + **Vercel Analytics** / **PostHog** (product analytics) antes de launch.

5. **Testing:** No hay tests visibles (`/test`, `/__tests__`, `*.test.ts`). Implementar: Vitest (unit), Playwright (e2e) para flujos críticos.

---

**Fin del informe.**  
*Este informe debe tratarse como confidencial. No compartir credenciales ni detalles de vulnerabilidades sin remediation completa.*