# Plan de Optimización de Arquitectura y Escalabilidad Masiva: U-Market (UTA)

## Objetivo
Transformar **U-Market** en una plataforma de alto rendimiento, ultra-baja latencia y alta concurrencia, preparada para soportar el tráfico simultáneo de miles de estudiantes de la Universidad Técnica de Ambato (Campus Huachi, Ingahurco y Querochaca) en computadoras de laboratorio, laptops y teléfonos móviles.

---

## 1. Puntos Críticos Detectados en la Auditoría

1. **Base de Datos sin Índices (PostgreSQL en Supabase):**
   - Actualmente las tablas `listings`, `chats`, `messages` y `reports` carecen de índices compuestos sobre campos de filtrado y ordenamiento frecuente (`status`, `category`, `created_at DESC`, `updated_at DESC`).
   - La búsqueda en el feed utiliza `.or('title.ilike.%...%,description.ilike.%...%')`, lo que obliga a Postgres a escanear toda la tabla fila por fila (Full Sequential Scan), disparando el uso de CPU a 100% ante cientos de usuarios buscando a la vez.

2. **Thundering Herd en Realtime (Navbar):**
   - En `src/components/Navbar.tsx`, el cliente se suscribe a toda la tabla `messages` con `event: '*'`.
   - Cuando cualquier estudiante envía un mensaje en toda la universidad, el servidor de Realtime notifica a **todos** los usuarios conectados y cada uno dispara inmediatamente una consulta HTTP `SELECT count(*)`, lo que causaría una denegación de servicio (DDoS) involuntaria sobre Supabase.

3. **Rate Limiting Incompatible con el Wi-Fi del Campus (NAT Institucional):**
   - En `/api/auth/login` el límite es de 5 intentos/minuto por IP, y en `/api/auth/register` es de 3 intentos/minuto por IP.
   - En la UTA, los estudiantes conectados a eduroam o al Wi-Fi del campus comparten 1 o 2 IPs públicas. Con este límite, si 3 o 4 alumnos entran o se registran en una clase o evento, toda la facultad queda bloqueada con error `HTTP 429`.

4. **Sobrecarga de Renderizado y Batería (Efectos WebGL en Móviles):**
   - `SplashCursor.tsx` ejecuta un shader de fluidos WebGL de 923 líneas a 60–120 FPS de manera ininterrumpida en todas las pantallas. En celulares de gama media o con batería baja, esto provoca sobrecalentamiento, consumo excesivo de batería y caídas de fotogramas al hacer scroll.
   - En `ImageCarousel.tsx`, todas las tarjetas del catálogo cargan con `priority={i === 0}`, lo que fuerza al navegador a precargar en paralelo hasta 24 imágenes pesadas a la vez en vez de usar lazy loading selectivo.

5. **Instanciación Repetida del Cliente Supabase:**
   - `createClient()` en `src/lib/supabase/client.ts` genera una nueva instancia de `createBrowserClient` cada vez que se llama, duplicando listeners de sesión y almacenamiento en memoria.

6. **Falta de OpenGraph Dinámico para Grupos de WhatsApp:**
   - La página de detalle de producto (`/listings/[id]`) es 100% de cliente (`'use client'`), por lo que al compartir un link en WhatsApp o Telegram no se generan tarjetas de vista previa (imagen, precio, título).

---

## 2. Plan de Implementación Propuesto

### Fase A: Base de Datos y Aceleración de Búsqueda
* Crear el script `add_performance_indexes.sql`:
  * Índices B-Tree compuestos para el feed: `(status, created_at DESC)` y `(status, category, created_at DESC)`.
  * Habilitación de la extensión `pg_trgm` e índice GIN en `(title, category)` para búsquedas de texto instantáneas sin sobrecargar la CPU.
  * Índices en claves foráneas: `listings(seller_id)`, `chats(buyer_id, updated_at DESC)`, `chats(seller_id, updated_at DESC)` y `messages(chat_id, created_at ASC)`.
  * Índice parcial para conteo rápido de mensajes no leídos: `messages(chat_id, is_read) WHERE is_read = false`.

### Fase B: Cliente Supabase y Thundering Herd
* **Singleton en `src/lib/supabase/client.ts`:** Reutilizar la misma instancia en el navegador para ahorrar memoria y evitar conexiones huérfanas.
* **Optimización en `src/components/Navbar.tsx`:** Eliminar la suscripción global descontrolada a `messages`. Implementar actualización inteligente del contador de no leídos (al cargar, al recuperar el foco de la ventana con `window.focus` y con sondeo ligero y debounced).

### Fase C: Rendimiento Web y Móvil (Batería y Scroll)
* **`src/components/SplashCursor.tsx`:** Detectar dispositivos táctiles (`(pointer: coarse)`) o preferencia de reducción de movimiento (`prefers-reduced-motion`) para desactivar el canvas WebGL en móviles, y suspender el bucle de animación cuando la pestaña esté oculta (`visibilityState === 'hidden'`).
* **`src/components/ImageCarousel.tsx`:** Activar `priority` únicamente en la vista de detalle o en los 2 primeros productos del feed, dejando el resto con lazy loading optimizado por Next.js.
* **`src/app/globals.css` y `src/app/layout.tsx`:** Reemplazar el `@import url(...)` bloqueante de Google Fonts por la solución nativa `next/font/google`, eliminando tiempos de espera en la descarga de tipografías.

### Fase D: Ajuste de Seguridad para Redes de Campus (Wi-Fi UTA)
* **`/api/auth/login/route.ts`:** Rate limit de 5 intentos por correo (`email`) con un límite global por IP elevado a 100 req/min para tolerar múltiples accesos desde el mismo NAT de la universidad.
* **`/api/auth/register/route.ts`:** Aumentar el límite de registros por IP de 3 a 40/minuto y controlar la tasa por correo institucional para soportar registros masivos en eventos o campañas.

### Fase E: Compartir en Redes Sociales (WhatsApp / Telegram)
* Configurar metadatos dinámicos en el servidor para `/listings/[id]` de modo que al pegar el enlace en WhatsApp o redes sociales aparezca la tarjeta con la foto, precio en dólares y campus de la facultad.

### Fase F: Calidad de Código
* Corregir los errores de ESLint en `Navbar.tsx` (`@typescript-eslint/no-explicit-any`) y la variable no utilizada en `health/route.ts` para garantizar que `npm run lint` pase con 0 errores.

---

## 3. Plan de Verificación
1. **Linter & Typecheck:** Ejecutar `npm run lint` y verificar que pase sin errores.
2. **Compilación de Producción:** Ejecutar `npm run build` para asegurar empaquetado Turbopack sin advertencias.
3. **Pruebas de Funcionalidad:** Validar catálogo, buscador, filtros por campus, navegación móvil y login.
