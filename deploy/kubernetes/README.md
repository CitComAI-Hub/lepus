# Despliegue de Lepus en Kubernetes

El manifiesto `lepus.yaml` despliega la imagen `ghcr.io/citcomai-hub/lepus` con un tag fijo. En el dataspace de CitCom, Lepus se despliega con Terraform desde `dataspace-on-upv` (capa `providers/townhall_vlc/lepus`); este manifiesto sirve para probarlo en cualquier otro clúster.

La configuración se separa así:

-   `deploy/kubernetes/lepus.yaml`: valores no secretos en un ConfigMap y recursos Deployment/Service.
-   `lepus-auth-secret`: usuario y contraseña de autenticación, creados directamente en el namespace del despliegue.
-   `.env`: solo para desarrollo local con `npm start` y para interpolación de Docker Compose. No entra en la imagen (`.dockerignore`).

No añadas contraseñas, tokens ni archivos `.env` a los manifiestos ni a Git. El Secret de Kubernetes debe protegerse también con RBAC y cifrado de etcd según las políticas del clúster.

## 1. Publicar la imagen

Desde una revisión commiteada de este repo, con un tag nuevo (el pod no vuelve a descargar un tag que ya tiene):

```bash
docker build -t ghcr.io/citcomai-hub/lepus:<tag> .
docker push ghcr.io/citcomai-hub/lepus:<tag>
```

Cambia el tag de `image` en `lepus.yaml` (y `lepus_image_tag` en `dataspace-on-upv`).

## 2. Crear el namespace

El manifiesto de ejemplo usa el namespace `provider`. Si vas a usar otro, cambia `namespace` en `lepus.yaml` y sustituye `provider` en los comandos de esta guía.

```bash
kubectl create namespace provider --dry-run=client -o yaml | kubectl apply -f -
```

## 3. Crear o actualizar las credenciales

El comando solicita los valores sin guardarlos como texto literal en el historial del shell:

```bash
read -r -p "Usuario de autenticación: " AUTH_USER
read -r -s -p "Contraseña de autenticación: " AUTH_PASSWORD
printf '\n'

kubectl create secret generic lepus-auth-secret \
  --namespace provider \
  --from-literal=AUTH_USER="$AUTH_USER" \
  --from-literal=AUTH_PASSWORD="$AUTH_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

unset AUTH_USER AUTH_PASSWORD
```

El Secret debe existir en el mismo namespace que el Deployment.

## 4. Revisar la configuración y desplegar

Comprueba los valores del ConfigMap:

-   `AUTH_URL`: URL del endpoint de autenticación Keystone v3, terminada en `/v3/auth/tokens`.
-   `NGSI_V2_CONTEXT_BROKER`: URL base del broker NGSI-v2 accesible desde los pods. Sin `/v2` al final: Lepus construye las rutas NGSI-v2.
-   `NGSI_V2_TIMEOUT`: timeout de cada petición al broker, en milisegundos.
-   `LEPUS_DEFAULT_TENANT`: `Fiware-Service` de las peticiones que no traen `NGSILD-Tenant`.

```bash
kubectl apply -f deploy/kubernetes/lepus.yaml
kubectl rollout status deployment/lepus-dev -n provider
kubectl port-forward service/lepus-dev 3000:3000 -n provider
```

Después accede a `http://localhost:3000/ngsi-ld/v1/entities?type=WasteContainer`.

## Variables disponibles

| Variable | Uso | Dónde configurarla |
| --- | --- | --- |
| `AUTH_URL` | Endpoint de autenticación Keystone v3. Vacío = sin token | ConfigMap |
| `AUTH_USER` | Usuario de autenticación | Secret |
| `AUTH_PASSWORD` | Contraseña de autenticación | Secret |
| `NGSI_V2_CONTEXT_BROKER` | URL del broker NGSI-v2 | ConfigMap |
| `NGSI_V2_TIMEOUT` | Timeout de cada petición al broker (ms) | ConfigMap |
| `LEPUS_DEFAULT_TENANT` | `Fiware-Service` por defecto (dominio Keystone) | ConfigMap |
| `LEPUS_SERVICE_PATHS` | JSON tipo de entidad → `Fiware-ServicePath` (proyecto Keystone). Por defecto, `lib/entityServicePaths.js` | Opcional |
| `LEPUS_PORT` | Puerto HTTP de Lepus; por defecto `3000` | Opcional |
| `LEPUS_URL`, `LEPUS_ALIAS`, `LEPUS_RELAY_TIMEOUT`, `LEPUS_MULTI_CORE`, `NGSI_V2_ENTITY_LIMIT`, `USER_CONTEXT_URL`, `CORE_CONTEXT_URL` | Opciones adicionales de la aplicación | Opcionales |
| `DEBUG` | Salida de depuración, por ejemplo `adapter:*` | Opcional; no activar normalmente en producción |

Las variables de entorno se leen al iniciar el contenedor; reinicia los pods después de cambiar el ConfigMap o el Secret:

```bash
kubectl rollout restart deployment/lepus-dev -n provider
```

No hace falta `NODE_TLS_REJECT_UNAUTHORIZED=0`: el certificado de `cb.vlci.valencia.es` y `auth.vlci.valencia.es` (`*.vlci.valencia.es`, ACCV) es válido para Node.
