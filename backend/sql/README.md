# Esquema PostgreSQL de Acalogos

Esta carpeta versiona únicamente el esquema activo de `public.servicios`. No contiene datos, valores de secuencia, tablas de respaldo ni imágenes.

## Estructura

- `migrations/001_create_public_servicios.sql`: crea la tabla base de nueve columnas, su secuencia serial y la clave primaria.
- `migrations/002_add_cloudinary_image_metadata.sql`: añade las dos columnas y comentarios de metadata Cloudinary.
- `checks/verify_public_servicios.sql`: comprueba los estados `empty`, `base` y `final` sin modificar la base.
- `roles/001_create_acalogos_app_prod.sql`: prepara el rol mínimo de producción mediante modos opt-in.
- `roles/002_repair_acalogos_app_prod_membership.sql`: elimina de forma acotada una membresía administrativa automática del rol ya creado.
- `checks/verify_acalogos_app_prod.sql`: comprueba los privilegios efectivos del rol sin modificar la base.
- `rollbacks/002_add_cloudinary_image_metadata.sql`: revierte únicamente la segunda migración.

Los archivos de `rollbacks` nunca deben incluirse en un glob o bucle que aplique migraciones forward.

## Aplicación segura en Neon

En Neon Console, abre **Connect** y selecciona explícitamente la rama `main`, la base `neondb` y el rol que será propietario del esquema. Copia primero la URL con pooling activado para la aplicación; su hostname debe contener `-pooler`. Después desactiva pooling y copia la URL directa para DDL. La rama se confirma en la consola: el nombre de la rama Neon no está disponible mediante los catálogos estándar de PostgreSQL.

Las URLs se mantienen solamente en el proceso actual de PowerShell. No se guardan en `.env`, archivos auxiliares ni argumentos de comandos. La siguiente función valida la URL y cambia únicamente el parámetro `sslmode`, por lo que conserva literalmente `channel_binding=require` y el resto de la cadena:

```powershell
function ConvertTo-VerifyFull {
    param(
        [Parameter(Mandatory)]
        [string] $Value
    )

    $normalized = $Value.Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw "La URL de PostgreSQL está vacía."
    }

    $uri = $null
    if (-not [Uri]::TryCreate($normalized, [UriKind]::Absolute, [ref] $uri)) {
        throw "La URL de PostgreSQL no es válida."
    }

    if (@('postgres', 'postgresql') -notcontains $uri.Scheme) {
        throw "La URL debe usar el protocolo postgres:// o postgresql://."
    }

    if ([string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "La URL de PostgreSQL no contiene un host."
    }

    $databaseName = [Uri]::UnescapeDataString($uri.AbsolutePath).Trim('/')
    if ([string]::IsNullOrWhiteSpace($databaseName)) {
        throw "La URL de PostgreSQL no contiene una base de datos."
    }

    if (-not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw "La URL de PostgreSQL no debe contener un fragmento."
    }

    $sslModePattern = '(?i)([?&])sslmode=[^&#]*'
    $sslModeRegex = [regex]::new($sslModePattern)
    $sslModeMatches = $sslModeRegex.Matches($normalized)
    if ($sslModeMatches.Count -gt 1) {
        throw "La URL contiene sslmode más de una vez."
    }

    if ($sslModeMatches.Count -eq 1) {
        $result = $sslModeRegex.Replace($normalized, '${1}sslmode=verify-full', 1)
    } else {
        $separator = if ($normalized.Contains('?')) { '&' } else { '?' }
        $result = "${normalized}${separator}sslmode=verify-full"
    }

    $verifyFullMatches = [regex]::Matches(
        $result,
        '(?i)(?:[?&])sslmode=verify-full(?=&|$)'
    )
    if ($verifyFullMatches.Count -ne 1) {
        throw "No se pudo establecer sslmode=verify-full de forma segura."
    }

    return $result
}
```

