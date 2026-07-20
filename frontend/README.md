# Frontend de Acalogos

Aplicación React, TypeScript y Vite. El frontend consume el backend mediante una URL pública configurable en tiempo de build.

## API y desarrollo local

La única variable pública requerida es:

```text
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` se incorpora al bundle del navegador. Nunca debe contener contraseñas, tokens, claves de API, cadenas de base de datos ni otros secretos.

En desarrollo, si la variable está ausente, el frontend conserva el fallback local `http://localhost:3000`. En builds de producción debe configurarse explícitamente. Todas las lecturas de servicios, el login administrativo y la gestión de imágenes usan la misma URL base.

## Netlify

La configuración versionada en `../netlify.toml` define:

```text
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

En Netlify, configura para producción:

```text
VITE_API_URL=https://acalogos-backend.onrender.com
```

El archivo `netlify.toml` también incorpora la reescritura SPA `/* -> /index.html` con estado `200`, necesaria para abrir o recargar directamente `/admin` y `/admin/panel`.

No es necesario usar Netlify CLI ni guardar variables de producción en archivos del repositorio.

## CORS

Cuando Netlify asigne el dominio definitivo, configura en Render el origen HTTPS canónico mediante `CORS_ORIGIN`. El valor de producción debe ser el origen exacto, sin rutas ni barra final:

```text
CORS_ORIGIN=https://<sitio>.netlify.app
```

Si después se utiliza un dominio personalizado, actualiza la lista de orígenes autorizados del backend. El entorno local puede conservar `http://localhost:5173` en su propia configuración.

## Validación local

Desde esta carpeta, carga la URL pública solo en la sesión actual de PowerShell, instala desde el lockfile y genera un build limpio:

```powershell
$previousApiUrl = [Environment]::GetEnvironmentVariable('VITE_API_URL', 'Process')

try {
    $env:VITE_API_URL = 'https://acalogos-backend.onrender.com'

    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci falló.' }

    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build falló.' }

    if (-not (Test-Path '.\dist\index.html')) {
        throw 'No existe dist/index.html.'
    }

    if (@(rg -l 'http://localhost:3000' '.\dist').Count -gt 0) {
        throw 'El bundle contiene la URL local de API.'
    }

    if (@(rg -l 'https://acalogos-backend\.onrender\.com' '.\dist').Count -eq 0) {
        throw 'El bundle no contiene la URL pública de Render.'
    }
} finally {
    if ($null -eq $previousApiUrl) {
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    } else {
        $env:VITE_API_URL = $previousApiUrl
    }
}
```

Después del despliegue, verifica `/`, el acceso directo y recarga de `/admin`, la carga de los seis servicios, las imágenes Cloudinary y las operaciones administrativas. En las herramientas del navegador no debe aparecer ninguna llamada a `localhost`.

## Bloqueo pendiente: contacto

El formulario actual envía `POST /contacto`, pero el backend todavía no expone ese endpoint. El sitio no debe considerarse completamente funcional hasta implementar y validar esa ruta. Esta preparación de Netlify no modifica ni oculta el formulario.
