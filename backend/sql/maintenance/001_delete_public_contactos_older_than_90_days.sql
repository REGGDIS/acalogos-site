\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

\if :{?apply_retention}
\else
\set apply_retention false
\endif

SELECT pg_catalog.current_database() = 'neondb' AS target_database_is_neondb
\gset

\if :target_database_is_neondb
\else
\echo 'La base de datos actual no es neondb. Ejecución detenida.'
SELECT 1 / 0 AS unexpected_target_database;
\endif

SELECT
    pg_catalog.pg_get_userbyid(class_record.relowner) = CURRENT_USER AS executed_by_table_owner
FROM pg_catalog.pg_class AS class_record
WHERE class_record.oid = pg_catalog.to_regclass('public.contactos')
  AND class_record.relkind = 'r'
\gset

\if :{?executed_by_table_owner}
\else
\echo 'La tabla public.contactos no existe. Ejecución detenida.'
SELECT 1 / 0 AS missing_contactos_table;
\endif

\if :executed_by_table_owner
\else
\echo 'La retención debe ejecutarla el owner de public.contactos. Ejecución detenida.'
SELECT 1 / 0 AS unexpected_retention_executor;
\endif

SELECT pg_catalog.jsonb_build_object(
    'database', pg_catalog.current_database(),
    'cutoff', now() - INTERVAL '90 days',
    'candidate_count', pg_catalog.count(*)
)::text
FROM public.contactos
WHERE created_at < now() - INTERVAL '90 days';

\if :apply_retention
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM public.contactos
WHERE created_at < now() - INTERVAL '90 days';

COMMIT;
\else
\echo 'Dry-run: no se eliminó ningún contacto. Use -v apply_retention=true para aplicar.'
\endif