El bloque integrado de aplicación solicita copiar cada URL, ejecuta `Get-Clipboard` dentro de un `try` y limpia el portapapeles tanto después de cada lectura como en el `finally` exterior. Para mostrar solamente la presencia de las variables, sin revelar sus valores, se usa esta función:

```powershell
function Show-ConnectionVariablePresence {
    'DATABASE_URL', 'DIRECT_DATABASE_URL' | ForEach-Object {
        [pscustomobject]@{
            Variable = $_
            TieneValor = -not [string]::IsNullOrWhiteSpace(
                [Environment]::GetEnvironmentVariable($_, 'Process')
            )
        }
    }
}
```

Valida también el destino mediante booleanos. Este bloque no imprime host, usuario, contraseña ni URL:

```powershell
function Test-ExactQueryParameter {
    param(
        [Parameter(Mandatory)] [string] $Url,
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [string] $ExpectedValue
    )

    $anyValuePattern = '(?i)(?:[?&])' + [regex]::Escape($Name) + '=[^&#]*(?=&|$)'
    $expectedPattern = '(?i)(?:[?&])' + [regex]::Escape($Name) + '=' +
        [regex]::Escape($ExpectedValue) + '(?=&|$)'
    $allMatches = [regex]::Matches($Url, $anyValuePattern)

    return $allMatches.Count -eq 1 -and [regex]::IsMatch($Url, $expectedPattern)
}

function Assert-NeonConnectionUrls {
    if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL) -or
        [string]::IsNullOrWhiteSpace($env:DIRECT_DATABASE_URL)) {
        throw "DATABASE_URL y DIRECT_DATABASE_URL deben tener valor."
    }

    $pooledUri = $null
    $directUri = $null
    $pooledUriValid = [Uri]::TryCreate(
        $env:DATABASE_URL,
        [UriKind]::Absolute,
        [ref] $pooledUri
    )
    $directUriValid = [Uri]::TryCreate(
        $env:DIRECT_DATABASE_URL,
        [UriKind]::Absolute,
        [ref] $directUri
    )
    if (-not $pooledUriValid -or -not $directUriValid) {
        throw "Las URLs de PostgreSQL no son válidas."
    }

    $pooledChannelBindingCount = [regex]::Matches(
        $env:DATABASE_URL,
        '(?i)(?:[?&])channel_binding=[^&#]*(?=&|$)'
    ).Count
    $directChannelBindingCount = [regex]::Matches(
        $env:DIRECT_DATABASE_URL,
        '(?i)(?:[?&])channel_binding=[^&#]*(?=&|$)'
    ).Count

    $urlChecks = [ordered]@{
        DatabaseUrlPresente = -not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)
        DirectUrlPresente = -not [string]::IsNullOrWhiteSpace($env:DIRECT_DATABASE_URL)
        DatabaseUrlProtocolValido = @('postgres', 'postgresql') -contains $pooledUri.Scheme
        DirectUrlProtocolValido = @('postgres', 'postgresql') -contains $directUri.Scheme
        DatabaseUrlHostPresente = -not [string]::IsNullOrWhiteSpace($pooledUri.Host)
        DirectUrlHostPresente = -not [string]::IsNullOrWhiteSpace($directUri.Host)
        DatabaseUrlVerifyFull = Test-ExactQueryParameter $env:DATABASE_URL 'sslmode' 'verify-full'
        DirectUrlVerifyFull = Test-ExactQueryParameter $env:DIRECT_DATABASE_URL 'sslmode' 'verify-full'
        DatabaseUrlNeondb = [Uri]::UnescapeDataString($pooledUri.AbsolutePath).Trim('/') -eq 'neondb'
        DirectUrlNeondb = [Uri]::UnescapeDataString($directUri.AbsolutePath).Trim('/') -eq 'neondb'
        DatabaseUrlPooled = $pooledUri.Host -like '*-pooler.*'
        DirectUrlNoPooled = $directUri.Host -notlike '*-pooler.*'
        MismoEndpoint = ($pooledUri.Host -replace '(?i)-pooler(?=\.)', '') -eq $directUri.Host
        DatabaseUrlChannelBindingValido = $pooledChannelBindingCount -eq 0 -or
            (Test-ExactQueryParameter $env:DATABASE_URL 'channel_binding' 'require')
        DirectUrlChannelBindingValido = $directChannelBindingCount -eq 0 -or
            (Test-ExactQueryParameter $env:DIRECT_DATABASE_URL 'channel_binding' 'require')
    }

    $urlChecks.GetEnumerator() | ForEach-Object {
        [pscustomobject]@{ Comprobacion = $_.Key; Correcta = $_.Value }
    }

    $failedUrlChecks = @($urlChecks.GetEnumerator() | Where-Object { -not $_.Value })
    if ($failedUrlChecks.Count -gt 0) {
        throw "La configuración de las URLs no superó todas las comprobaciones."
    }
}
```

