# Frontend de Acalogos

Aplicación React, TypeScript y Vite. El frontend consume el backend mediante una URL pública configurable en tiempo de build.

## API y desarrollo local

Las variables públicas requeridas son:

```text
VITE_API_URL=http://localhost:3000
VITE_CONTACT_PRIVACY_NOTICE_VERSION=contact-v1
```

Ambas variables se incorporan al bundle del navegador. Nunca deben contener contraseñas, tokens, claves de API, cadenas de base de datos ni otros secretos. La versión del aviso debe coincidir exactamente con `CONTACT_PRIVACY_NOTICE_VERSION` del backend.

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
VITE_CONTACT_PRIVACY_NOTICE_VERSION=contact-v1
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
$previousPrivacyVersion = [Environment]::GetEnvironmentVariable('VITE_CONTACT_PRIVACY_NOTICE_VERSION', 'Process')

try {
    $env:VITE_API_URL = 'https://acalogos-backend.onrender.com'
    $env:VITE_CONTACT_PRIVACY_NOTICE_VERSION = 'contact-v1'

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

    if (@(rg -l 'contact-v1' '.\dist').Count -eq 0) {
        throw 'El bundle no contiene la versión pública del aviso de privacidad.'
    }
} finally {
    if ($null -eq $previousApiUrl) {
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    } else {
        $env:VITE_API_URL = $previousApiUrl
    }

    if ($null -eq $previousPrivacyVersion) {
        Remove-Item Env:VITE_CONTACT_PRIVACY_NOTICE_VERSION -ErrorAction SilentlyContinue
    } else {
        $env:VITE_CONTACT_PRIVACY_NOTICE_VERSION = $previousPrivacyVersion
    }
}
```

Después del despliegue, verifica `/`, el acceso directo y recarga de `/admin`, la carga de los seis servicios, las imágenes Cloudinary y las operaciones administrativas. En las herramientas del navegador no debe aparecer ninguna llamada a `localhost`.

## Formulario de contacto

El formulario envía `POST /contacto` únicamente con nombre, correo, mensaje, versión del aviso y el honeypot `website`. Exige consentimiento, no incluye ese booleano en el payload y trata 201 y 202 como recepción aceptada.

Los builds de producción fallan si `VITE_CONTACT_PRIVACY_NOTICE_VERSION` está ausente, vacía, contiene solo espacios, tiene espacios al inicio o al final, contiene un carácter NUL o supera 32 caracteres. Una versión válida se conserva y envía literalmente, sin recortarla ni transformarla. En desarrollo, una versión inválida deshabilita el formulario. Algunos autocompletadores pueden ignorar `autocomplete="off"` en el honeypot; este riesgo se acepta en la primera versión.

La solicitud solo se aborta cuando se desmonta el componente. No se aplica un timeout frontend mientras el contrato carezca de idempotencia, porque el servidor podría haber almacenado el contacto aunque el navegador aborte y un reintento podría duplicarlo. Un timeout futuro deberá comunicar que el resultado es ambiguo y no fomentar un reintento inmediato.

Orden de despliegue: mantener primero `CONTACT_ENABLED=false`, configurar y verificar Brevo y las variables backend, activar el endpoint, configurar la misma versión pública en Netlify y solo entonces reconstruir el frontend. Ante problemas, restaura el deploy anterior de Netlify o vuelve a desactivar el módulo backend.
