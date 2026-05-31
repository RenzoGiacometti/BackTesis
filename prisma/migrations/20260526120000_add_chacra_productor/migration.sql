-- Add id_productor column (nullable) + FK + index
ALTER TABLE "chacra"
  ADD COLUMN "id_productor" UUID;

ALTER TABLE "chacra"
  ADD CONSTRAINT "chacra_id_productor_fkey"
  FOREIGN KEY ("id_productor")
  REFERENCES "usuario_organizacion"("id_usuario_organizacion")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "chacra_id_productor_idx" ON "chacra"("id_productor");

-- Backfill: asignar cada chacra al primer productor activo de su organización.
-- Si la org no tiene productor activo, queda en NULL (la verá solo el admin).
UPDATE "chacra" c
SET "id_productor" = sub.id_uo
FROM (
  SELECT DISTINCT ON (uo.id_organizacion)
    uo.id_organizacion,
    uo.id_usuario_organizacion AS id_uo
  FROM "usuario_organizacion" uo
  INNER JOIN "rol" r ON r.id_rol = uo.id_rol
  WHERE r.nombre = 'productor'
    AND uo.estado = 'activo'
  ORDER BY uo.id_organizacion, uo.fecha_alta ASC
) AS sub
WHERE c.id_organizacion = sub.id_organizacion
  AND c.id_productor IS NULL;