Neon entrega normalmente `sslmode=require`; este proyecto exige sustituirlo por `sslmode=verify-full`, que valida también la CA y el hostname. No elimines `channel_binding=require`. La URL directa, nunca la pooled, será la conexión administrativa.

Referencias: [conexión con `psql` en Neon](https://neon.com/docs/connect/query-with-psql-editor), [pooling de Neon](https://neon.com/docs/connect/connection-pooling) y [seguridad TLS de Neon](https://neon.com/docs/security/security-overview).

### Preflight y aplicación

El wrapper de validación ejecuta el archivo de checks, analiza su único resultado JSON y falla si alguna comprobación estructural es falsa. El informe contiene etapa, base, versión PostgreSQL, una observación informativa de `pg_stat_ssl` y veinte comprobaciones booleanas. La observación TLS no participa en `all_checks_passed`: en Neon, el proxy puede terminar TLS antes de la sesión visible para PostgreSQL. La garantía TLS principal es la validación del cliente mediante `sslmode=verify-full` antes de ejecutar este archivo.

```powershell
function Invoke-ServiciosSchemaCheck {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('empty', 'base', 'final')]
        [string] $Stage,

        [Parameter(Mandatory)]
        [string] $SqlRoot
    )

    $checkFile = Join-Path $SqlRoot 'checks\verify_public_servicios.sql'
    $rawReport = & psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
        -v "expected_stage=$Stage" -f $checkFile
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo comprobar el estado $Stage del esquema."
    }

    try {
        $report = ($rawReport -join "`n") | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "La comprobación del esquema no devolvió un informe válido."
    }

    $expectedCheckKeys = @(
        'cloudinary_comments_exact'
        'columns_exact'
        'expected_public_objects'
        'index_exact'
        'no_backup_tables'
        'no_inheritance'
        'no_policies'
        'no_user_triggers'
        'ordinary_persistent_table'
        'postgresql_14'
        'primary_key_exact'
        'public_schema_create'
        'public_schema_exists'
        'public_schema_usage'
        'sequence_exact'
        'sequence_owned_by_id'
        'sequence_state_visible'
        'sequence_unused'
        'table_has_zero_rows'
        'target_database'
    )

    $stageProperty = $report.PSObject.Properties['stage']
    $allChecksProperty = $report.PSObject.Properties['all_checks_passed']
    $checksProperty = $report.PSObject.Properties['checks']
    if ($null -eq $stageProperty -or
        $stageProperty.Value -isnot [string] -or
        $stageProperty.Value -cne $Stage) {
        throw "El informe no corresponde a la etapa solicitada."
    }

    if ($null -eq $allChecksProperty -or $allChecksProperty.Value -isnot [bool]) {
        throw "all_checks_passed no es un booleano válido."
    }

    if ($null -eq $checksProperty -or
        $null -eq $checksProperty.Value -or
        $checksProperty.Value -isnot [System.Management.Automation.PSCustomObject]) {
        throw "El informe no contiene un objeto checks válido."
    }

    $checkProperties = @($checksProperty.Value.PSObject.Properties)
    $actualCheckKeys = @($checkProperties | ForEach-Object Name)
    $missingCheckKeys = @($expectedCheckKeys | Where-Object { $_ -notin $actualCheckKeys })
    if ($missingCheckKeys.Count -gt 0) {
        throw "El informe no contiene todas las comprobaciones esperadas."
    }

    $nonBooleanChecks = @($checkProperties | Where-Object { $_.Value -isnot [bool] })
    if ($nonBooleanChecks.Count -gt 0) {
        throw "El informe contiene comprobaciones que no son booleanas."
    }

    $report | ConvertTo-Json -Depth 4
    if (-not $report.all_checks_passed) {
        $failedChecks = @(
            $report.checks.PSObject.Properties |
                Where-Object { -not $_.Value } |
                ForEach-Object Name
        )
        throw "Fallaron comprobaciones del esquema: $($failedChecks -join ', ')."
    }
}
```

Ejecuta el bloque desde la raíz del repositorio y sigue sus dos avisos para copiar primero la URL pooled y después la directa. La carga, validación y aplicación completas quedan dentro del mismo `try`; `PGDATABASE` contiene temporalmente la URL directa y la cadena nunca se pasa como argumento ni se imprime:

```powershell
$pooledRaw = $null
$directRaw = $null
$sqlRoot = (Resolve-Path '.\backend\sql').Path
$previousPgDatabase = [Environment]::GetEnvironmentVariable('PGDATABASE', 'Process')
$previousTimeout = [Environment]::GetEnvironmentVariable('PGCONNECT_TIMEOUT', 'Process')

