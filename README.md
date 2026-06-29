# PluvIA Back

API REST de la aplicación PluvIA, construida con NestJS. Gestiona la autenticación, los usuarios y roles, las chacras, los mapas publicados, los puntos de problema y los reportes, y expone esos datos al frontend.

## El sistema PluvIA

PluvIA se reparte en tres repositorios:

- Backend (Python / FastAPI): motor de procesamiento. Recibe los ortomosaicos del dron, corre la inferencia del modelo y genera los mapas, los puntos de problema y los reportes.
- PluvIABack (este repositorio): API de la aplicación. Gestiona usuarios, roles y chacras, y publica los resultados que produce el motor de procesamiento.
- PluvIAFront (React): interfaz web que consume esta API.

El flujo de datos va dron -> Backend (procesa) -> PluvIABack (publica) -> PluvIAFront (visualiza).

## Stack

- NestJS 11 sobre TypeScript
- PostgreSQL con PostGIS
- Prisma 6 como ORM
- JWT (access y refresh token) con Passport
- class-validator y class-transformer para validación
- Almacenamiento en sistema de archivos local o en S3 / MinIO
- Swagger / OpenAPI para la documentación

Algunos campos geográficos (la geometría de chacras y puntos) usan PostGIS, por lo que la base de datos necesita la extensión instalada.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior con PostGIS

## Instalación

```
npm install
cp .env.example .env
```

Variables principales del `.env`:

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `PORT`: puerto del servidor. El frontend espera la API en el 3001, así que conviene usar `PORT=3001`.
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`: secrets de firma de los tokens.
- `JWT_ACCESS_EXPIRATION` y `JWT_REFRESH_EXPIRATION`: vigencia de cada token.

## Base de datos

```
npx prisma migrate dev
npm run seed
```

El seed crea los roles, una organización de prueba, los usuarios de ejemplo, las chacras, los catálogos y datos de muestra (mapas, puntos, comentarios y reportes).

Usuarios de prueba que deja el seed:

- `admin@pluvia.com` / `Admin1234!`
- `productor@pluvia.com` / `Productor1234!`
- `aguador@pluvia.com` / `Aguador1234!`

## Ejecución

```
npm run start:dev
```

- API: `http://localhost:3001/api`
- Documentación Swagger: `http://localhost:3001/api/docs`

## Scripts

- `npm run start:dev`: desarrollo con recarga automática
- `npm run start:prod`: producción (corre sobre `dist/`)
- `npm run build`: compila el proyecto
- `npm run test`: tests unitarios con Jest
- `npm run lint`: ESLint
- `npm run seed`: carga los datos de prueba
- `npx prisma migrate dev`: aplica las migraciones
- `npx prisma generate`: regenera el cliente de Prisma

## Roles

- admin: acceso total, gestión de usuarios y catálogos.
- productor: sus chacras, mapas y reportes.
- aguador: monitoreo de las chacras asignadas y gestión de puntos de problema.

## Módulos y endpoints

El prefijo global es `/api` y la documentación interactiva está en `/api/docs`. Módulos principales:

- auth (`/api/auth`): registro, login, refresh, logout y perfil del usuario.
- users (`/api/users`): listado y gestión de usuarios (admin).
- chacras (`/api/chacras`): alta y edición de chacras y asignación de aguadores.
- catalogos (`/api/catalogos`): tipos de mapa y niveles de severidad.
- mapas (`/api/mapas`): mapas publicados por chacra, alta y subida de archivos.
- puntos (`/api/puntos`): puntos de problema, cambios de estado y comentarios.
- reportes (`/api/reportes`): generación, subida y descarga de reportes.
- files (`/api/files`): descarga de archivos almacenados.

## Modelo de datos

Una organización agrupa usuarios (cada uno con un rol dentro de la organización) y chacras. Cada chacra tiene mapas publicados; cada mapa tiene puntos de problema con su severidad, comentarios e historial de estados. Las chacras también acumulan reportes. El esquema completo está en `prisma/schema.prisma`.

## Estructura

```
src/
  auth/        autenticación JWT, guards, strategies y decorators
  users/
  chacras/
  catalogos/   tipos de mapa y severidades
  mapas/
  puntos/      puntos de problema, comentarios e historial
  reportes/
  files/       almacenamiento local o MinIO / S3
  prisma/      PrismaModule (global)
  common/      constantes y utilidades compartidas
prisma/
  schema.prisma   modelo de datos
  migrations/
  seed.ts
```
