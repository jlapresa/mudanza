# Mudanza Quum

Aplicación web para decidir el destino de cada mueble de la oficina actual antes de la mudanza. Es independiente y se publica en Vercel.

## Pila

Next.js 15 con TypeScript, PostgreSQL (Neon) con Prisma, y Auth.js con acceso por enlace personal. Las fotos y las copias se guardan en Vercel Blob con acceso privado y solo se sirven con la sesión iniciada. La app no envía correo: los avisos aparecen en la campana de la cabecera. Los PDF se generan con pdfkit, los Excel con exceljs y los QR con qrcode. La app se instala en el móvil como aplicación web, y los cambios hechos sin conexión se guardan en una cola local (IndexedDB) que se envía al recuperar la conexión.

## Acceso

No hay contraseñas ni correo. Se entra con enlaces:

- **Enlace personal** (`/acceso/<token>`). Cada persona tiene el suyo. El responsable da de alta a la gente en Ajustes (una por línea, nombre y correo de Quum), copia cada enlace y lo envía por Teams. La página del enlace pide pulsar «Entrar», así que las vistas previas de Teams no inician ninguna sesión. Crear un enlace nuevo invalida el anterior y cierra las sesiones abiertas con él.
- **Enlace del equipo** (`/equipo/<token>`). Uno solo para todo el personal, pensado para el canal general. Quien lo abre se registra con su nombre y su correo de Quum y entra con rol de equipo. No admite correos que ya tengan cuenta. Se cambia o se desactiva desde Ajustes.
- **Enlace inicial** (`/acceso/<ACCESO_INICIAL>`). Solo para la primera entrada de los correos de `RESPONSABLES`. Deja de valer en cuanto todos ellos tienen enlace personal.

Cada persona ve su enlace personal en «Tu cuenta» para abrirlo en otro dispositivo. La sesión dura 90 días.

El correo que se escribe al registrarse no se verifica. Para el rol de equipo el riesgo es pequeño: como mucho, alguien podría pedir muebles con otro nombre, y no puede usar un correo que ya esté registrado.

| Rol | Puede |
|---|---|
| Responsable | Todo, incluidos asignar peticiones, fijar el plazo, cambiar zonas, importar y gestionar personas y enlaces |
| Colaborador | Editar fichas, subir fotos y decidir |
| Equipo | Ver el mercadillo, pedir, retirar sus peticiones y ver su estado |

## Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel como proyecto Next.js.
2. En Storage, crea una base **Neon Postgres** y conéctala al proyecto. La integración añade `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
3. En Storage, crea un **Blob** store y conéctalo. Añade `BLOB_READ_WRITE_TOKEN`.
4. Añade estas variables de entorno en Vercel:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | Cadena aleatoria larga (`openssl rand -base64 32`) |
| `APP_URL` | Dirección pública, por ejemplo `https://mudanza-quum.vercel.app` (se usa en los QR y en los enlaces de acceso) |
| `DOMINIO_PERMITIDO` | `quum.com` |
| `RESPONSABLES` | Correos con rol de responsable desde la primera entrada, separados por comas |
| `ACCESO_INICIAL` | Cadena aleatoria larga para el enlace de primera entrada |
| `CRON_SECRET` | Cadena aleatoria; Vercel la usa para llamar a la tarea diaria |

`AUTH_DEV_LOGIN` no debe existir en producción. Aunque exista, el acceso de prueba se desactiva solo cuando `VERCEL_ENV` es `production`.

5. Despliega. El paso de compilación (`npm run vercel-build`) aplica el esquema a la base de datos.
6. Entra con `https://<dirección>/acceso/<ACCESO_INICIAL>` y ve a Ajustes, Importar inventario. Sube `inventario/INVENTARIO_QUUM_MUDANZA.docx`, revisa la vista previa y confirma.

Vercel limita el plan gratuito (Hobby) a uso no comercial. Para Quum corresponde el plan Pro.

## Tarea diaria

`vercel.json` programa `/api/cron` cada día a las 07:15 UTC (08:15 en Madrid). La tarea publica para todo el mundo el aviso de apertura del mercadillo el día que abre y el recordatorio dos días antes del cierre, cada uno una sola vez. Además guarda una copia de la base de datos en Blob (`copias/AAAA-MM-DD.json`) y conserva las de los últimos 30 días. La app nunca borra fotos del almacenamiento: borrar una foto solo la quita de la ficha. Con la copia y el almacenamiento se puede restaurar todo.

`npm run cron` hace lo mismo a mano.

## Desarrollo local

```bash
npm install
cp .env.example .env        # y ajusta los valores
npx prisma db push
npm run importar -- inventario/INVENTARIO_QUUM_MUDANZA.docx
npm run dev
```

Sin `BLOB_READ_WRITE_TOKEN`, las fotos se guardan en `ALMACEN_DIR`. Con `AUTH_DEV_LOGIN=1`, la pantalla de entrada ofrece un acceso de prueba sin enlace y con el rol que se elija.

## Importación del inventario

Se hace desde Ajustes o con `npm run importar -- archivo.docx` (añade `--vista-previa` para no guardar nada). Las plantas y las salas se reconocen por nombre, porque el documento no tiene un formato que las distinga. La lista está en `src/lib/importacion.ts`. Cada línea se identifica por planta, sala y posición, así que la importación se puede repetir sin duplicar.

Todo entra como pendiente, con códigos de QM-0001 a QM-0112 en el orden del documento. Las líneas sin cantidad entran como un lote de 1 y las medidas dudosas llevan una nota para revisarlas. El texto original de cada línea se conserva en `campos_originales`.

## Mercadillo

Abre y cierra en las fechas de Ajustes (por defecto, del 10 al 16 de diciembre de 2026). La asignación sigue la regla de Quum, por orden de llegada, con un botón por artículo y otro para todo. El responsable puede asignar también a una persona concreta. Al asignar, el resto de peticiones del artículo pasan a «no asignada» y cada persona recibe un aviso en la app.

## Pruebas

```bash
npm run test:e2e
```

Las pruebas de `e2e/aceptacion.spec.ts` comprueban en un móvil emulado los criterios de aceptación del documento de requisitos, el acceso por enlaces, los avisos programados, el trabajo sin conexión y el cierre del plazo. Cada ejecución crea su propia base de datos vacía, importa el Word real y la elimina al acabar.
