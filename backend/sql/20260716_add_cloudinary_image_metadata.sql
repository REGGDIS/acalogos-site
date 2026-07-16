BEGIN;

ALTER TABLE public.servicios
    ADD COLUMN IF NOT EXISTS imagen_public_id TEXT NULL;

ALTER TABLE public.servicios
    ADD COLUMN IF NOT EXISTS imagenes_adicionales_public_ids JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.servicios.imagen_public_id IS
    'Guarda el Public ID de Cloudinary asociado a imagen. Las rutas locales deben mantener NULL.';

COMMENT ON COLUMN public.servicios.imagenes_adicionales_public_ids IS
    'Guarda un objeto JSON cuya clave es la referencia exacta almacenada en imagenes_adicionales y cuyo valor es su Public ID de Cloudinary. Las rutas locales no deben tener entrada en este objeto JSON.';

COMMIT;