try {
    Read-Host 'Copia desde Neon la URL pooled y pulsa Enter' | Out-Null
    $pooledRaw = Get-Clipboard -Raw
    $env:DATABASE_URL = ConvertTo-VerifyFull $pooledRaw
    $pooledRaw = $null
    Set-Clipboard -Value ''

    Read-Host 'Copia desde Neon la URL directa y pulsa Enter' | Out-Null
    $directRaw = Get-Clipboard -Raw
    $env:DIRECT_DATABASE_URL = ConvertTo-VerifyFull $directRaw
    $directRaw = $null
    Set-Clipboard -Value ''

    Show-ConnectionVariablePresence
    Assert-NeonConnectionUrls

    $env:PGDATABASE = $env:DIRECT_DATABASE_URL
    $env:PGCONNECT_TIMEOUT = '10'

    & psql --version
    if ($LASTEXITCODE -ne 0) {
        throw "psql no está disponible."
    }

    Invoke-ServiciosSchemaCheck -Stage empty -SqlRoot $sqlRoot

    & psql -X -w -v ON_ERROR_STOP=1 `
        -f (Join-Path $sqlRoot 'migrations\001_create_public_servicios.sql')
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la migración 001."
    }

    Invoke-ServiciosSchemaCheck -Stage base -SqlRoot $sqlRoot

    & psql -X -w -v ON_ERROR_STOP=1 `
        -f (Join-Path $sqlRoot 'migrations\002_add_cloudinary_image_metadata.sql')
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la migración 002."
    }

    Invoke-ServiciosSchemaCheck -Stage final -SqlRoot $sqlRoot
} finally {
    $pooledRaw = $null
    $directRaw = $null

    if ($null -eq $previousPgDatabase) {
        Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue
    } else {
        $env:PGDATABASE = $previousPgDatabase
    }

    if ($null -eq $previousTimeout) {
        Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    } else {
        $env:PGCONNECT_TIMEOUT = $previousTimeout
    }

    Remove-Item Env:DATABASE_URL, Env:DIRECT_DATABASE_URL -ErrorAction SilentlyContinue
    Set-Clipboard -Value '' -ErrorAction SilentlyContinue
}
```

`-X` ignora archivos `psqlrc`, `-w` impide prompts de contraseña y `ON_ERROR_STOP=1` detiene cada script ante el primer error. El preflight `empty` confirma `neondb`, PostgreSQL 14, permisos sobre `public` y ausencia de tablas o secuencias antes de ejecutar DDL. TLS se exige en el cliente mediante `sslmode=verify-full`; el valor de `pg_stat_ssl` se conserva en el informe solo como diagnóstico y puede ser `false` detrás del proxy de Neon.

`PGDATABASE` acepta los mismos parámetros que `dbname`, por lo que puede contener temporalmente la URI sin pasarla en la línea de comandos. Consulta [variables de entorno de libpq](https://www.postgresql.org/docs/14/libpq-envars.html), [`psql` 14](https://www.postgresql.org/docs/14/app-psql.html) y [`pg_stat_ssl`](https://www.postgresql.org/docs/14/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW).

`001` falla intencionalmente si la tabla o la secuencia ya existen. No se debe usar para reconciliar una base con deriva de esquema.
`002` también es estricta: falla si alguna columna Cloudinary ya existe, evitando aceptar un estado parcial o inesperado.

### Recuperación

- Si falla `empty`, no ejecutes migraciones.
- Si falla `001`, su transacción se revierte. Repite el check `empty` y no continúes con `002`.
- Si falla el check `base`, conserva el estado y detén el procedimiento para diagnosticarlo.
- Si falla `002`, su transacción se revierte y `001` permanece aplicada. Ejecuta el check `base`; después de corregir la causa, repite únicamente `002`.
- No ejecutes el rollback de `002` después de un fallo de `002`: la transacción ya habrá revertido sus cambios.
- Si falla `final`, no despliegues la aplicación ni importes datos. El rollback requiere aprobación explícita y solo corresponde si el problema está limitado a las columnas Cloudinary.
- No automatices `DROP TABLE`. Volver a una base vacía es una operación destructiva separada.

El `finally` exterior elimina las URLs del proceso, limpia el portapapeles y restaura `PGDATABASE` y `PGCONNECT_TIMEOUT` incluso si falla la lectura, la validación, `psql` o una migración.

## Rol mínimo de la aplicación

El backend de producción debe conectarse como `acalogos_app_prod` mediante una URL pooled. El rol owner y `DIRECT_DATABASE_URL` quedan reservados para migraciones y tareas administrativas. El archivo `roles/001_create_acalogos_app_prod.sql` no contiene contraseña y es seguro por defecto: si se ejecuta sin variables, solo muestra el preflight de lectura.

`acalogos_app_prod` debe crearse con el SQL versionado desde una conexión directa del owner; no uses **Add role**, porque omitiría la configuración y las comprobaciones del script. En Neon se observó que el creador puede quedar como miembro administrativo del nuevo rol, relación que `001` elimina explícitamente.

### Preflight de solo lectura

Con la URL directa del owner cargada únicamente en `PGDATABASE`, ejecuta desde la raíz del repositorio:

```powershell
& psql -X -w -v ON_ERROR_STOP=1 `
    -f '.\backend\sql\roles\001_create_acalogos_app_prod.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'Falló el preflight del rol de aplicación.'
}
```

