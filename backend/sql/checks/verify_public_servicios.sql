\if :{?expected_stage}
\else
    \echo 'Debe definir expected_stage como empty, base, final o contactos.'
    \quit 1
\endif

SELECT :'expected_stage' IN ('empty', 'base', 'final', 'contactos') AS valid_stage \gset

\if :valid_stage
\else
    \echo 'expected_stage debe ser empty, base, final o contactos.'
    \quit 1
\endif

SELECT :'expected_stage' = 'empty' AS expecting_empty \gset

\if :expecting_empty
    \set table_has_zero_rows true
\else
    SELECT NOT EXISTS (SELECT 1 FROM public.servicios) AS table_has_zero_rows \gset
\endif

WITH
parameters AS (
    SELECT
        :'expected_stage'::text AS expected_stage,
        CASE :'expected_stage'
            WHEN 'empty' THEN 0
            WHEN 'base' THEN 1
            WHEN 'final' THEN 2
            WHEN 'contactos' THEN 3
        END AS stage_rank
),
expected_columns (
    ordinal,
    column_name,
    data_type,
    not_null,
    default_expression,
    introduced_stage
) AS (
    VALUES
        (1, 'id', 'integer', true, '<servicios-sequence>'::text, 1),
        (2, 'nombre', 'text', true, NULL::text, 1),
        (3, 'descripcion', 'text', false, NULL::text, 1),
        (4, 'precio', 'text', false, NULL::text, 1),
        (5, 'categoria', 'text[]', false, NULL::text, 1),
        (6, 'imagen', 'text', false, NULL::text, 1),
        (7, 'imagenes_adicionales', 'text[]', false, NULL::text, 1),
        (8, 'created_at', 'timestamp with time zone', false, 'now()'::text, 1),
        (9, 'updated_at', 'timestamp with time zone', false, 'now()'::text, 1),
        (10, 'imagen_public_id', 'text', false, NULL::text, 2),
        (11, 'imagenes_adicionales_public_ids', 'jsonb', true, '''{}''::jsonb'::text, 2)
),
selected_expected_columns AS (
    SELECT
        expected.ordinal,
        expected.column_name,
        expected.data_type,
        expected.not_null,
        expected.default_expression
    FROM expected_columns AS expected
    CROSS JOIN parameters
    WHERE expected.introduced_stage <= parameters.stage_rank
),
actual_columns AS (
    SELECT
        attribute.attnum::integer AS ordinal,
        attribute.attname::text AS column_name,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)::text AS data_type,
        attribute.attnotnull AS not_null,
        CASE
            WHEN attribute.attname = 'id'
             AND pg_get_expr(default_value.adbin, default_value.adrelid) IN (
                 'nextval(''servicios_id_seq''::regclass)',
                 'nextval(''public.servicios_id_seq''::regclass)'
             ) THEN '<servicios-sequence>'
            ELSE pg_get_expr(default_value.adbin, default_value.adrelid)
        END::text AS default_expression
    FROM pg_catalog.pg_attribute AS attribute
    LEFT JOIN pg_catalog.pg_attrdef AS default_value
        ON default_value.adrelid = attribute.attrelid
       AND default_value.adnum = attribute.attnum
    WHERE attribute.attrelid = pg_catalog.to_regclass('public.servicios')
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
),
column_differences AS (
    (
        SELECT * FROM selected_expected_columns
        EXCEPT
        SELECT * FROM actual_columns
    )
    UNION ALL
    (
        SELECT * FROM actual_columns
        EXCEPT
        SELECT * FROM selected_expected_columns
    )
),
public_objects AS (
    SELECT COALESCE(
        array_agg(
            format('%s:%s', relation.relname, relation.relkind)
            ORDER BY relation.relname, relation.relkind
        ),
        ARRAY[]::text[]
    ) AS object_names
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'S', 'i')
),
primary_key_check AS (
    SELECT
        count(*) = 1
        AND bool_and(constraint_record.conname = 'servicios_pkey')
        AND bool_and(constraint_record.contype = 'p')
        AND bool_and(pg_get_constraintdef(constraint_record.oid) = 'PRIMARY KEY (id)') AS ok
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = pg_catalog.to_regclass('public.servicios')
),
index_check AS (
    SELECT
        count(*) = 1
        AND bool_and(index_relation.relname = 'servicios_pkey')
        AND bool_and(access_method.amname = 'btree')
        AND bool_and(index_record.indisunique)
        AND bool_and(index_record.indisprimary)
        AND bool_and(index_record.indisvalid)
        AND bool_and(index_record.indnkeyatts = 1)
        AND bool_and(index_record.indnatts = 1)
        AND bool_and(index_record.indkey::text = '1')
        AND bool_and(index_record.indexprs IS NULL)
        AND bool_and(index_record.indpred IS NULL) AS ok
    FROM pg_catalog.pg_index AS index_record
    JOIN pg_catalog.pg_class AS index_relation
        ON index_relation.oid = index_record.indexrelid
    JOIN pg_catalog.pg_class AS table_relation
        ON table_relation.oid = index_record.indrelid
    JOIN pg_catalog.pg_am AS access_method
        ON access_method.oid = index_relation.relam
    WHERE table_relation.oid = pg_catalog.to_regclass('public.servicios')
),
sequence_check AS (
    SELECT
        count(*) = 1
        AND bool_and(sequence_record.data_type = 'integer'::regtype)
        AND bool_and(sequence_record.start_value = 1)
        AND bool_and(sequence_record.min_value = 1)
        AND bool_and(sequence_record.max_value = 2147483647)
        AND bool_and(sequence_record.increment_by = 1)
        AND bool_and(sequence_record.cycle = false)
        AND bool_and(sequence_record.cache_size = 1) AS ok
    FROM pg_catalog.pg_sequences AS sequence_record
    WHERE sequence_record.schemaname = 'public'
      AND sequence_record.sequencename = 'servicios_id_seq'
),
sequence_state_visibility_check AS (
    SELECT COALESCE(
        has_sequence_privilege(
            current_user,
            pg_catalog.to_regclass('public.servicios_id_seq'),
            'USAGE'
        )
        OR has_sequence_privilege(
            current_user,
            pg_catalog.to_regclass('public.servicios_id_seq'),
            'SELECT'
        ),
        false
    ) AS ok
),
sequence_unused_check AS (
    SELECT
        count(*) = 1
        AND bool_and(sequence_record.last_value IS NULL) AS ok
    FROM pg_catalog.pg_sequences AS sequence_record
    WHERE sequence_record.schemaname = 'public'
      AND sequence_record.sequencename = 'servicios_id_seq'
),
sequence_ownership_check AS (
    SELECT count(*) = 1 AS ok
    FROM pg_catalog.pg_depend AS dependency
    JOIN pg_catalog.pg_class AS sequence_relation
        ON sequence_relation.oid = dependency.objid
    JOIN pg_catalog.pg_namespace AS sequence_namespace
        ON sequence_namespace.oid = sequence_relation.relnamespace
    JOIN pg_catalog.pg_class AS table_relation
        ON table_relation.oid = dependency.refobjid
    JOIN pg_catalog.pg_namespace AS table_namespace
        ON table_namespace.oid = table_relation.relnamespace
    JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = table_relation.oid
       AND attribute.attnum = dependency.refobjsubid
    WHERE dependency.classid = 'pg_catalog.pg_class'::regclass
      AND dependency.refclassid = 'pg_catalog.pg_class'::regclass
      AND dependency.deptype = 'a'
      AND sequence_namespace.nspname = 'public'
      AND sequence_relation.relname = 'servicios_id_seq'
      AND sequence_relation.relkind = 'S'
      AND table_namespace.nspname = 'public'
      AND table_relation.relname = 'servicios'
      AND attribute.attname = 'id'
),
tls_status AS (
    SELECT ssl, version, cipher
    FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_backend_pid()
),
checks (check_name, ok) AS (
    SELECT 'target_database', current_database() = 'neondb'
    UNION ALL
    SELECT 'postgresql_14', current_setting('server_version_num')::integer BETWEEN 140000 AND 149999
    UNION ALL
    SELECT 'public_schema_exists', pg_catalog.to_regnamespace('public') IS NOT NULL
    UNION ALL
    SELECT 'public_schema_usage', has_schema_privilege(current_user, 'public', 'USAGE')
    UNION ALL
    SELECT 'public_schema_create', has_schema_privilege(current_user, 'public', 'CREATE')
    UNION ALL
    SELECT 'no_backup_tables', NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname LIKE 'servicios_backup%'
    )
    UNION ALL
    SELECT 'expected_public_objects',
        public_objects.object_names = CASE
            WHEN parameters.stage_rank = 0 THEN ARRAY[]::text[]
            WHEN parameters.stage_rank IN (1, 2) THEN ARRAY[
                'servicios:r',
                'servicios_id_seq:S',
                'servicios_pkey:i'
            ]::text[]
            ELSE ARRAY[
                'contactos:r',
                'contactos_pkey:i',
                'servicios:r',
                'servicios_id_seq:S',
                'servicios_pkey:i'
            ]::text[]
        END
    FROM public_objects
    CROSS JOIN parameters
    UNION ALL
    SELECT 'columns_exact', NOT EXISTS (SELECT 1 FROM column_differences)
    UNION ALL
    SELECT 'ordinary_persistent_table', parameters.stage_rank = 0 OR EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        WHERE relation.oid = pg_catalog.to_regclass('public.servicios')
          AND relation.relkind = 'r'
          AND relation.relpersistence = 'p'
          AND NOT relation.relispartition
          AND NOT relation.relrowsecurity
    )
    FROM parameters
    UNION ALL
    SELECT 'primary_key_exact', parameters.stage_rank = 0 OR primary_key_check.ok
    FROM parameters
    CROSS JOIN primary_key_check
    UNION ALL
    SELECT 'index_exact', parameters.stage_rank = 0 OR index_check.ok
    FROM parameters
    CROSS JOIN index_check
    UNION ALL
    SELECT 'sequence_exact', parameters.stage_rank = 0 OR sequence_check.ok
    FROM parameters
    CROSS JOIN sequence_check
    UNION ALL
    SELECT 'sequence_state_visible', parameters.stage_rank = 0 OR sequence_state_visibility_check.ok
    FROM parameters
    CROSS JOIN sequence_state_visibility_check
    UNION ALL
    SELECT 'sequence_unused', parameters.stage_rank = 0 OR (
        sequence_state_visibility_check.ok AND sequence_unused_check.ok
    )
    FROM parameters
    CROSS JOIN sequence_state_visibility_check
    CROSS JOIN sequence_unused_check
    UNION ALL
    SELECT 'sequence_owned_by_id', parameters.stage_rank = 0 OR sequence_ownership_check.ok
    FROM parameters
    CROSS JOIN sequence_ownership_check
    UNION ALL
    SELECT 'no_user_triggers', parameters.stage_rank = 0 OR NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = pg_catalog.to_regclass('public.servicios')
          AND NOT trigger_record.tgisinternal
    )
    FROM parameters
    UNION ALL
    SELECT 'no_policies', parameters.stage_rank = 0 OR NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy_record
        WHERE policy_record.polrelid = pg_catalog.to_regclass('public.servicios')
    )
    FROM parameters
    UNION ALL
    SELECT 'no_inheritance', parameters.stage_rank = 0 OR NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_inherits AS inheritance_record
        WHERE inheritance_record.inhrelid = pg_catalog.to_regclass('public.servicios')
           OR inheritance_record.inhparent = pg_catalog.to_regclass('public.servicios')
    )
    FROM parameters
    UNION ALL
    SELECT 'cloudinary_comments_exact', parameters.stage_rank < 2 OR (
        pg_catalog.col_description(pg_catalog.to_regclass('public.servicios'), 10) =
            'Guarda el Public ID de Cloudinary asociado a imagen. Las rutas locales deben mantener NULL.'
        AND pg_catalog.col_description(pg_catalog.to_regclass('public.servicios'), 11) =
            'Guarda un objeto JSON cuya clave es la referencia exacta almacenada en imagenes_adicionales y cuyo valor es su Public ID de Cloudinary. Las rutas locales no deben tener entrada en este objeto JSON.'
    )
    FROM parameters
    UNION ALL
    SELECT 'table_has_zero_rows', :'table_has_zero_rows'::boolean
),
check_summary AS (
    SELECT
        pg_catalog.jsonb_object_agg(check_name, ok ORDER BY check_name) AS checks,
        bool_and(ok) AS all_checks_passed
    FROM checks
)
SELECT pg_catalog.jsonb_build_object(
    'stage', parameters.expected_stage,
    'database', current_database(),
    'server_version', current_setting('server_version'),
    'tls', pg_catalog.jsonb_build_object(
        'active', COALESCE(tls_status.ssl, false),
        'version', tls_status.version,
        'cipher', tls_status.cipher
    ),
    'checks', check_summary.checks,
    'all_checks_passed', check_summary.all_checks_passed
)::text
FROM parameters
CROSS JOIN check_summary
LEFT JOIN tls_status ON true;
