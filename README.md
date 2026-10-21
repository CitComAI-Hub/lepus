# FIWARE Lepus

[![FIWARE Core Context Management](https://nexus.lab.fiware.org/static/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![License: MIT](https://img.shields.io/github/license/jason-fox/lepus.svg)](https://opensource.org/licenses/MIT)
[![Docker badge](https://img.shields.io/badge/quay.io-fiware%2Flepus-grey?logo=red%20hat&labelColor=EE0000)](https://quay.io/repository/fiware/lepus)<br/>
[![NGSI v2](https://img.shields.io/badge/NGSI-v2-5dc0cf.svg)](https://fiware-ges.github.io/orion/api/v2/stable/)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)<br/>
![CI](https://github.com/jason-fox/lepus/workflows/CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/jason-fox/lepus/badge.svg?branch=master)](https://coveralls.io/github/jason-fox/lepus?branch=master)

An **NGSI-LD** wrapper for use with **NGSI-v2** Context Brokers. It understands the NGSI-LD endpoints and inputs, converts them to NGSI-v2, makes a request to
the NGSI-v2 broker behind it and transforms responses back to NGSI-LD using a **fixed JSON-LD `@context`**. It supports the NGSI-LD **federationOps** endpoints only 
and is designed to be used as a registered source with NGSI-LD Context Brokers in federation mode.

## CitCom fork

This is the [CitComAI-Hub](https://github.com/CitComAI-Hub/lepus) fork of [jason-fox/lepus](https://github.com/jason-fox/lepus). It
serves the NGSI-v2 data of the València City Council platform (VLCi, `https://cb.vlci.valencia.es:10027`) as NGSI-LD in the CitCom data
space. On top of upstream it adds:

-   **Keystone v3 authentication.** With `AUTH_URL`, `AUTH_USER` and `AUTH_PASSWORD`, Lepus gets a token from Keystone and sends it to the
    NGSI-v2 broker as `X-Auth-Token`. The `Fiware-Service` is the Keystone domain and the `Fiware-ServicePath` the project. Tokens are
    cached per domain and project until they expire, and they are never logged. Without `AUTH_URL` no token is requested, as upstream.
-   **Tenant and servicePath of every request.** NGSI-LD has no servicePath, so Lepus deduces it from the entity type with a map
    (`LEPUS_SERVICE_PATHS`, by default [`lib/entityServicePaths.js`](./lib/entityServicePaths.js)), and uses `LEPUS_DEFAULT_TENANT` when
    the request has no `NGSILD-Tenant`. Only these headers are forwarded, never the client's `Host` or `Authorization`. See
    [Configuration](#configuration).
-   **Plain NGSI-v2 IDs.** VLCi IDs are not URNs (e.g. `wastecontainer:6205...`). Lepus returns them as `urn:ngsi-ld:<type>:<id>` and,
    with `NGSI_V2_PLAIN_IDS=true`, strips that prefix again from the IDs of the requests, so an entity can be read by the ID Lepus
    returned.
-   **Smart Data Models `@context`.** When reading entities as JSON-LD, the `@context` is the one of the Smart Data Models subject that
    contains the entity type (e.g. `dataModel.WasteManagement` for `WasteContainer`), taken from the official list of data models. If the
    type is not there, `USER_CONTEXT_URL` is used.
-   **Timeouts that work.** `NGSI_V2_TIMEOUT` and `LEPUS_RELAY_TIMEOUT` were ignored upstream; here they apply to every request.
-   **Configuration out of the repository.** `.env` is ignored (template: [`.env.example`](./.env.example)) and
    [`deploy/kubernetes`](./deploy/kubernetes/README.md) deploys Lepus with a ConfigMap and a Secret.
-   **Image published to GHCR** by [`.github/workflows/publish.yml`](./.github/workflows/publish.yml). See
    [Publishing a new version](#publishing-a-new-version).

Known limitations:

-   When an entity type has several servicePaths (e.g. `AirQualityObserved`), only the first one is used.
-   `NGSI_V2_PLAIN_IDS` strips the prefix from the path and the `id=` parameter, not from the bodies of batch operations.
-   The list of Smart Data Models is downloaded again for every JSON-LD read; it is not cached.

In the CitCom data space, Lepus is deployed by the `providers/townhall_vlc/lepus` layer of
[dataspace-on-upv](https://github.com/CitComAI-Hub/dataspace-on-upv).

### Example

_Give me the Stores with the name "Einkauf" in **NGSI-LD** format_

```console
curl -L 'https://<lepus-context-broker>/ngsi-ld/v1/entities?type=Store&q=name%22Einkauf%22' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json'
```

is transformed to _Give me the Stores with the name "Einkauf" in **NGSI-v2** format_

```console
curl -L 'https://<ngsi-v2-context-broker>/v2/entities?type=Store&q=nameEinkauf' \
-H 'Accept: application/json'
```

All NGSI-v2 response attributes are converted to `Property` or `Relationship` (or subtype) and a fixed `@context` added to the body or `Link` header.


### Supported Endpoints

The following endpoints are supported as defined in the latest [NGSI-LD Specification](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)

#### Entities

-   **GET**  `/entities/` - Query entities  - §5.7.2; §6.4.3.2
-   **POST**  `/entities/` - Entity creation  - §5.6.1; §6.4.3.1
-   **DELETE**  `/entities/` - Purge Entities
<br/>

-   **GET** `/entities/{entityId}` - Entity retrieval by ID  - §5.7.1; §6.5.3.1
-   **PATCH** `/entities/{entityId}` - Merge Entity  - §5.6.17; §6.5.3.4
-   **PUT** `/entities/{entityId}` - Replace Entity  - §5.6.17; §6.5.3.3
-   **DELETE** `/entities/{entityId}` - Entity retrieval by ID  - §5.6.6; §6.5.3.2
<br/>

-   **POST** `/entities/{entityId}/attrs` - Append Entity attributes - §5.6.3; §6.6.3.1
-   **PATCH** `/entities/{entityId}/attrs` - Update Entity attributes  - §5.6.2; §6.6.3.2
<br>

-   **DELETE** `/entities/{entityId}/{attr}` - Delete Entity attribute - §5.6.5; §6.7.3.2
-   **PUT** `/entities/{entityId}/{attr}` - Replace Entity attribute - §5.6.19; §6.7.3.3
<br/>

#### Subscriptions

-   **POST** `/subscriptions/` - Create Subscription  - §5.8.1;  §6.10.3.1
-   **GET**  ` /subscriptions/` - Retrieve list of Subscriptions  - §5.8.4;  §6.10.3.2
-   **GET** `/subscriptions/{subscriptionId}` - Subscription retrieval by ID  - §5.8.3;  §6.11.3.1
-   **PATCH** `/subscriptions/{subscriptionId}` - Subscription update by ID  - §5.8.2;  §6.11.3.2
-   **DELETE** `/subscriptions/{subscriptionId}` - Subscription deletion by ID  - §5.8.5;  §6.11.3.3
<br/>

#### Types

-   **GET** ` /types/` - Retrieve available entity types  - §5.7.5; §5.7.6; §6.25.3.1
-   **GET** ` /types/{type}` -  Details about available entity type  - §5.7.7; §6.26.3.1
<br/>

#### Attributes

-   **GET** ` /attributes/` - Available attributes  - §5.7.8; §5.7.9; §6.27.3.1
-   **GET** `/attributes/{attrId}` - Details about available attribute - §5.7.10; §6.28.3.1

#### Batch Operations

-   **POST** `/entityOperations/create` - Batch Entity creation  - §5.6.7; 6.14.3.1
-   **POST** `/entityOperations/upsert` - Batch Entity create or update (upsert)  - §5.6.8; §6.15.3.1
-   **POST** `/entityOperations/update` - Batch Entity update - §5.6.9; §6.16.3.1
-   **POST** `/entityOperations/delete` - Batch Entity deletion  - §5.6.10; §6.17.3.1
> -   **POST** `/entityOperations/query` - Query entities based on POST - §5.7.2; §6.23.3.1 ❌
> -   **POST** `/entityOperations/merge` - Batch Entity merge - §5.6.20; §6.31.3.1  ❌

Internally 

-   **POST** ` /notify/` receives NGSI-v2 notifications and forwards then as NGSI-LD

### Usage

To use the wrapper, run:

```console
cp .env.example .env
docker compose up
```

Set the local endpoints and any authentication credentials in `.env` before starting. This file is for local npm/Compose use only; Kubernetes configuration is documented separately below.

Then insert some data into an NGSI-v2 broker such as Telefónica's [Orion Context Broker](https://github.com/telefonicaid/fiware-orion)

```console
curl -L 'http://localhost:1026/v2/entities/' \
-H 'Content-Type: application/json' \
-d '{
    "id": "urn:ngsi-ld:Store:001",
    "type": "Store",
    "address": {
        "type": "PostalAddress",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        },
        "metadata": {
    		"verified": {
        		"value": true,
        		"type": "Boolean"
    		}
    	}
    },
    "location": {
        "type": "geo:json",
        "value": {
             "type": "Point",
             "coordinates": [13.3986, 52.5547]
        }
    },
    "name": {
        "type": "Text",
        "value": "Bösebrücke Einkauf"
    }
}'
```

```console
curl -L 'http://localhost:1026/v2/entities/' \
-H 'Content-Type: application/json' \
-d '{
  "type": "Store",
    "id": "urn:ngsi-ld:Store:002",
    "address": {
        "type": "PostalAddress",
        "value": {
            "streetAddress": "Friedrichstraße 44",
            "addressRegion": "Berlin",
            "addressLocality": "Kreuzberg",
            "postalCode": "10969"
        },
        "metadata": {
    		"verified": {
        		"value": true,
        		"type": "Boolean"
    		}
    	}
    },
    "location": {
        "type": "geo:json",
        "value": {
             "type": "Point",
             "coordinates": [13.3903, 52.5075]
        }
    },
    "name": {
        "type": "Text",
        "value": "Checkpoint Markt"
    }
}'
```

Now query Lepus `Accept: application/ld+json` as if it is an NGSI-LD source - e.g.

```console
curl -L 'http://<lepus-context-broker>/ngsi-ld/v1/types' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json'
```

returns NGSI-LD with a fixed `@context`

```json
{
    "id": "urn:ngsi-ld:EntityTypeList:a1993de4-83e0-44c9-990b-be2e84b31df1",
    "type": "EntityTypeList",
    "typeList": [
        "Store"
    ],
    "@context": [
        "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld"
    ]
}
```


Alternatively query Lepus with `Accept: application/json`

```console
curl -iX 'https://<lepus-context-broker>/ngsi-ld/v1/types' \
-H 'Link: <https://<lepus-context-broker>/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json'
```


Returns

```text
Link: <https://<lepus-context-broker>/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
```

```json
{
    "id": "urn:ngsi-ld:EntityTypeList:a1993de4-83e0-44c9-990b-be2e84b31df1",
    "type": "EntityTypeList",
    "typeList": [
        "Store"
    ]
}
```

And `https://<lepus-context-broker>/context.jsonld` returns NGSI-LD with a fixed `@context`

```json
{
    "@context": [
        "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld"
    ]
}
```


### Configuration

Configuration is provided to the application as environment variables. When running `npm start`, `bin/www` loads them from a local `.env` file. Docker Compose passes the application settings declared under the `lepus` service; its `.env` is only used locally for Compose interpolation. Neither local `.env` file is used by Kubernetes.

-   **DEBUG** - for debug output - e.g. `DEBUG=adapter:*`
-   **LEPUS_PORT** - port used for interactions - defaults to `3000`
-   **LEPUS_ALIAS** - host alias for Lepus
-   **LEPUS_RELAY_TIMEOUT** maximum length of time to forward the **NGSI-LD** notification
-   **LEPUS_URL** for the location of Lepus itself -  e.g. `LEPUS_URL=http://<lepus>`
-   **LEPUS_MULTI_CORE** - whether to use multiple cores
-   **INCLUDE_VALUE_TYPE** - include the NGSI-v2 attribute `type` in the returned payload
-   **NGSI_V2_CONTEXT_BROKER** for the **NGSI-v2** [Orion Context Broker](https://github.com/telefonicaid/fiware-orion) URL - e.g. `NGSI_V2_CONTEXT_BROKER=http://orion2:1026`
-   **NGSI_V2_TIMEOUT** maximum length of time to access the **NGSI-v2** [Orion Context Broker](https://github.com/telefonicaid/fiware-orion) URL in milliseconds
-   **USER_CONTEXT_URL** for the fixed JSON-LD `@context` to be supplied - e.g. `USER_CONTEXT_URL=https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld`
-   **CORE_CONTEXT_URL** for the fixed core NGSI-LD `@context` to be supplied - e.g. `CORE_CONTEXT_URL=https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld`
-   **AUTH_URL**, **AUTH_USER** and **AUTH_PASSWORD** for Keystone v3 authentication. Keep credentials out of source control and container images. Without `AUTH_URL` no token is requested.
-   **LEPUS_DEFAULT_TENANT** - NGSI-v2 `Fiware-Service` used when the request has no `NGSILD-Tenant` header - e.g. `LEPUS_DEFAULT_TENANT=tef_vlci`
-   **NGSI_V2_PLAIN_IDS** - `true` when the NGSI-v2 IDs are not URNs. Lepus returns them as `urn:ngsi-ld:<type>:<id>` and, with this option, strips that prefix again from the IDs of the requests (path and `id=`), so entities can be read by the ID Lepus returned - defaults to `false`
-   **LEPUS_SERVICE_PATHS** - JSON object with the NGSI-v2 `Fiware-ServicePath` of each entity type, used when the request has no `scopeQ` - defaults to [`lib/entityServicePaths.js`](./lib/entityServicePaths.js)

NGSI-LD has no servicePath, but NGSI-v2 and its Keystone projects do. For every request Lepus sends `Fiware-Service` (the `NGSILD-Tenant` header or `LEPUS_DEFAULT_TENANT`) and `Fiware-ServicePath` (`scopeQ`, or the servicePath of the entity type taken from `?type=`, the entity ID `urn:ngsi-ld:<type>:...` or the body, or `/`). With Keystone, they are the domain and the project of the token. When a type has several servicePaths, the first one is used. Other client headers, such as `Authorization`, are not forwarded to the NGSI-v2 broker.

For Kubernetes, configure non-secret settings in the ConfigMap and credentials in a Secret; see the [Kubernetes deployment guide](./deploy/kubernetes/README.md). The manifest uses the `ghcr.io/citcomai-hub/lepus` image.


## NGSI-LD Registration

Since Lepus does not understand JSON-LD directly, registrations must be created within an LD context broker using the `"key": "jsonldContext"` 
to preprocess all interactions:

```console
curl -L 'http://localhost:9090/ngsi-ld/v1/csourceRegistrations/' \
-H 'Content-Type: application/json' \
-H 'Link: <https://<lepus-context-broker>/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d ' {
    "type": "ContextSourceRegistration",
    "information": [
        {
            "entities": [
                {
                    "type": "Shelf"
                }
            ]
        }
    ],
     "contextSourceInfo":[
        {
            "key": "jsonldContext",
            "value": "https://<lepus-context-broker>/context.jsonld"
        }
    ],
    "mode": "inclusive",
    "operations": [
        "federationOps"
    ],
    "endpoint": "https://<lepus-context-broker>"
}'
```


## Publishing a new version

The image is `ghcr.io/citcomai-hub/lepus`. It belongs to the CitComAI-Hub organization and is public, so clusters pull it without a pull
secret. It is built and pushed by [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) when a `v*` tag is pushed: the
workflow runs the unit tests, builds the `Dockerfile` and publishes `:<tag>` and `:sha-<commit>`, linked to this repository. Nobody needs
to log in to GHCR.

1.  Merge the changes to `master` and push them:

    ```console
    git push citcom-vlc master
    ```

2.  Tag `master` with a new version and push the tag. Use a new tag every time: a pod does not pull again a tag it already has.

    ```console
    git tag -a v1.1 -m "Lepus v1.1"
    git push citcom-vlc v1.1
    ```

3.  Follow the run in [Actions](https://github.com/CitComAI-Hub/lepus/actions). When it finishes, the image is available:

    ```console
    docker pull ghcr.io/citcomai-hub/lepus:v1.1
    ```

4.  Update the deployments to the new tag:

    -   CitCom data space: `lepus_image_tag` in `providers/townhall_vlc/lepus/envs/dev.tfvars` of
        [dataspace-on-upv](https://github.com/CitComAI-Hub/dataspace-on-upv), through a pull request, and then apply that layer.
    -   [`deploy/kubernetes/lepus.yaml`](./deploy/kubernetes/lepus.yaml): the `image` of the Deployment.

The workflow can also be run by hand from Actions (_Run workflow_); then it only publishes `:sha-<commit>`.

## License

[MIT](LICENSE) © 2023-2025 FIWARE Foundation e.V.
