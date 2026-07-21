\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

\if :{?expected_login}
\else
\echo 'Debe definir expected_login como true o false.'
\quit 1
\endif

\if :{?expected_contactos}
\else
\echo 'Debe definir expected_contactos como true o false.'
\quit 1
\endif

WITH
expected AS (
    SELECT
        :'expected_login'::boolean AS login_enabled,
        :'expected_contactos'::boolean AS contactos_exists
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
servicios_table AS (
    SELECT class_record.oid
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'servicios'
      AND class_record.relkind IN ('r', 'p')
),
servicios_sequence AS (
    SELECT class_record.oid
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'servicios_id_seq'
      AND class_record.relkind = 'S'
),
contactos_table AS (
    SELECT class_record.oid, class_record.relowner
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'contactos'
      AND class_record.relkind IN ('r', 'p')
),
role_search_path AS (
    SELECT
        pg_catalog.count(*) = 1
        AND pg_catalog.bool_and(setting.value = 'search_path=pg_catalog, public') AS is_exact
    FROM app_role
    JOIN pg_catalog.pg_database AS database_record
      ON database_record.datname = 'neondb'
    JOIN pg_catalog.pg_db_role_setting AS role_setting
      ON role_setting.setrole = app_role.oid
     AND role_setting.setdatabase = database_record.oid
    CROSS JOIN LATERAL pg_catalog.unnest(role_setting.setconfig) AS setting(value)
    WHERE setting.value LIKE 'search_path=%'
),
servicios_column_access AS (
    SELECT
        attribute.attname,
        pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'SELECT') AS can_select,
        pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'UPDATE') AS can_update,
        attribute.attname = ANY (ARRAY[
            'imagen',
            'imagen_public_id',
            'imagenes_adicionales',
            'imagenes_adicionales_public_ids',
            'updated_at'
        ]::name[]) AS update_expected
    FROM app_role
    CROSS JOIN servicios_table
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = servicios_table.oid
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
),
contactos_column_access AS (
    SELECT
        attribute.attname,
        pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'SELECT') AS can_select,
        pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'INSERT') AS can_insert,
        pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'UPDATE') AS can_update,
        pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'REFERENCES') AS can_reference,
        attribute.attname = 'id' AS select_expected,
        attribute.attname = ANY (ARRAY[
            'nombre',
            'email',
            'mensaje',
            'privacy_notice_version'
        ]::name[]) AS insert_expected
    FROM app_role
    CROSS JOIN contactos_table
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = contactos_table.oid
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
            COALESCE((SELECT pg_catalog.bool_and(can_select) FROM servicios_column_access), false),
        'servicios_update_columns_exact',
            COALESCE((SELECT pg_catalog.bool_and(can_update = update_expected) FROM servicios_column_access), false),
        'servicios_forbidden_table_privileges_absent',
            COALESCE((
                SELECT NOT (
                    pg_catalog.has_table_privilege(app_role.oid, servicios_table.oid, 'INSERT')
                    OR pg_catalog.has_table_privilege(app_role.oid, servicios_table.oid, 'DELETE')
                    OR pg_catalog.has_table_privilege(app_role.oid, servicios_table.oid, 'TRUNCATE')
                    OR pg_catalog.has_table_privilege(app_role.oid, servicios_table.oid, 'REFERENCES')
                    OR pg_catalog.has_table_privilege(app_role.oid, servicios_table.oid, 'TRIGGER')
                )
                FROM app_role
                CROSS JOIN servicios_table
            ), false),
        'sequence_privileges_absent',
            COALESCE((
                SELECT NOT (
                    pg_catalog.has_sequence_privilege(app_role.oid, servicios_sequence.oid, 'USAGE')
                    OR pg_catalog.has_sequence_privilege(app_role.oid, servicios_sequence.oid, 'SELECT')
                    OR pg_catalog.has_sequence_privilege(app_role.oid, servicios_sequence.oid, 'UPDATE')
                )
                FROM app_role
                CROSS JOIN servicios_sequence
            ), false),
        'contactos_table_exists',
            (EXISTS (SELECT 1 FROM contactos_table)) = (SELECT contactos_exists FROM expected),
        'contactos_insert_columns_exact',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((SELECT pg_catalog.bool_and(can_insert = insert_expected) FROM contactos_column_access), false),
        'contactos_select_id_only',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((SELECT pg_catalog.bool_and(can_select = select_expected) FROM contactos_column_access), false),
        'contactos_pii_select_absent',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((
                SELECT NOT pg_catalog.bool_or(can_select)
                FROM contactos_column_access
                WHERE attname <> 'id'
            ), false),
        'contactos_update_columns_absent',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((SELECT NOT pg_catalog.bool_or(can_update) FROM contactos_column_access), false),
        'contactos_references_columns_absent',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((SELECT NOT pg_catalog.bool_or(can_reference) FROM contactos_column_access), false),
        'contactos_forbidden_table_privileges_absent',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((
                SELECT NOT (
                    pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'SELECT')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'INSERT')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'UPDATE')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'DELETE')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'TRUNCATE')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'REFERENCES')
                    OR pg_catalog.has_table_privilege(app_role.oid, contactos_table.oid, 'TRIGGER')
                )
                FROM app_role
                CROSS JOIN contactos_table
            ), false),
        'contactos_zero_grant_options',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((
                SELECT NOT (
                    pg_catalog.has_table_privilege(
                        app_role.oid,
                        contactos_table.oid,
                        'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION,TRUNCATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION,TRIGGER WITH GRANT OPTION'
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM pg_catalog.pg_attribute AS attribute
                        WHERE attribute.attrelid = contactos_table.oid
                          AND attribute.attnum > 0
                          AND NOT attribute.attisdropped
                          AND (
                              pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'SELECT WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'INSERT WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'UPDATE WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'REFERENCES WITH GRANT OPTION')
                          )
                    )
                )
                FROM app_role
                CROSS JOIN contactos_table
            ), false),
        'contactos_not_owned_by_app_role',
            NOT (SELECT contactos_exists FROM expected)
            OR COALESCE((
                SELECT contactos_table.relowner <> app_role.oid
                FROM contactos_table
                CROSS JOIN app_role
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
                  AND class_record.oid <> COALESCE((SELECT oid FROM servicios_table), 0::oid)
                  AND class_record.oid <> COALESCE((SELECT oid FROM contactos_table), 0::oid)
                  AND (
                      pg_catalog.has_table_privilege(app_role.oid, class_record.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                      OR pg_catalog.has_any_column_privilege(app_role.oid, class_record.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
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
                  AND class_record.oid <> COALESCE((SELECT oid FROM servicios_sequence), 0::oid)
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
                        servicios_table.oid,
                        'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION,TRUNCATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION,TRIGGER WITH GRANT OPTION'
                    )
                    OR pg_catalog.has_sequence_privilege(
                        app_role.oid,
                        servicios_sequence.oid,
                        'USAGE WITH GRANT OPTION,SELECT WITH GRANT OPTION,UPDATE WITH GRANT OPTION'
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM pg_catalog.pg_attribute AS attribute
                        WHERE attribute.attrelid = servicios_table.oid
                          AND attribute.attnum > 0
                          AND NOT attribute.attisdropped
                          AND (
                              pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'SELECT WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'INSERT WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'UPDATE WITH GRANT OPTION')
                              OR pg_catalog.has_column_privilege(app_role.oid, servicios_table.oid, attribute.attnum, 'REFERENCES WITH GRANT OPTION')
                          )
                    )
                    OR (
                        (SELECT contactos_exists FROM expected)
                        AND NOT COALESCE((
                            SELECT NOT (
                                pg_catalog.has_table_privilege(
                                    app_role.oid,
                                    contactos_table.oid,
                                    'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION,TRUNCATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION,TRIGGER WITH GRANT OPTION'
                                )
                                OR EXISTS (
                                    SELECT 1
                                    FROM pg_catalog.pg_attribute AS attribute
                                    WHERE attribute.attrelid = contactos_table.oid
                                      AND attribute.attnum > 0
                                      AND NOT attribute.attisdropped
                                      AND (
                                          pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'SELECT WITH GRANT OPTION')
                                          OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'INSERT WITH GRANT OPTION')
                                          OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'UPDATE WITH GRANT OPTION')
                                          OR pg_catalog.has_column_privilege(app_role.oid, contactos_table.oid, attribute.attnum, 'REFERENCES WITH GRANT OPTION')
                                      )
                                )
                            )
                            FROM contactos_table
                        ), false)
                    )
                )
                FROM app_role
                CROSS JOIN servicios_table
                CROSS JOIN servicios_sequence
            ), false)
    ) AS check_values
),
report AS (
    SELECT pg_catalog.jsonb_build_object(
        'target_database', pg_catalog.current_database(),
        'expected_login', (SELECT login_enabled FROM expected),
        'expected_contactos', (SELECT contactos_exists FROM expected),
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
