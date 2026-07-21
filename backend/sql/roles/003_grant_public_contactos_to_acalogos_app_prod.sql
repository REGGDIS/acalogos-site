\set ON_ERROR_STOP on

SELECT pg_catalog.current_database() = 'neondb' AS target_database_is_neondb
\gset

\if :target_database_is_neondb
\else
\echo 'La base de datos actual no es neondb. Ejecución detenida.'
SELECT 1 / 0 AS unexpected_target_database;
\endif

SELECT pg_catalog.to_regrole('acalogos_app_prod') IS NOT NULL AS app_role_exists
\gset

\if :app_role_exists
\else
\echo 'El rol acalogos_app_prod no existe. Ejecución detenida.'
SELECT 1 / 0 AS missing_app_role;
\endif

SELECT pg_catalog.to_regclass('public.contactos') IS NOT NULL AS contactos_table_exists
\gset

\if :contactos_table_exists
\else
\echo 'La tabla public.contactos no existe. Ejecución detenida.'
SELECT 1 / 0 AS missing_contactos_table;
\endif

BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.contactos
FROM acalogos_app_prod;

REVOKE
    SELECT (id, nombre, email, mensaje, privacy_notice_version, created_at),
    INSERT (id, nombre, email, mensaje, privacy_notice_version, created_at),
    UPDATE (id, nombre, email, mensaje, privacy_notice_version, created_at),
    REFERENCES (id, nombre, email, mensaje, privacy_notice_version, created_at)
ON TABLE public.contactos
FROM acalogos_app_prod;

GRANT INSERT (
    nombre,
    email,
    mensaje,
    privacy_notice_version
)
ON TABLE public.contactos
TO acalogos_app_prod;

GRANT SELECT (id)
ON TABLE public.contactos
TO acalogos_app_prod;

COMMIT;