Revisa antes de continuar:

- qué privilegios `CREATE` y `TEMPORARY` recibe `PUBLIC`;
- qué roles con login los tienen de forma efectiva;
- qué roles pueden crear objetos en `public`;
- quién posee `neondb`, `public`, `servicios` y `servicios_id_seq`.

La salida contiene nombres de roles y objetos, pero no URLs, contraseñas ni ACL completas. No habilites ningún modo hasta confirmar que revocar privilegios a `PUBLIC` no afectará integraciones legítimas.

### Creación `NOLOGIN` y grants

La provisión es explícita y está separada del hardening global:

```powershell
& psql -X -w -v ON_ERROR_STOP=1 `
    -v provision_role=true `
    -f '.\backend\sql\roles\001_create_acalogos_app_prod.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'Falló la provisión del rol de aplicación.'
}
```

Este modo crea el rol como `NOLOGIN`, sin contraseña ni membresías. Neon puede añadir al creador como miembro administrativo del nuevo rol; por eso la misma transacción ejecuta `REVOKE acalogos_app_prod FROM CURRENT_USER` y exige que no quede ninguna membresía entrante ni saliente. Si la comprobación falla, se revierte toda la provisión. El script no depende del nombre del owner.

La provisión concede solamente `CONNECT` en `neondb`, `USAGE` en `public`, `SELECT` en `public.servicios` y `UPDATE` sobre las cinco columnas usadas por la gestión de imágenes. No concede permisos sobre `public.servicios_id_seq`.

