\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE public.contactos (
    id UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    mensaje VARCHAR(4000) NOT NULL,
    privacy_notice_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT contactos_pkey PRIMARY KEY (id)
);

REVOKE ALL PRIVILEGES ON TABLE public.contactos FROM PUBLIC;

COMMENT ON TABLE public.contactos IS
    'Mensajes recibidos mediante el formulario público de contacto. Retención operativa: 90 días.';

COMMENT ON COLUMN public.contactos.privacy_notice_version IS
    'Versión del aviso de privacidad aceptado al enviar el formulario.';

COMMIT;
