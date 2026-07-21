\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

WITH
target_table AS (
    SELECT class_record.oid, class_record.relowner
    FROM pg_catalog.pg_class AS class_record
    JOIN pg_catalog.pg_namespace AS namespace_record
      ON namespace_record.oid = class_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND class_record.relname = 'contactos'
      AND class_record.relkind IN ('r', 'p')
),
expected_columns (
    ordinal,
    column_name,
    data_type,
    not_null,
    default_expression,
    identity_generation
) AS (
    VALUES
        (1, 'id', 'uuid', true, 'gen_random_uuid()'::text, ''::text),
        (2, 'nombre', 'character varying(100)', true, NULL::text, ''::text),
        (3, 'email', 'character varying(254)', true, NULL::text, ''::text),
        (4, 'mensaje', 'character varying(4000)', true, NULL::text, ''::text),
        (5, 'privacy_notice_version', 'character varying(32)', true, NULL::text, ''::text),
        (6, 'created_at', 'timestamp with time zone', true, 'now()'::text, ''::text)
),
actual_columns AS (
    SELECT
        attribute.attnum::integer AS ordinal,
        attribute.attname::text AS column_name,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)::text AS data_type,
        attribute.attnotnull AS not_null,
        CASE
            WHEN attribute.attname = 'id'
             AND pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid)::text IN (
                 'gen_random_uuid()',
                 'pg_catalog.gen_random_uuid()'
             )
            THEN 'gen_random_uuid()'
            ELSE pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid)::text
        END AS default_expression,
        attribute.attidentity::text AS identity_generation
    FROM target_table
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = target_table.oid
    LEFT JOIN pg_catalog.pg_attrdef AS default_value
      ON default_value.adrelid = attribute.attrelid
     AND default_value.adnum = attribute.attnum
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
),
column_differences AS (
    (SELECT * FROM expected_columns EXCEPT SELECT * FROM actual_columns)
    UNION ALL
    (SELECT * FROM actual_columns EXCEPT SELECT * FROM expected_columns)
),
constraint_check AS (
    SELECT
        pg_catalog.count(*) = 1
        AND pg_catalog.bool_and(constraint_record.conname = 'contactos_pkey')
        AND pg_catalog.bool_and(constraint_record.contype = 'p')
        AND pg_catalog.bool_and(pg_catalog.pg_get_constraintdef(constraint_record.oid) = 'PRIMARY KEY (id)') AS ok
    FROM target_table
    JOIN pg_catalog.pg_constraint AS constraint_record
      ON constraint_record.conrelid = target_table.oid
),
index_check AS (
    SELECT
        pg_catalog.count(*) = 1
        AND pg_catalog.bool_and(index_relation.relname = 'contactos_pkey')
        AND pg_catalog.bool_and(access_method.amname = 'btree')
        AND pg_catalog.bool_and(index_record.indisunique)
        AND pg_catalog.bool_and(index_record.indisprimary)
        AND pg_catalog.bool_and(index_record.indisvalid)
        AND pg_catalog.bool_and(index_record.indnkeyatts = 1)
        AND pg_catalog.bool_and(index_record.indnatts = 1)
        AND pg_catalog.bool_and(index_record.indkey::text = '1')
        AND pg_catalog.bool_and(index_record.indexprs IS NULL)
        AND pg_catalog.bool_and(index_record.indpred IS NULL) AS ok
    FROM target_table
    JOIN pg_catalog.pg_index AS index_record
      ON index_record.indrelid = target_table.oid
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = index_record.indexrelid
    JOIN pg_catalog.pg_am AS access_method
      ON access_method.oid = index_relation.relam
),
checks (check_name, ok) AS (
    SELECT 'target_database_exact', pg_catalog.current_database() = 'neondb'
    UNION ALL
    SELECT 'postgresql_14', pg_catalog.current_setting('server_version_num')::integer BETWEEN 140000 AND 149999
    UNION ALL
    SELECT 'contactos_table_exists', EXISTS (SELECT 1 FROM target_table)
    UNION ALL
    SELECT 'columns_exact', NOT EXISTS (SELECT 1 FROM column_differences)
    UNION ALL
    SELECT 'ordinary_persistent_table', COALESCE((
        SELECT
            class_record.relkind = 'r'
            AND class_record.relpersistence = 'p'
            AND NOT class_record.relispartition
            AND NOT class_record.relrowsecurity
            AND NOT class_record.relforcerowsecurity
        FROM pg_catalog.pg_class AS class_record
        CROSS JOIN target_table
        WHERE class_record.oid = target_table.oid
    ), false)
    UNION ALL
    SELECT 'primary_key_exact', COALESCE((SELECT ok FROM constraint_check), false)
    UNION ALL
    SELECT 'index_exact', COALESCE((SELECT ok FROM index_check), false)
    UNION ALL
    SELECT 'no_associated_sequences', NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        JOIN pg_catalog.pg_class AS sequence_record
          ON sequence_record.oid = dependency.objid
         AND sequence_record.relkind = 'S'
        CROSS JOIN target_table
        WHERE dependency.refobjid = target_table.oid
    )
    UNION ALL
    SELECT 'no_user_triggers', NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger AS trigger_record
        CROSS JOIN target_table
        WHERE trigger_record.tgrelid = target_table.oid
          AND NOT trigger_record.tgisinternal
    )
    UNION ALL
    SELECT 'no_policies', NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy_record
        CROSS JOIN target_table
        WHERE policy_record.polrelid = target_table.oid
    )
    UNION ALL
    SELECT 'public_privileges_absent', COALESCE((
        SELECT NOT (
            pg_catalog.has_table_privilege('public', target_table.oid, 'SELECT')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'INSERT')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'UPDATE')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'DELETE')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'TRUNCATE')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'REFERENCES')
            OR pg_catalog.has_table_privilege('public', target_table.oid, 'TRIGGER')
            OR pg_catalog.has_any_column_privilege('public', target_table.oid, 'SELECT')
            OR pg_catalog.has_any_column_privilege('public', target_table.oid, 'INSERT')
            OR pg_catalog.has_any_column_privilege('public', target_table.oid, 'UPDATE')
            OR pg_catalog.has_any_column_privilege('public', target_table.oid, 'REFERENCES')
        )
        FROM target_table
    ), false)
    UNION ALL
    SELECT 'app_role_not_owner', COALESCE((
        SELECT target_table.relowner <> app_role.oid
        FROM target_table
        CROSS JOIN LATERAL pg_catalog.to_regrole('acalogos_app_prod') AS app_role(oid)
    ), false)
),
check_summary AS (
    SELECT
        pg_catalog.jsonb_object_agg(check_name, ok ORDER BY check_name) AS checks,
        pg_catalog.bool_and(ok) AS all_checks_passed
    FROM checks
)
SELECT pg_catalog.jsonb_build_object(
    'database', pg_catalog.current_database(),
    'server_version', pg_catalog.current_setting('server_version'),
    'checks', check_summary.checks,
    'all_checks_passed', check_summary.all_checks_passed
)::text
FROM check_summary;
