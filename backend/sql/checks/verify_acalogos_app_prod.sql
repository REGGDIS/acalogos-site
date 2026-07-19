\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Debe recibirse como -v expected_login=false antes de la activación o como
-- -v expected_login=true después de habilitar LOGIN.
\if :{?expected_login}
\else
\set expected_login missing
\endif

WITH
expected AS (
    SELECT :'expected_login'::boolean AS login_enabled
),
app_role AS (
    SELECT
        roles.oid,
        roles.rolcanlogin,
        roles.rolsuper,
        roles.rolinherit,
        roles.rolcreaterole,
        roles.rolcreatedb,
        roles.rolreplication,
        roles.rolbypassrls
    FROM pg_catalog.pg_roles AS roles
    WHERE roles.rolname = 'acalogos_app_prod'
),
target_table AS (
    SELECT class_record.oid
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'servicios'
      AND class_record.relkind IN ('r', 'p')
),
target_sequence AS (
    SELECT class_record.oid
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'servicios_id_seq'
      AND class_record.relkind = 'S'
),
role_search_path AS (
    SELECT
        pg_catalog.count(*) = 1
        AND pg_catalog.bool_and(
            setting.value = 'search_path=pg_catalog, public'
        ) AS is_exact
    FROM app_role
    JOIN pg_catalog.pg_database AS database_record
      ON database_record.datname = 'neondb'
    JOIN pg_catalog.pg_db_role_setting AS role_setting
      ON role_setting.setrole = app_role.oid
     AND role_setting.setdatabase = database_record.oid
    CROSS JOIN LATERAL pg_catalog.unnest(role_setting.setconfig) AS setting(value)
    WHERE setting.value LIKE 'search_path=%'
),
column_access AS (
    SELECT
        attribute.attname,
        pg_catalog.has_column_privilege(
            app_role.oid,
            target_table.oid,
            attribute.attnum,
            'SELECT'
        ) AS can_select,
        pg_catalog.has_column_privilege(
            app_role.oid,
            target_table.oid,
            attribute.attnum,
            'UPDATE'
        ) AS can_update,
        attribute.attname = ANY (ARRAY[
            'imagen',
            'imagen_public_id',
            'imagenes_adicionales',
            'imagenes_adicionales_public_ids',
            'updated_at'
        ]::name[]) AS update_expected
    FROM app_role
    CROSS JOIN target_table
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = target_table.oid
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
),
checks AS (
    SELECT pg_catalog.jsonb_build_object(
        'role_exists',
            EXISTS (SELECT 1 FROM app_role),
        'login_state_expected',
            COALESCE((SELECT rolcanlogin = expected.login_enabled FROM app_role CROSS JOIN expected), false),
        'role_attributes_restricted',
            COALESCE((
                SELECT
                    NOT rolsuper
                    AND NOT rolinherit
                    AND NOT rolcreaterole
                    AND NOT rolcreatedb
                    AND NOT rolreplication
                    AND NOT rolbypassrls
                FROM app_role
            ), false),
        'zero_memberships',
            NOT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_auth_members AS membership
                CROSS JOIN app_role
                WHERE membership.roleid = app_role.oid
                   OR membership.member = app_role.oid
            ),
        'zero_ownership',
            NOT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_shdepend AS dependency
                CROSS JOIN app_role
                WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
                  AND dependency.refobjid = app_role.oid
                  AND dependency.deptype = 'o'
            ),
        'target_database_exact',
            pg_catalog.current_database() = 'neondb',
        'database_connect_only',
            COALESCE((
                SELECT
                    pg_catalog.has_database_privilege(oid, 'neondb', 'CONNECT')
                    AND NOT pg_catalog.has_database_privilege(oid, 'neondb', 'CREATE')
                    AND NOT pg_catalog.has_database_privilege(oid, 'neondb', 'TEMPORARY')
                FROM app_role
            ), false),
        'public_schema_usage_only',
            COALESCE((
                SELECT
                    pg_catalog.has_schema_privilege(oid, 'public', 'USAGE')
                    AND NOT pg_catalog.has_schema_privilege(oid, 'public', 'CREATE')
                FROM app_role
            ), false),
        'search_path_exact',
            COALESCE((SELECT is_exact FROM role_search_path), false),
        'servicios_select_complete',
            COALESCE((SELECT pg_catalog.bool_and(can_select) FROM column_access), false),
        'servicios_update_columns_exact',
            COALESCE((SELECT pg_catalog.bool_and(can_update = update_expected) FROM column_access), false),
        'servicios_forbidden_table_privileges_absent',
            COALESCE((
                SELECT NOT (
                    pg_catalog.has_table_privilege(app_role.oid, target_table.oid, 'INSERT')
                    OR pg_catalog.has_table_privilege(app_role.oid, target_table.oid, 'DELETE')
                    OR pg_catalog.has_table_privilege(app_role.oid, target_table.oid, 'TRUNCATE')
                    OR pg_catalog.has_table_privilege(app_role.oid, target_table.oid, 'REFERENCES')
                    OR pg_catalog.has_table_privilege(app_role.oid, target_table.oid, 'TRIGGER')
                )
                FROM app_role
                CROSS JOIN target_table
            ), false),
        'sequence_privileges_absent',
            COALESCE((
                SELECT NOT (
                    pg_catalog.has_sequence_privilege(app_role.oid, target_sequence.oid, 'USAGE')
                    OR pg_catalog.has_sequence_privilege(app_role.oid, target_sequence.oid, 'SELECT')
                    OR pg_catalog.has_sequence_privilege(app_role.oid, target_sequence.oid, 'UPDATE')
                )
                FROM app_role
                CROSS JOIN target_sequence
            ), false),
        'other_public_relations_inaccessible',
            NOT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_class AS class_record
                JOIN pg_catalog.pg_namespace AS namespace_record
                  ON namespace_record.oid = class_record.relnamespace
                CROSS JOIN app_role
                WHERE namespace_record.nspname = 'public'
                  AND class_record.relkind IN ('r', 'p', 'v', 'm', 'f')
                  AND class_record.oid <> COALESCE((SELECT oid FROM target_table), 0::oid)
                  AND pg_catalog.has_table_privilege(
                      app_role.oid,
                      class_record.oid,
                      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
                  )
            )
            AND NOT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_class AS class_record
                JOIN pg_catalog.pg_namespace AS namespace_record
                  ON namespace_record.oid = class_record.relnamespace
                CROSS JOIN app_role
                WHERE namespace_record.nspname = 'public'
                  AND class_record.relkind = 'S'
                  AND class_record.oid <> COALESCE((SELECT oid FROM target_sequence), 0::oid)
                  AND (
                      pg_catalog.has_sequence_privilege(app_role.oid, class_record.oid, 'USAGE')
                      OR pg_catalog.has_sequence_privilege(app_role.oid, class_record.oid, 'SELECT')
                      OR pg_catalog.has_sequence_privilege(app_role.oid, class_record.oid, 'UPDATE')
                  )
            ),
        'zero_grant_options',
            COALESCE((
                SELECT NOT (
                    pg_catalog.has_database_privilege(app_role.oid, 'neondb', 'CONNECT WITH GRANT OPTION')
                    OR pg_catalog.has_database_privilege(app_role.oid, 'neondb', 'CREATE WITH GRANT OPTION')
                    OR pg_catalog.has_database_privilege(app_role.oid, 'neondb', 'TEMPORARY WITH GRANT OPTION')
                    OR pg_catalog.has_schema_privilege(app_role.oid, 'public', 'USAGE WITH GRANT OPTION')
                    OR pg_catalog.has_schema_privilege(app_role.oid, 'public', 'CREATE WITH GRANT OPTION')
                    OR pg_catalog.has_table_privilege(
                        app_role.oid,
                        target_table.oid,
                        'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION,TRUNCATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION,TRIGGER WITH GRANT OPTION'
                    )
                    OR pg_catalog.has_sequence_privilege(
                        app_role.oid,
                        target_sequence.oid,
                        'USAGE WITH GRANT OPTION,SELECT WITH GRANT OPTION,UPDATE WITH GRANT OPTION'
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM pg_catalog.pg_attribute AS attribute
                        WHERE attribute.attrelid = target_table.oid
                          AND attribute.attnum > 0
                          AND NOT attribute.attisdropped
                          AND (
                              pg_catalog.has_column_privilege(
                                  app_role.oid,
                                  target_table.oid,
                                  attribute.attnum,
                                  'SELECT WITH GRANT OPTION'
                              )
                              OR pg_catalog.has_column_privilege(
                                  app_role.oid,
                                  target_table.oid,
                                  attribute.attnum,
                                  'INSERT WITH GRANT OPTION'
                              )
                              OR pg_catalog.has_column_privilege(
                                  app_role.oid,
                                  target_table.oid,
                                  attribute.attnum,
                                  'UPDATE WITH GRANT OPTION'
                              )
                              OR pg_catalog.has_column_privilege(
                                  app_role.oid,
                                  target_table.oid,
                                  attribute.attnum,
                                  'REFERENCES WITH GRANT OPTION'
                              )
                          )
                    )
                )
                FROM app_role
                CROSS JOIN target_table
                CROSS JOIN target_sequence
            ), false)
    ) AS check_values
),
report AS (
    SELECT pg_catalog.jsonb_build_object(
        'target_database', pg_catalog.current_database(),
        'expected_login', (SELECT login_enabled FROM expected),
        'all_checks_passed', NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_each(checks.check_values) AS check_entry
            WHERE check_entry.value <> 'true'::jsonb
        ),
        'checks', checks.check_values
    ) AS value
    FROM checks
)
SELECT value
FROM report;