La provisión falla intencionalmente si el rol ya existe. No la repitas a ciegas: ejecuta primero el check y diagnostica el estado existente.

### Reparación de una membresía ya existente

Si `acalogos_app_prod` ya fue provisionado y el check muestra `zero_memberships=false`, inspecciona primero `pg_auth_members`. El script `002_repair_acalogos_app_prod_membership.sql` solo acepta uno de estos estados:

- cero membresías, que produce un no-op exitoso;
- una única membresía entrante donde `CURRENT_USER` es miembro de `acalogos_app_prod`, que se revoca dentro de una transacción.

Ejecuta la reparación exclusivamente mediante la conexión directa del miembro confirmado. En Neon, para la relación observada, debe ser `neondb_owner`:

```powershell
& psql -X -w -v ON_ERROR_STOP=1 `
    -f '.\backend\sql\roles\002_repair_acalogos_app_prod_membership.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'Falló la reparación de la membresía del rol de aplicación.'
}
```

El script falla antes de mutar si el rol no existe, si lo ejecuta un administrador distinto del miembro actual, si hay más de una relación o si existe una membresía saliente. No concede membresías, no usa `CASCADE` y no cambia privilegios, ownership, hardening, contraseña ni `LOGIN`.

Antes del hardening, vuelve a ejecutar `checks/verify_acalogos_app_prod.sql` con `-v expected_login=false`. Debe cumplirse `zero_memberships=true`; las únicas comprobaciones falsas esperadas son `database_connect_only` y `public_schema_usage_only`, debido a los privilegios heredados de `PUBLIC`. Cualquier otra diferencia detiene el procedimiento:

```powershell
function Assert-AppRoleReport {
    param(
        [Parameter(Mandatory)] [object] $Report,
        [Parameter(Mandatory)] [bool] $ExpectedLogin,
        [string[]] $AllowedFailedChecks = @()
    )

    $expectedCheckKeys = @(
        'database_connect_only'
        'login_state_expected'
        'other_public_relations_inaccessible'
        'public_schema_usage_only'
        'role_attributes_restricted'
        'role_exists'
        'search_path_exact'
        'sequence_privileges_absent'
        'servicios_forbidden_table_privileges_absent'
        'servicios_select_complete'
        'servicios_update_columns_exact'
        'target_database_exact'
        'zero_grant_options'
        'zero_memberships'
        'zero_ownership'
    )

    $allowedFailures = @($AllowedFailedChecks | Sort-Object -Unique)
    if ($allowedFailures.Count -ne $AllowedFailedChecks.Count -or
        @($allowedFailures | Where-Object { $_ -notin $expectedCheckKeys }).Count -gt 0) {
        throw 'La lista de fallos permitidos no es válida.'
    }

    $targetDatabaseProperty = $Report.PSObject.Properties['target_database']
    $expectedLoginProperty = $Report.PSObject.Properties['expected_login']
    $allChecksProperty = $Report.PSObject.Properties['all_checks_passed']
    $checksProperty = $Report.PSObject.Properties['checks']

    if ($null -eq $targetDatabaseProperty -or
        $targetDatabaseProperty.Value -isnot [string] -or
        $targetDatabaseProperty.Value -cne 'neondb') {
        throw 'El informe no corresponde a la base neondb.'
    }

    if ($null -eq $expectedLoginProperty -or
        $expectedLoginProperty.Value -isnot [bool] -or
        $expectedLoginProperty.Value -ne $ExpectedLogin) {
        throw 'El informe no corresponde al estado LOGIN solicitado.'
    }

    if ($null -eq $allChecksProperty -or
        $allChecksProperty.Value -isnot [bool]) {
        throw 'all_checks_passed no es un booleano válido.'
    }

    $expectedAllChecksPassed = $allowedFailures.Count -eq 0
    if ($allChecksProperty.Value -ne $expectedAllChecksPassed) {
        throw 'all_checks_passed no coincide con los fallos permitidos.'
    }

    if ($null -eq $checksProperty -or
        $null -eq $checksProperty.Value -or
        $checksProperty.Value -isnot [System.Management.Automation.PSCustomObject]) {
        throw 'El informe no contiene un objeto checks válido.'
    }

    $checkProperties = @($checksProperty.Value.PSObject.Properties)
    $actualCheckKeys = @($checkProperties | ForEach-Object Name)
    $missingCheckKeys = @($expectedCheckKeys | Where-Object { $_ -notin $actualCheckKeys })
    $unexpectedCheckKeys = @($actualCheckKeys | Where-Object { $_ -notin $expectedCheckKeys })
    if ($missingCheckKeys.Count -gt 0 -or $unexpectedCheckKeys.Count -gt 0) {
        throw 'El informe no contiene exactamente las comprobaciones esperadas.'
    }

    $nonBooleanChecks = @($checkProperties | Where-Object { $_.Value -isnot [bool] })
    if ($nonBooleanChecks.Count -gt 0) {
        throw 'El informe contiene comprobaciones que no son booleanas.'
    }

    if ($checksProperty.Value.zero_memberships -ne $true) {
        throw 'acalogos_app_prod todavía tiene membresías.'
    }

    $failedChecks = @(
        $checkProperties |
            Where-Object { -not $_.Value } |
            ForEach-Object Name |
            Sort-Object
    )
    if (@(Compare-Object $failedChecks $allowedFailures).Count -gt 0) {
        throw 'El informe contiene fallos distintos de los permitidos.'
    }
}

