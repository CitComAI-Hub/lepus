# Despliegue de Lepus en Kubernetes

Este manifiesto conserva temporalmente el método de desarrollo que clona `CitComAI-Hub/lepus` al iniciar el contenedor y ejecuta `npm install` y `npm start`. **No es el método recomendado para producción**: cada pod nuevo descarga la rama por defecto del repositorio, por lo que puede ejecutar código diferente entre reinicios y necesita acceso a GitHub y npm.

El manifiesto no lee el `.env` local ni lo copia al clúster. La configuración se separa así:

-   `deploy/kubernetes/lepus.yaml`: valores no secretos en un ConfigMap y recursos Deployment/Service.
-   `lepus-auth-secret`: usuario y contraseña de autenticación, creados directamente en el namespace del despliegue.
-   `.env`: solo para desarrollo local con `npm start` y para interpolación de Docker Compose.

No añadas contraseñas, tokens ni archivos `.env` a los manifiestos ni a Git. El Secret de Kubernetes debe protegerse también con RBAC y cifrado de etcd según las políticas del clúster.

## 1. Crear el namespace

El manifiesto de ejemplo usa el namespace `provider`. Si vas a usar otro, cambia `namespace` en `lepus.yaml` y sustituye `provider` en los comandos de esta guía.

```bash
kubectl create namespace provider --dry-run=client -o yaml | kubectl apply -f -
```

## 2. Crear o actualizar las credenciales

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

El Secret debe existir en el mismo namespace que el Deployment. No guardes esos valores en `lepus.yaml` ni en un archivo `.env` que luego copies al clúster.

## 3. Revisar la configuración y desplegar

El ConfigMap del manifiesto ya contiene los endpoints usados por la configuración anterior. Comprueba que son correctos y accesibles desde los pods; cambia estos valores en `lepus.yaml` si el entorno es distinto:

-   `AUTH_URL`: URL del endpoint de autenticación Keystone v3, terminada en `/v3/auth/tokens`.
-   `NGSI_V2_CONTEXT_BROKER`: URL base del broker NGSI-v2 accesible desde los pods.
-   `NGSI_V2_TIMEOUT`: timeout de las peticiones al broker, en milisegundos.

No incluyas `/v2` al final de `NGSI_V2_CONTEXT_BROKER` salvo que tu despliegue lo requiera: Lepus construye las rutas NGSI-v2. `AUTH_USER` y `AUTH_PASSWORD` se obtienen del Secret; no los escribas en el ConfigMap.

Aplica el manifiesto:

```bash
kubectl apply -f deploy/kubernetes/lepus.yaml
kubectl rollout status deployment/lepus-dev -n provider
```

Si todavía existe el Pod antiguo llamado `lepus-dev`, elimínalo después de que el Deployment esté listo:

```bash
kubectl delete pod lepus-dev -n provider --ignore-not-found
```

El manifiesto crea un Service `lepus-dev` de tipo `ClusterIP` en el puerto 3000. Para probarlo desde tu equipo:

```bash
kubectl port-forward service/lepus-dev 3000:3000 -n provider
```

Después accede a `http://localhost:3000`.

El manifiesto usa `DOTENV_CONFIG_PATH=/dev/null` para evitar que `dotenv` cargue un `.env` que pudiera existir dentro del clon. Kubernetes recibe la configuración únicamente del ConfigMap y del Secret.

## Variables disponibles

Las variables que usa la aplicación se definen como variables del contenedor:

| Variable | Uso | Dónde configurarla |
| --- | --- | --- |
| `AUTH_URL` | Endpoint de autenticación | ConfigMap |
| `AUTH_USER` | Usuario de autenticación | Secret |
| `AUTH_PASSWORD` | Contraseña de autenticación | Secret |
| `NGSI_V2_CONTEXT_BROKER` | URL del broker NGSI-v2 | ConfigMap |
| `NGSI_V2_TIMEOUT` | Timeout al consultar el broker (ms) | ConfigMap |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Desactiva la validación TLS; solo está habilitada como excepción temporal en este manifiesto de desarrollo | ConfigMap |
| `LEPUS_PORT` | Puerto HTTP de Lepus; por defecto `3000` | Opcional |
| `LEPUS_URL`, `LEPUS_ALIAS`, `LEPUS_RELAY_TIMEOUT`, `LEPUS_MULTI_CORE`, `NGSI_V2_ENTITY_LIMIT`, `USER_CONTEXT_URL`, `CORE_CONTEXT_URL` | Opciones adicionales de la aplicación | Opcionales |
| `DEBUG` | Salida de depuración, por ejemplo `adapter:*` | Opcional; no activar normalmente en producción |

Para añadir una opción opcional, inclúyela en `data` del ConfigMap y vuelve a aplicar el manifiesto. Las variables de entorno se leen al iniciar el contenedor; reinicia los pods después de cambiar el ConfigMap o el Secret:

```bash
kubectl rollout restart deployment/lepus-dev -n provider
```

## Certificados TLS: excepción temporal de desarrollo

El manifiesto mantiene `NODE_TLS_REJECT_UNAUTHORIZED=0` para conservar el comportamiento del despliegue de desarrollo anterior, ya que el certificado de `cb.vlci.valencia.es` no coincide con ese nombre de host. Esa variable desactiva la validación TLS para **todas** las conexiones HTTPS del proceso Node.js y permite ataques de intermediario.

La solución recomendada es usar el hostname cubierto por el certificado o corregir la configuración del certificado/CA. Este manifiesto es solo para desarrollo temporal: elimina `NODE_TLS_REJECT_UNAUTHORIZED` del ConfigMap tan pronto como se corrija el certificado y **no uses esta configuración en producción**.

## Siguiente paso recomendado

Cuando dejes de usar este despliegue temporal, construye una imagen desde una revisión concreta de tu fork, publícala en un registry y configura el Deployment para usar una etiqueta inmutable. Así el pod no necesitará clonar Git ni instalar dependencias al arrancar.
