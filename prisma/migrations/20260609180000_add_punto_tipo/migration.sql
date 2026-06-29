-- Tipo de problema en PuntoProblema: separa falta/exceso/mixto del campo descripcion
-- para poder filtrar en el front sin parsear strings.

CREATE TYPE "tipo_problema" AS ENUM ('falta_agua', 'exceso_agua', 'mixto', 'desconocido');

ALTER TABLE "punto_problema"
  ADD COLUMN "tipo" "tipo_problema" NOT NULL DEFAULT 'desconocido';

-- Backfill: parseamos descripcion. El builder de mapas.service produce strings
-- tipo "Falta de agua · ..." o "Grupo de N zonas (X de falta de agua, Y de exceso de agua) ..."
-- por lo que matchemos ILIKE sobre esas frases.
UPDATE "punto_problema" SET "tipo" = CASE
  WHEN descripcion ILIKE '%falta de agua%' AND descripcion ILIKE '%exceso de agua%' THEN 'mixto'::"tipo_problema"
  WHEN descripcion ILIKE '%falta de agua%' THEN 'falta_agua'::"tipo_problema"
  WHEN descripcion ILIKE '%exceso de agua%' THEN 'exceso_agua'::"tipo_problema"
  ELSE 'desconocido'::"tipo_problema"
END;
