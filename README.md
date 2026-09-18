# Sistema de invitaciones digitales (AMAL AGENDA / NayarSound)

Backend de administración de eventos, RSVP y sincronización con Google
Sheets. El **diseño visual** de cada invitación se hace en **Framer**; este
sistema se encarga de la parte que no se ve: crear eventos, recibir
confirmaciones, y llevar todo a una tabla maestra.

> Adaptado del proyecto open source [`weddingly-builder`](https://github.com/dannycahyo/weddingly-builder)
> (Licencia MIT, © 2025 Danny Dwi Cahyono — ver [`LICENSE`](./LICENSE)).
> Se conservó la base de datos, el panel administrativo y las rutas de
> RSVP; se quitó todo el "builder" visual (colores, fuentes, galería,
> historia, música, registro de regalos) porque ese trabajo ahora lo hace
> Framer, y se rediseñó el modelo de datos para que un mismo negocio
> administre **muchos** eventos/clientes desde una sola cuenta.

## Qué incluye

- **Panel interno** (`/admin`): solo para ti y tu equipo (sin registro
  público). Desde ahí creas cada evento/cliente y ves sus RSVPs.
- **Un evento = un cliente**. Cada uno tiene un `eventCode` único
  (el `ID_EVENTO`) que es también el slug que conectas desde Framer.
- **Endpoint público de RSVP** (`/api/rsvp/[eventCode]`): lo llama el
  formulario embebido en tu invitación de Framer. No requiere login.
- **Sincronización con Google Sheets**: cada RSVP se guarda primero en la
  base de datos (fuente de verdad) y luego se refleja en una fila de tu
  hoja de cálculo. Si Sheets falla, el RSVP del invitado **no se pierde**.
- **Tabla maestra, no una hoja por cliente**: todas las respuestas de todos
  los eventos van a la misma hoja, identificadas por `ID_EVENTO`.

## Seguridad (respecto al repo original)

El repo original (pensado para que cada pareja se auto-registrara) tenía
dos fallas que se corrigieron aquí:

1. Las contraseñas se guardaban con SHA-256 sin sal → ahora se usa PBKDF2
   con sal aleatoria (210,000 iteraciones).
2. Las sesiones eran un simple `base64(JSON)` sin firmar (cualquiera podía
   fabricar una cookie válida) → ahora las sesiones van firmadas con
   HMAC-SHA256 usando `SESSION_SECRET`, y expiran a los 7 días.

## Instalación

```bash
npm install
cp .env.example .env   # y completa las variables (ver .env.example)
```

### Base de datos

1. Crea una base PostgreSQL (local, o en Supabase/Neon/Railway — todos
   tienen un nivel gratuito suficiente para empezar).
2. Aplica las migraciones:

```bash
npx prisma migrate deploy
```

(si vas a seguir desarrollando el esquema, usa `npx prisma migrate dev`)

### Primera cuenta de administrador

No hay registro público. Crea tu cuenta con:

```bash
npm run seed:admin -- --email=tu@correo.com --password=una-clave-segura --name="Tu nombre"
```

### Levantar el servidor

```bash
npm run dev       # desarrollo, http://localhost:4321
npm run build     # build de producción
npm run preview   # probar el build de producción
```

## Conectar Framer

1. En el panel (`/admin` → pestaña "Eventos"), crea el evento del cliente.
   Copia su `eventCode` (botón de copiar en la tabla) — te da la URL
   completa del endpoint, algo como:

   ```
   https://tu-dominio.com/api/rsvp/boda-de-ana-luis-er3zya
   ```

2. En Framer, en el formulario de RSVP de la invitación, apunta el envío
   (fetch/POST) a esa URL con este cuerpo JSON:

   ```json
   {
     "fullName": "Nombre del invitado",
     "phone": "opcional",
     "email": "opcional",
     "attending": true,
     "companionsCount": 2,
     "companionNames": "Nombre 1, Nombre 2",
     "dietaryRestrictions": "opcional",
     "message": "opcional"
   }
   ```

   Si `attending` es `true`, la respuesta (`201`) incluye un QR único por
   cada persona confirmada (el titular + cada nombre en `companionNames`):

   ```json
   {
     "success": true,
     "rsvp": { "...": "..." },
     "guests": [
       { "fullName": "Nombre del invitado", "qrUrl": "https://tu-dominio.com/api/qr/xxxxxxxx" },
       { "fullName": "Nombre 1", "qrUrl": "https://tu-dominio.com/api/qr/yyyyyyyy" }
     ]
   }
   ```

   Muestra esas imágenes (`<img src="qrUrl">`) en la misma pantalla de
   Framer justo después de confirmar, para que el invitado las guarde o
   les tome captura ahí mismo — es la entrega principal, inmediata y sin
   depender de ningún servicio externo.

3. Configura `FRAMER_ALLOWED_ORIGIN` en tu `.env` de producción con el
   dominio exacto de tu sitio de Framer, para que el navegador del
   invitado no bloquee la petición (CORS).

4. (Opcional) Si quieres que Framer muestre el nombre/fecha/lugar del
   evento dinámicamente en vez de escribirlo a mano en el diseño, puedes
   pedirlos con un GET a `/api/events/[eventCode]` (endpoint público, de
   solo lectura).

## Entrega de QR por correo (respaldo)

Si el invitado dejó su `email` en el formulario, además de mostrarse en
pantalla, se le manda automáticamente un correo con sus QR (por si pierde
la pantalla de confirmación) — enviado desde tu propia cuenta de Gmail.
Configura `GMAIL_USER` y `GMAIL_APP_PASSWORD` — ver
[`.env.example`](./.env.example) para el paso a paso (activar
verificación en dos pasos + generar una contraseña de aplicación, ambos
gratis y en minutos). Si no está configurado, o el invitado no dejó
correo, el RSVP y sus QR se guardan igual — el correo es solo un
respaldo, nunca la fuente de verdad.

## Conectar Google Sheets

Ver las instrucciones paso a paso dentro de [`.env.example`](./.env.example)
(sección Google Sheets). En resumen: cuenta de servicio de Google Cloud +
compartir tu hoja con su correo + las 4 variables `GOOGLE_*`.

La hoja debe tener una pestaña (por defecto `RSVPs`); el sistema crea la
fila de encabezados automáticamente la primera vez si está vacía, con estas
columnas: `ID_EVENTO, ID_RESPUESTA, FECHA_HORA, NOMBRE_EVENTO,
NOMBRE_INVITADO, ASISTIRA, NUM_ACOMPANANTES, NOMBRES_ACOMPANANTES,
TELEFONO, MENSAJE, RESTRICCIONES_ALIMENTARIAS`.

## Estructura del proyecto

```
prisma/schema.prisma        Modelo de datos (AdminUser, EventProject, EventSession, RSVP)
src/lib/auth.ts              Login, hash de contraseñas, sesiones firmadas
src/lib/sheets.ts             Sincronización con Google Sheets
src/lib/prisma.ts             Cliente de base de datos
src/pages/api/auth/           Login / logout / crear cuenta de equipo (protegido)
src/pages/api/events/         CRUD de eventos/clientes (protegido) + GET público
src/pages/api/rsvp/           Envío público de RSVP + lista/exportación (protegido)
src/components/               Panel de administración (React)
scripts/seed-admin.ts         Crear la primera cuenta de administrador
```

## Despliegue

Cualquier plataforma que soporte Node.js sirve (Vercel, Railway, Render).
El cliente de base de datos no necesita binarios nativos (usa el adaptador
`@prisma/adapter-pg`), lo que lo hace liviano para entornos serverless.

Variables de entorno necesarias en producción: todas las de
`.env.example`. No olvides correr `npx prisma migrate deploy` y
`npm run seed:admin` una sola vez contra la base de datos de producción.

## Pendientes conocidos (auditoría de dependencias)

Quedan 3 vulnerabilidades "high" reportadas por `npm audit`, las tres en
herramientas internas de Prisma (`@prisma/config` → `deepmerge-ts`), usadas
solo por los comandos de CLI (`prisma migrate`/`generate`) en tu máquina de
desarrollo — no forman parte del código que corre en producción. La
corrección disponible implicaría bajar de versión Prisma, así que se dejó
así a propósito; revisa `npm audit` de vez en cuando por si Prisma libera
una versión más nueva que ya la resuelva.