$repairCheckRaw = & psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
    -v expected_login=false `
    -f '.\backend\sql\checks\verify_acalogos_app_prod.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo verificar el rol después de reparar la membresía.'
}

$repairReport = ($repairCheckRaw -join "`n") |
    ConvertFrom-Json -ErrorAction Stop
Assert-AppRoleReport `
    -Report $repairReport `
    -ExpectedLogin $false `
    -AllowedFailedChecks @(
        'database_connect_only'
        'public_schema_usage_only'
    )
```

### Hardening global

PostgreSQL 14 puede conceder mediante `PUBLIC` privilegios que no se eliminan revocándolos solo a `acalogos_app_prod`. El bloque opt-in revoca:

- `CREATE` sobre `neondb` a `PUBLIC`;
- `TEMPORARY` sobre `neondb` a `PUBLIC`;
- `CREATE` sobre el esquema `public` a `PUBLIC`.

Estas revocaciones afectan a **todos** los roles de la base. Aplícalas únicamente después de revisar y aprobar el preflight:

```powershell
& psql -X -w -v ON_ERROR_STOP=1 `
    -v apply_global_hardening=true `
    -f '.\backend\sql\roles\001_create_acalogos_app_prod.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'Falló el hardening global de neondb.'
}
```

`provision_role` y `apply_global_hardening` son mutuamente excluyentes. El script detiene la ejecución si ambos se habilitan juntos.

Después del hardening y antes de activar el login, todos los checks deben ser verdaderos:

```powershell
$roleReport = & psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
    -v expected_login=false `
    -f '.\backend\sql\checks\verify_acalogos_app_prod.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudieron verificar los privilegios del rol NOLOGIN.'
}

