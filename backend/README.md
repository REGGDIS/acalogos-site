# Backend de Acalogos

Este es el backend del proyecto.

## Módulo de contacto

`POST /contacto` se monta únicamente cuando `CONTACT_ENABLED=true`. El valor
predeterminado es `false`; en ese estado el backend conserva sus rutas existentes
y no exige credenciales de correo.

Al activarlo son obligatorias `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`,
`BREVO_API_KEY` y `CONTACT_PRIVACY_NOTICE_VERSION`. Los valores reales deben
configurarse como secretos del entorno y no versionarse.

La primera versión usa un circuit breaker global provisional en memoria para
todo `POST /contacto`, con 100 solicitudes cada 15 minutos por defecto. Todas las
personas comparten la misma cuota: no usa la IP, no confía en `X-Forwarded-For`
y no reemplaza una protección por visitante. El rate limit por IP queda
pendiente hasta comprobar de forma controlada la topología de proxies de Render.
Cuando exista una clave segura por visitante, `CONTACT_RATE_LIMIT_MAX` podrá
reducirse conforme al tráfico observado.

La suite local se ejecuta con `npm test`. La integración del repositorio requiere
un PostgreSQL 14 efímero y se ejecuta por separado con
`CONTACT_TEST_DATABASE_URL` y `npm run test:contacto:postgres`; el script falla si
la variable de prueba no está definida.
