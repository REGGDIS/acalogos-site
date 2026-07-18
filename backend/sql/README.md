# Esquema PostgreSQL de Acalogos

Esta carpeta versiona únicamente el esquema activo de `public.servicios`. No contiene datos, valores de secuencia, tablas de respaldo ni imágenes.

## Estructura

- `migrations/001_create_public_servicios.sql`: crea la tabla base de nueve columnas, su secuencia serial y la clave primaria.
- `migrations/002_add_cloudinary_image_metadata.sql`: añade las dos columnas y comentarios de metadata Cloudinary.
- `rollbacks/002_add_cloudinary_image_metadata.sql`: revierte únicamente la segunda migración.

Los archivos de `rollbacks` nunca deben incluirse en un glob o bucle que aplique migraciones forward.

## Orden de aplicación

Los scripts forward se aplican una sola vez y en orden numérico sobre una base vacía:

```powershell
if ([string]::IsNullOrWhiteSpace($env:DIRECT_DATABASE_URL)) {
    throw "DIRECT_DATABASE_URL es requerida para aplicar el esquema."
}

try {
    # libpq acepta una connection string mediante PGDATABASE; no se pasa como argumento ni se imprime.
    $env:PGDATABASE = $env:DIRECT_DATABASE_URL

    psql -X -v ON_ERROR_STOP=1 -f backend/sql/migrations/001_create_public_servicios.sql
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la migración 001."
    }

    psql -X -v ON_ERROR_STOP=1 -f backend/sql/migrations/002_add_cloudinary_image_metadata.sql
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la migración 002."
    }
} finally {
    Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue
}
```

`001` falla intencionalmente si la tabla o la secuencia ya existen. No se debe usar para reconciliar una base con deriva de esquema.
`002` también es estricta: falla si alguna columna Cloudinary ya existe, evitando aceptar un estado parcial o inesperado.

## Referencia temporal desde PostgreSQL local

La referencia se genera fuera del repositorio y obtiene el usuario desde el entorno interno del contenedor, sin imprimir credenciales:

```powershell
$schemaSql = docker exec acalogos-postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d bd_acalogos --format=plain --schema-only --strict-names --table=public.servicios --exclude-table=public.servicios_backup_pre_cloudinary_20260716 --exclude-table=public.servicios_backup_pre_migration_apply_20260717 --no-owner --no-privileges --no-tablespaces --encoding=UTF8 --lock-wait-timeout=5s'
if ($LASTEXITCODE -ne 0) { throw "No se pudo extraer el esquema de public.servicios." }
$schemaSql | Set-Content -LiteralPath C:\tmp\public_servicios_schema.raw.sql -Encoding utf8NoBOM
```

La selección exacta `--table=public.servicios` y las exclusiones explícitas impiden incorporar las tablas de respaldo. El resultado debe revisarse antes de usarlo como referencia.

## Validación aislada con PostgreSQL 14

La reconstrucción se prueba en un contenedor efímero sin puerto publicado y nunca en `bd_acalogos`:

```powershell
$containerName = "acalogos-schema-verify"
$containerStarted = $false

try {
    docker run --detach --rm --name $containerName --env POSTGRES_PASSWORD=schema-validation-only postgres:14 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo iniciar el contenedor de validación."
    }
    $containerStarted = $true

    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        docker exec $containerName pg_isready -U postgres -d postgres | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }

        Start-Sleep -Milliseconds 500
    }

    if (-not $ready) {
        throw "PostgreSQL efímero no quedó listo dentro del tiempo esperado."
    }

    docker cp backend/sql/migrations/. "${containerName}:/tmp/migrations/"
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron copiar las migraciones forward."
    }

    docker exec $containerName psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/migrations/001_create_public_servicios.sql
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la validación de la migración 001."
    }

    docker exec $containerName psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/migrations/002_add_cloudinary_image_metadata.sql
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la validación de la migración 002."
    }
} finally {
    if ($containerStarted) {
        docker rm --force $containerName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "No se pudo eliminar automáticamente el contenedor efímero."
        }
    }
}
```

Comprobaciones mínimas después de `001`:

- nueve columnas en el orden versionado;
- `public.servicios_id_seq` propiedad de `public.servicios.id`;
- default `nextval` en `id`;
- `servicios_pkey PRIMARY KEY (id)` y su único índice;
- cero filas y ninguna tabla de respaldo.

Comprobaciones mínimas después de `002`:

- once columnas con los tipos, nulabilidad y defaults versionados;
- comentarios exactos en las dos columnas Cloudinary;
- ausencia de triggers de usuario, políticas RLS, herencia y objetos adicionales.

Para inspeccionar las columnas reconstruidas:

```sql
SELECT
    a.attnum AS ordinal,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(ad.adbin, ad.adrelid) AS default_expression,
    NULLIF(a.attidentity, '') AS identity_kind,
    col_description(a.attrelid, a.attnum) AS column_comment
FROM pg_attribute AS a
LEFT JOIN pg_attrdef AS ad
    ON ad.adrelid = a.attrelid
    AND ad.adnum = a.attnum
WHERE a.attrelid = 'public.servicios'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;
```

El bloque `finally` elimina el contenedor aunque falle la espera, la copia o cualquiera de las migraciones.

## Estado de la secuencia

El esquema define las propiedades de `public.servicios_id_seq`, pero no versiona `last_value`. Después de una futura migración de datos se deberá ajustar la secuencia al mayor `id` importado. Esta operación no forma parte de estos scripts.
