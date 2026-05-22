/*
  Warnings:

  - You are about to drop the `fields` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- Habilitar PostGIS (requerido para los campos geometry en chacra y punto_problema)
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "estado_general" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "estado_mapa" AS ENUM ('borrador', 'procesando', 'publicado', 'archivado');

-- CreateEnum
CREATE TYPE "estado_punto" AS ENUM ('pendiente', 'en_revision', 'resuelto', 'descartado');

-- CreateEnum
CREATE TYPE "estado_reporte" AS ENUM ('borrador', 'generado', 'archivado');

-- DropForeignKey
ALTER TABLE "fields" DROP CONSTRAINT "fields_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_fieldId_fkey";

-- DropTable
DROP TABLE "fields";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropTable
DROP TABLE "reports";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "organizacion" (
    "id_organizacion" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id_organizacion")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "id_usuario" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "usuario_organizacion" (
    "id_usuario_organizacion" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_organizacion" UUID NOT NULL,
    "id_rol" UUID NOT NULL,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',
    "fecha_alta" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_organizacion_pkey" PRIMARY KEY ("id_usuario_organizacion")
);

-- CreateTable
CREATE TABLE "chacra" (
    "id_chacra" UUID NOT NULL,
    "id_organizacion" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "ubicacion_textual" VARCHAR(500),
    "superficie" DECIMAL(10,2),
    "geometria" geometry(Polygon,4326),
    "estado" "estado_general" NOT NULL DEFAULT 'activo',
    "fecha_alta" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chacra_pkey" PRIMARY KEY ("id_chacra")
);

-- CreateTable
CREATE TABLE "usuario_chacra" (
    "id_usuario_chacra" UUID NOT NULL,
    "id_chacra" UUID NOT NULL,
    "id_usuario_organizacion" UUID NOT NULL,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',

    CONSTRAINT "usuario_chacra_pkey" PRIMARY KEY ("id_usuario_chacra")
);

-- CreateTable
CREATE TABLE "catalogo_tipo_mapa" (
    "id_tipo_mapa" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',

    CONSTRAINT "catalogo_tipo_mapa_pkey" PRIMARY KEY ("id_tipo_mapa")
);

-- CreateTable
CREATE TABLE "catalogo_severidad" (
    "id_severidad" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "nivel" INTEGER NOT NULL,
    "descripcion" TEXT,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',

    CONSTRAINT "catalogo_severidad_pkey" PRIMARY KEY ("id_severidad")
);

-- CreateTable
CREATE TABLE "mapa_publicado" (
    "id_mapa" UUID NOT NULL,
    "id_chacra" UUID NOT NULL,
    "id_tipo_mapa" UUID NOT NULL,
    "fecha_mapa" DATE NOT NULL,
    "fecha_generacion" TIMESTAMPTZ NOT NULL,
    "fecha_publicacion" TIMESTAMPTZ,
    "tiles_url_base" TEXT,
    "preview_url" TEXT,
    "resumen_estadistico" JSONB,
    "metadata_liviana" JSONB,
    "ref_proc_externa" TEXT,
    "estado" "estado_mapa" NOT NULL DEFAULT 'borrador',

    CONSTRAINT "mapa_publicado_pkey" PRIMARY KEY ("id_mapa")
);

-- CreateTable
CREATE TABLE "punto_problema" (
    "id_punto_problema" UUID NOT NULL,
    "id_mapa" UUID NOT NULL,
    "coordenada_x" DECIMAL(12,8) NOT NULL,
    "coordenada_y" DECIMAL(12,8) NOT NULL,
    "geometria" geometry(Point,4326),
    "id_severidad" UUID NOT NULL,
    "descripcion" TEXT,
    "estado" "estado_punto" NOT NULL DEFAULT 'pendiente',
    "fecha_deteccion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punto_problema_pkey" PRIMARY KEY ("id_punto_problema")
);

-- CreateTable
CREATE TABLE "historial_punto_problema" (
    "id_historial" UUID NOT NULL,
    "id_punto_problema" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "estado_anterior" "estado_punto" NOT NULL,
    "estado_nuevo" "estado_punto" NOT NULL,
    "observacion" TEXT,
    "fecha_cambio" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_punto_problema_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "configuracion_organizacion" (
    "id_configuracion" UUID NOT NULL,
    "id_organizacion" UUID NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_usuario_actualizacion" UUID NOT NULL,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_organizacion_pkey" PRIMARY KEY ("id_configuracion")
);

-- CreateTable
CREATE TABLE "reporte" (
    "id_reporte" UUID NOT NULL,
    "id_chacra" UUID NOT NULL,
    "id_mapa" UUID,
    "tipo_reporte" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "resumen" TEXT,
    "archivo_url" TEXT,
    "fecha_generacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "estado_reporte" NOT NULL DEFAULT 'borrador',

    CONSTRAINT "reporte_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_key" ON "refresh_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_organizacion_id_usuario_id_organizacion_key" ON "usuario_organizacion"("id_usuario", "id_organizacion");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_chacra_id_chacra_id_usuario_organizacion_key" ON "usuario_chacra"("id_chacra", "id_usuario_organizacion");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_tipo_mapa_nombre_key" ON "catalogo_tipo_mapa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_severidad_nombre_key" ON "catalogo_severidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_organizacion_id_organizacion_clave_key" ON "configuracion_organizacion"("id_organizacion", "clave");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_organizacion" ADD CONSTRAINT "usuario_organizacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_organizacion" ADD CONSTRAINT "usuario_organizacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_organizacion" ADD CONSTRAINT "usuario_organizacion_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chacra" ADD CONSTRAINT "chacra_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_chacra" ADD CONSTRAINT "usuario_chacra_id_chacra_fkey" FOREIGN KEY ("id_chacra") REFERENCES "chacra"("id_chacra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_chacra" ADD CONSTRAINT "usuario_chacra_id_usuario_organizacion_fkey" FOREIGN KEY ("id_usuario_organizacion") REFERENCES "usuario_organizacion"("id_usuario_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_publicado" ADD CONSTRAINT "mapa_publicado_id_chacra_fkey" FOREIGN KEY ("id_chacra") REFERENCES "chacra"("id_chacra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_publicado" ADD CONSTRAINT "mapa_publicado_id_tipo_mapa_fkey" FOREIGN KEY ("id_tipo_mapa") REFERENCES "catalogo_tipo_mapa"("id_tipo_mapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punto_problema" ADD CONSTRAINT "punto_problema_id_mapa_fkey" FOREIGN KEY ("id_mapa") REFERENCES "mapa_publicado"("id_mapa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punto_problema" ADD CONSTRAINT "punto_problema_id_severidad_fkey" FOREIGN KEY ("id_severidad") REFERENCES "catalogo_severidad"("id_severidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_punto_problema" ADD CONSTRAINT "historial_punto_problema_id_punto_problema_fkey" FOREIGN KEY ("id_punto_problema") REFERENCES "punto_problema"("id_punto_problema") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_punto_problema" ADD CONSTRAINT "historial_punto_problema_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_organizacion" ADD CONSTRAINT "configuracion_organizacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_organizacion" ADD CONSTRAINT "configuracion_organizacion_id_usuario_actualizacion_fkey" FOREIGN KEY ("id_usuario_actualizacion") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_chacra_fkey" FOREIGN KEY ("id_chacra") REFERENCES "chacra"("id_chacra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_mapa_fkey" FOREIGN KEY ("id_mapa") REFERENCES "mapa_publicado"("id_mapa") ON DELETE SET NULL ON UPDATE CASCADE;
