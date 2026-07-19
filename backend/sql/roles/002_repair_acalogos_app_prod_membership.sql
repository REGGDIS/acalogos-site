\set ON_ERROR_STOP on

-- Guard fail-closed: la reparación solo corresponde a la base objetivo.
SELECT pg_catalog.current_database() = 'neondb' AS target_database_is_neondb
\gset

\if :target_database_is_neondb
\else
\echo 'La base de datos actual no es neondb. Ejecución detenida.'
SELECT 1 / 0 AS unexpected_target_database;
\endif

-- La única topología reparable es una membresía entrante cuyo único miembro
-- sea CURRENT_USER. Cualquier membresía saliente o de terceros detiene el script.
WITH
app_role AS (
    SELECT oid
    FROM pg_catalog.pg_roles
    WHERE rolname = 'acalogos_app_prod'
),
current_executor AS (
    SELECT oid
    FROM pg_catalog.pg_roles
    WHERE rolname = CURRENT_USER
),
related_memberships AS (
    SELECT membership.roleid, membership.member
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN app_role
    WHERE membership.roleid = app_role.oid
       OR membership.member = app_role.oid
)
SELECT
    EXISTS (SELECT 1 FROM app_role) AS role_exists,
    NOT EXISTS (SELECT 1 FROM related_memberships) AS memberships_already_clean,
    COALESCE((
        SELECT
            pg_catalog.count(*) = 1
            AND pg_catalog.bool_and(
                related_memberships.roleid = app_role.oid
                AND related_memberships.member = current_executor.oid
            )
        FROM related_memberships
        CROSS JOIN app_role
        CROSS JOIN current_executor
    ), false) AS current_user_is_only_member
\gset

\if :role_exists
\else
\echo 'El rol acalogos_app_prod no existe. No se aplicó ninguna reparación.'
SELECT 1 / 0 AS missing_application_role;
\endif

\if :memberships_already_clean
\echo 'acalogos_app_prod ya tiene cero membresías. No se requieren cambios.'
\else
\if :current_user_is_only_member
BEGIN;

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
) AS membership_repaired
\gset

\if :membership_repaired
COMMIT;
\else
\echo 'La reparación no dejó el rol sin membresías. Se revierte la transacción.'
SELECT 1 / 0 AS membership_repair_failed;
\endif
\else
\echo 'La membresía no pertenece exclusivamente a CURRENT_USER. No se aplicaron cambios.'
SELECT 1 / 0 AS unexpected_membership_topology;
\endif
\endif
