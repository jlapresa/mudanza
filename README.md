# Mudanza Quum

Aplicación web para decidir el destino de cada mueble de la oficina actual antes de la mudanza. Es independiente y se publica en Vercel.

## Pila

Next.js 15 con TypeScript, PostgreSQL (Neon) con Prisma, y Auth.js con acceso por código enviado al correo corporativo. Las fotos y las copias se guardan en Vercel Blob con acceso privado y solo se sirven con la sesión iniciada. El correo sale por Resend. Los PDF se generan con pdfkit, los Excel con exceljs y los QR con qrcode. La app se instala en el móvil como aplicación web, y los cambios hechos sin conexión se guardan en una cola local (IndexedDB) que se envía al recuperar la conexión.

## Acceso

Cada persona escribe su correo `@quum.com` y recibe un código de seis cifras. La primera vez que entra queda registrada, con rol de equipo. El código caduca a los 10 minutos, vale una sola vez, admite cinco intentos y se guarda cifrado. Cada correo puede pedir como mucho cinco códigos por hora.

| Rol | Puede |
|---|---|
| Responsable | Todo, incluidos asignar peticiones, fijar el plazo, cambiar zonas, importar y dar roles |
| Colaborador | Editar fichas, subir fotos y decidir |
| Equipo | Ver el mercadillo, pedir, retirar sus peticiones y ver su estado |

Los correos de `RESPONSABLES` entran directamente como responsables. El resto de roles se asignan en Ajustes, donde también se puede dar acceso a alguien antes de que entre por primera vez.

## Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel como proyecto Next.js.
2. En Storage, crea una base **Neon Postgres** y conéctala al proyecto. La integración añade `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
3. En Storage, crea un **Blob** store y conéctalo. Añade `BLOB_READ_WRITE_TOKEN`.
4. Crea una cuenta en Resend, añade un dominio de envío (por ejemplo `mudanza.quum.com`) y pon en el DNS de Quum los registros que indique. Copia la clave de API.
5. Añade estas variables de entorno en Vercel:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | Cadena aleatoria larga (`openssl rand -base64 32`) |
| `APP_URL` | Dirección pública, por ejemplo `https://mudanza-quum.vercel.app` (se usa en los QR y en los correos) |
| `DOMINIO_PERMITIDO` | `quum.com` |
| `RESPONSABLES` | Correos con rol de responsable, separados por comas |
| `RESEND_API_KEY` | Clave de Resend |
| `CORREO_REMITENTE` | Por ejemplo `Mudanza Quum <avisos@mudanza.quum.com>`, del dominio verificado en Resend |
| `CORREO_EQUIPO` | Opcional: lista de distribución para los correos a todo el equipo. Sin ella, se envía a quien se haya registrado |
| `CRON_SECRET` | Cadena aleatoria; Vercel la usa para llamar a la tarea diaria |

`AUTH_DEV_LOGIN` no debe existir en producción. Aunque exista, el acceso de prueba se desactiva solo cuando `VERCEL_ENV` es `production`.

6. Despliega. El paso de compilación (`npm run vercel-build`) aplica el esquema a la base de datos.
7. Entra con un correo de `RESPONSABLES` y ve a Ajustes, Importar inventario. Sube `inventario/INVENTARIO_QUUM_MUDANZA.docx`, revisa la vista previa y confirma.

Vercel limita el plan gratuito (Hobby) a uso no comercial. Para Quum corresponde el plan Pro.

## Tarea diaria

`vercel.json` programa `/api/cron` cada día a las 07:15 UTC (08:15 en Madrid). La tarea envía el correo de apertura del mercadillo el día que abre y el recordatorio dos días antes del cierre, cada uno una sola vez. Además guarda una copia de la base de datos en Blob (`copias/AAAA-MM-DD.json`) y conserva las de los últimos 30 días. La app nunca borra fotos del almacenamiento: borrar una foto solo la quita de la ficha. Con la copia y el almacenamiento se puede restaurar todo.

`npm run cron` hace lo mismo a mano.

## Desarrollo local

```bash
npm install
cp .env.example .env        # y ajusta los valores
npx prisma db push
npm run importar -- inventario/INVENTARIO_QUUM_MUDANZA.docx
npm run dev
```

Sin `RESEND_API_KEY`, los correos y los códigos de acceso se escriben en la consola. Sin `BLOB_READ_WRITE_TOKEN`, las fotos se guardan en `ALMACEN_DIR`. Con `AUTH_DEV_LOGIN=1`, la pantalla de entrada ofrece además un acceso de prueba sin código y con el rol que se elija.

## Importación del inventario

Se hace desde Ajustes o con `npm run importar -- archivo.docx` (añade `--vista-previa` para no guardar nada). Las plantas y las salas se reconocen por nombre, porque el documento no tiene un formato que las distinga. La lista está en `src/lib/importacion.ts`. Cada línea se identifica por planta, sala y posición, así que la importación se puede repetir sin duplicar.

Todo entra como pendiente, con códigos de QM-0001 a QM-0112 en el orden del documento. Las líneas sin cantidad entran como un lote de 1 y las medidas dudosas llevan una nota para revisarlas. El texto original de cada línea se conserva en `campos_originales`.

## Mercadillo

Abre y cierra en las fechas de Ajustes (por defecto, del 10 al 16 de diciembre de 2026). La asignación sigue la regla de Quum, por orden de llegada, con un botón por artículo y otro para todo. El responsable puede asignar también a una persona concreta. Al asignar, el resto de peticiones del artículo pasan a «no asignada», y cada persona recibe un aviso en la app y un correo.

## Pruebas

```bash
npm run test:e2e
```

Las pruebas de `e2e/aceptacion.spec.ts` comprueban en un móvil emulado los criterios de aceptación del documento de requisitos, el acceso por código, el trabajo sin conexión y el cierre del plazo. Cada ejecución crea su propia base de datos vacía, importa el Word real y la elimina al acabar.
