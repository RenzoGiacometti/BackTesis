# PluvIA Backend

Backend REST API para la plataforma **PluvIA** — gestión de recursos hídricos y análisis de datos agrícolas.

## Stack

| | |
|---|---|
| **Framework** | NestJS (TypeScript) |
| **Base de datos** | PostgreSQL |
| **ORM** | Prisma v7 |
| **Auth** | JWT (Access + Refresh Token) |
| **Docs** | Swagger / OpenAPI |

## Requisitos

- Node.js >= 18
- PostgreSQL >= 14

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos de BD y secrets JWT

# 3. Ejecutar migraciones
npx prisma migrate dev --name init

# 4. Cargar seed (usuarios de prueba)
npx ts-node prisma/seed.ts

# 5. Levantar el servidor
npm run start:dev
```

## Endpoints principales

Documentación interactiva disponible en: `http://localhost:3000/api/docs`

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registrar nuevo Productor |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/auth/refresh` | Renovar access token |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `GET` | `/api/auth/me` | Perfil del usuario autenticado |
| `POST` | `/api/auth/register/admin` | Registrar usuario con rol (Admin) |

### Users
| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/users` | Admin |
| `GET` | `/api/users/:id` | Propio o Admin |
| `PATCH` | `/api/users/:id/role` | Admin |
| `DELETE` | `/api/users/:id` | Admin (desactiva) |

## Roles

| Rol | Descripción |
|---|---|
| `ADMIN` | Acceso total, gestión de usuarios |
| `PRODUCTOR` | Acceso a sus campos y reportes |
| `AGUADOR` | Acceso de monitoreo |

## Variables de entorno

Ver [`.env.example`](.env.example)

## Estructura del proyecto

```
src/
├── auth/
│   ├── decorators/     # @CurrentUser, @Roles
│   ├── dto/            # RegisterDto, LoginDto, RefreshTokenDto
│   ├── guards/         # JwtAuthGuard, RolesGuard
│   └── strategies/     # JWT Passport strategy
├── common/
│   └── enums/          # Role enum
├── prisma/             # PrismaModule (global)
└── users/              # UsersModule
prisma/
├── schema.prisma       # Modelos: User, RefreshToken, Field, Report
├── seed.ts             # Datos iniciales
└── migrations/
```
