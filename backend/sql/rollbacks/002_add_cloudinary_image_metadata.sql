BEGIN;

-- Este rollback elimina solamente metadata de Cloudinary y no modifica las referencias de imagen ni imagenes_adicionales.
ALTER TABLE public.servicios
    DROP COLUMN IF EXISTS imagenes_adicionales_public_ids,
    DROP COLUMN IF EXISTS imagen_public_id;

COMMIT;