$parsedRoleReport = ($roleReport -join "`n") | ConvertFrom-Json -ErrorAction Stop
Assert-AppRoleReport -Report $parsedRoleReport -ExpectedLogin $false
```

Antes del hardening es normal que el informe falle en la ausencia efectiva de `CREATE` o `TEMPORARY`; no actives el rol mientras alguna comprobación sea falsa.

### Contraseña y activación `LOGIN`

Genera la contraseña en un gestor de contraseñas. No la guardes en el repositorio, no la pases como argumento y no la escribas en una sentencia SQL. Abre una sesión interactiva sin historial de edición:

```powershell
& psql -X -n
```

Dentro de `psql`, ejecuta:

```text
\password acalogos_app_prod
ALTER ROLE acalogos_app_prod LOGIN;
\q
```

El metacomando `\password` solicita el secreto sin mostrarlo y evita incluirlo en el historial SQL. Tras la activación, repite el check con `-v expected_login=true`, analiza el JSON con `ConvertFrom-Json -ErrorAction Stop` y ejecuta `Assert-AppRoleReport -ExpectedLogin $true`; todas las comprobaciones deben continuar verdaderas.

### URL pooled para Render

Después de activar y verificar el rol:

1. Abre **Connect** en Neon Console.
2. Selecciona la rama `main`, la base `neondb` y el rol `acalogos_app_prod`.
3. Activa pooling y confirma que el hostname termine en `-pooler`.
4. Convierte en memoria `sslmode=require` a `sslmode=verify-full` con `ConvertTo-VerifyFull`, conservando los demás parámetros.
5. Guarda el resultado directamente como secreto `DATABASE_URL` en Render.

No configures `DIRECT_DATABASE_URL` en el servicio runtime y no guardes la URL pooled en el repositorio.

Después de activar `LOGIN`, carga temporalmente la URL pooled del rol de aplicación en `PGDATABASE` y comprueba desde esa sesión:

```powershell
$searchPath = & psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
    -c 'SHOW search_path'
if ($LASTEXITCODE -ne 0 -or ($searchPath -join "`n").Trim() -cne 'pg_catalog, public') {
    throw 'El search_path efectivo del rol de aplicación no es el esperado.'
}
```

Restaura o elimina `PGDATABASE` mediante `finally` y limpia la URL del proceso y el portapapeles al terminar. El comando solo muestra el `search_path`; no debe imprimir la conexión.

### Pruebas positivas y negativas

Con la conexión pooled del rol de aplicación, las pruebas positivas de escritura deben quedar dentro de una transacción revertida:

```sql
BEGIN;
SELECT id
FROM public.servicios
WHERE id = 1
FOR UPDATE;

UPDATE public.servicios
SET updated_at = updated_at
WHERE id = 1;
ROLLBACK;
```

Comprueba además que `SELECT * FROM public.servicios ORDER BY id` devuelve los seis registros y que el backend responde `GET /servicios` sin usar el fallback JSON.

Las pruebas negativas deben ser no destructivas. Usa `EXPLAIN` sin `ANALYZE` para confirmar que fallan por permisos los intentos de `INSERT`, `DELETE` y actualización de columnas no autorizadas. Usa el check para validar `CREATE`, `TEMPORARY`, ownership, grant options y secuencias; no ejecutes `nextval`, `setval`, `DROP`, `TRUNCATE` ni DDL destructivo como prueba.

### Recuperación manual

- Si la comprobación de membresías de `001` falla, su transacción revierte la creación y los grants; verifica el estado antes de repetir.
- Si `002` rechaza el preflight, no hizo cambios. Si falla dentro de su transacción, el `REVOKE` se revierte. Ante una pérdida de conexión alrededor de `COMMIT`, consulta `pg_auth_members` antes de repetir.
- Ejecuta `002` como el miembro real de `acalogos_app_prod`. Si ya no puedes conectarte como ese rol, una revocación que nombre explícitamente al miembro requiere aprobación independiente.
- Si falla el hardening, vuelve a ejecutar el preflight y el check; no asumas que las tres revocaciones se aplicaron, aunque están encerradas en una transacción.
- Si falla cualquier check, conserva `NOLOGIN` y detén el despliegue.
- Si la conexión se pierde alrededor de `ALTER ROLE ... LOGIN`, consulta el atributo antes de repetirlo.
- No automatices `DROP ROLE`, cambios de ownership ni restauraciones de privilegios a `PUBLIC`. Cualquier reversión global requiere una revisión separada de los roles afectados.

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
