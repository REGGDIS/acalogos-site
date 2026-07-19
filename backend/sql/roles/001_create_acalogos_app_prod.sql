\set ON_ERROR_STOP on

-- Guard fail-closed: ninguna consulta de preflight ni sentencia mutante puede
-- ejecutarse fuera de la base objetivo.
SELECT pg_catalog.current_database() = 'neondb' AS target_database_is_neondb
\gset

\if :target_database_is_neondb
\else
\echo 'La base de datos actual no es neondb. Ejecución detenida.'
SELECT 1 / 0 AS unexpected_target_database;
\endif

-- Este archivo es seguro por defecto: sin variables solo ejecuta el preflight.
\if :{?provision_role}
\else
\set provision_role false
\endif

\if :{?apply_global_hardening}
\else
\set apply_global_hardening false
\endif

SELECT
    :'provision_role'::boolean
    AND :'apply_global_hardening'::boolean AS incompatible_modes
\gset

\if :incompatible_modes
\echo 'provision_role y apply_global_hardening son mutuamente excluyentes.'
SELECT 1 / 0 AS incompatible_execution_modes;
\endif

-- Preflight de solo lectura. Revisa este resultado antes de habilitar cualquier modo.
SELECT
    pg_catalog.has_database_privilege('public', 'neondb', 'CREATE') AS public_database_create,
    pg_catalog.has_database_privilege('public', 'neondb', 'TEMPORARY') AS public_database_temporary,
    pg_catalog.has_schema_privilege('public', 'public', 'CREATE') AS public_schema_create;

SELECT
    roles.rolname AS login_role,
    pg_catalog.has_database_privilege(roles.oid, 'neondb', 'CREATE') AS effective_database_create,
    pg_catalog.has_database_privilege(roles.oid, 'neondb', 'TEMPORARY') AS effective_database_temporary,
    pg_catalog.has_schema_privilege(roles.oid, 'public', 'CREATE') AS effective_public_schema_create
FROM pg_catalog.pg_roles AS roles
WHERE roles.rolcanlogin
  AND (
      pg_catalog.has_database_privilege(roles.oid, 'neondb', 'CREATE')
      OR pg_catalog.has_database_privilege(roles.oid, 'neondb', 'TEMPORARY')
      OR pg_catalog.has_schema_privilege(roles.oid, 'public', 'CREATE')
  )
ORDER BY roles.rolname;

SELECT object_type, object_name, owner_role
FROM (
    SELECT
        'database'::text AS object_type,
        database_record.datname::text AS object_name,
        pg_catalog.pg_get_userbyid(database_record.datdba) AS owner_role
    FROM pg_catalog.pg_database AS database_record
    WHERE database_record.datname = 'neondb'

    UNION ALL

    SELECT
        'schema'::text,
        namespace_record.nspname::text,
        pg_catalog.pg_get_userbyid(namespace_record.nspowner)
    FROM pg_catalog.pg_namespace AS namespace_record
    WHERE namespace_record.nspname = 'public'

    UNION ALL

    SELECT
        CASE class_record.relkind
            WHEN 'S' THEN 'sequence'
            ELSE 'table'
        END,
        pg_catalog.format('%I.%I', namespace_record.nspname, class_record.relname),
        pg_catalog.pg_get_userbyid(class_record.relowner)
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname IN ('servicios', 'servicios_id_seq')
) AS ownership
ORDER BY object_type, object_name;

-- Provisión del rol. Ejecutar únicamente con -v provision_role=true.
\if :provision_role
BEGIN;

CREATE ROLE acalogos_app_prod
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    NOBYPASSRLS;

-- Neon puede añadir al creador como miembro administrativo del nuevo rol.
-- Elimina completamente esa relación sin depender del nombre del owner.
REVOKE acalogos_app_prod FROM CURRENT_USER;

WITH app_role AS (
    SELECT oid
    FROM pg_catalog.pg_roles
    WHERE rolname = 'acalogos_app_prod'
)
SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN app_role
    WHERE membership.roleid = app_role.oid
       OR membership.member = app_role.oid
) AS memberships_cleared
\gset

\if :memberships_cleared
\else
\echo 'La provisión dejó membresías inesperadas. Se revierte la transacción.'
SELECT 1 / 0 AS unexpected_role_membership;
\endif

REVOKE ALL PRIVILEGES ON DATABASE neondb FROM acalogos_app_prod;
GRANT CONNECT ON DATABASE neondb TO acalogos_app_prod;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM acalogos_app_prod;
GRANT USAGE ON SCHEMA public TO acalogos_app_prod;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM acalogos_app_prod;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM acalogos_app_prod;

GRANT SELECT ON TABLE public.servicios TO acalogos_app_prod;
GRANT UPDATE (
    imagen,
    imagen_public_id,
    imagenes_adicionales,
    imagenes_adicionales_public_ids,
    updated_at
) ON TABLE public.servicios TO acalogos_app_prod;

ALTER ROLE acalogos_app_prod
    IN DATABASE neondb
    SET search_path = pg_catalog, public;

COMMIT;
\endif

-- Hardening global opt-in. Afecta a todos los roles de neondb, no solo al rol
-- de la aplicación. Ejecutar únicamente después de revisar el preflight y con
-- -v apply_global_hardening=true. Nunca habilitarlo junto con provision_role.
\if :apply_global_hardening
BEGIN;

REVOKE CREATE ON DATABASE neondb FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

COMMIT;
\endif
