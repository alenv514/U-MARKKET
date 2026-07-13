# CHECKLIST DE REMEDIACIÓN - U-MARKET

## SPRINT 0 - CRÍTICO (Bloqueante para lanzamiento)

### 0.1 Credenciales expuestas
- [ ] Rotar ANON KEY en Supabase Dashboard → Settings → API → "Regenerate anon key"
- [ ] Actualizar `.env.local` con nueva key
- [ ] Eliminar `.env.local` del historial Git: `git rm --cached .env.local && git commit -m "chore: remove env file from history"`
- [ ] Verificar que nueva key funciona en local

### 0.2 RLS Policies - Fixes críticos (SQL para ejecutar en Supabase)
- [ ] **profiles**: Restringir SELECT para no exponer `phone` (solo own profile o campos públicos)
- [ ] **storage.objects**: Añadir validación MIME type (`image/jpeg, image/png, image/webp`) + size < 5MB en INSERT para buckets `listings` y `avatars`
- [ ] **chats**: Añadir policies UPDATE/DELETE (solo participantes)
- [ ] **messages**: Añadir policy DELETE (solo sender o admin)
- [ ] **subscriptions**: Añadir policies INSERT/UPDATE (own)
- [ ] **listings**: Añadir CHECK constraint `price >= 0 AND price <= 100000`

### 0.3 Middleware - Rate limiting + Admin check
- [ ] Añadir rate limiting en `/login` (5 req/min/IP) y `/api/auth/register` (3 req/min/IP)
- [ ] Mover verificación de rol admin del cliente al middleware (`proxy.ts`)
- [ ] Probar: usuario no-admin accede a `/admin` → 403/redirect

### 0.4 Sanitización de inputs (API routes)
- [ ] Instalar `sanitize-html` o `dompurify`
- [ ] Sanitizar `title`, `description`, `full_name`, `reason` en `/api/auth/register/route.ts`
- [ ] Sanitizar en futuras API routes (listings CRUD, reports, profile)

### 0.5 Verificación post-Sprint 0
- [ ] Usuario A no ve phone de Usuario B en listings públicos
- [ ] Subir `.php` a storage → 400/403
- [ ] Subir imagen 10MB → 400/403
- [ ] Usuario no-admin accede `/admin` → redirect a `/dashboard`
- [ ] Login brute force → 429 tras 5 intentos
- [ ] Registro brute force → 429 tras 3 intentos
- [ ] Input `<script>alert(1)</script>` en registro → guardado sanitizado

---

## SPRINT 1 - ALTA PRIORIDAD
- [ ] Remover `phone` de selects públicos de listings (código)
- [ ] Headers de seguridad HTTP en `next.config.ts` (CSP, HSTS, X-Frame-Options, Referrer-Policy)
- [ ] Paginación en home y dashboard (`.range(0, 19)` + "Cargar más")
- [ ] Validación backend de precio (rechazar negativos, NaN, >100000)
- [ ] Enforcer límite plan gratis vía RLS policy o trigger (ya parcialmente en INSERT policy)
- [ ] Páginas `/terminos` y `/privacidad` enlazadas en login/registro
- [ ] Flujo eliminación de cuenta (derecho al olvido)

## SPRINT 2 - MEDIA PRIORIDAD
- [ ] Hook `useImageUpload` reutilizable
- [ ] Lib `lib/chat.ts` para lógica de chat
- [ ] Índices en BD: `listings(status, created_at)`, `listings(seller_id)`, `chats(buyer_id, seller_id)`, `messages(chat_id, created_at)`
- [ ] Revisar versiones Next 16 / React 19 → decidir si bajar a LTS
- [ ] Tabla `admin_actions` para auditoría admin

## SPRINT 3 - BAJA PRIORIDAD / MEJORAS
- [ ] Migrar componentes innecesariamente `'use client'` a Server Components
- [ ] Cookie consent banner
- [ ] Logging estructurado (Sentry)
- [ ] Tests de integración (Vitest + Playwright)

---

**Última actualización:** 2026-07-11
**Sprint actual:** 0 - CRÍTICO