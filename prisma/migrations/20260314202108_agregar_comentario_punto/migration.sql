-- CreateTable
CREATE TABLE "comentario_punto" (
    "id_comentario" UUID NOT NULL,
    "id_punto_problema" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "imagen_url" TEXT,
    "estado" "estado_general" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentario_punto_pkey" PRIMARY KEY ("id_comentario")
);

-- AddForeignKey
ALTER TABLE "comentario_punto" ADD CONSTRAINT "comentario_punto_id_punto_problema_fkey" FOREIGN KEY ("id_punto_problema") REFERENCES "punto_problema"("id_punto_problema") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario_punto" ADD CONSTRAINT "comentario_punto_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
