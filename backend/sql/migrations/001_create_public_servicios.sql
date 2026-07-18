BEGIN;

CREATE TABLE public.servicios (
    id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio TEXT,
    categoria TEXT[],
    imagen TEXT,
    imagenes_adicionales TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE SEQUENCE public.servicios_id_seq
    AS INTEGER
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.servicios_id_seq
    OWNED BY public.servicios.id;

ALTER TABLE ONLY public.servicios
    ALTER COLUMN id SET DEFAULT nextval('public.servicios_id_seq'::regclass);

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);

COMMIT;
