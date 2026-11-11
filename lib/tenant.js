/*
 * NGSI-LD has no servicePath, but NGSI-v2 (and its Keystone project) does.
 * Deduce the Fiware-Service and Fiware-ServicePath of each request from its
 * tenant and the type of the entities it is about.
 */

const Config = require('./configService');

const ENTITY_TYPE_IN_ID = /urn:ngsi-ld:([^:/]+):/;

function typeFromId(id) {
    const match = typeof id === 'string' ? id.match(ENTITY_TYPE_IN_ID) : null;
    return match ? match[1] : null;
}

/**
 * The entity type of the request: ?type=, the entity id in the path or the body.
 * Only the first one is used when there are several.
 */
function entityType(req) {
    if (req.query.type) {
        return req.query.type.split(',')[0];
    }
    const fromPath = typeFromId(decodeURIComponent(req.path));
    if (fromPath) {
        return fromPath;
    }
    const body = Array.isArray(req.body) ? req.body[0] : req.body;
    if (body && typeof body.type === 'string') {
        return body.type;
    }
    return body ? typeFromId(body.id) : null;
}

function tenant(req) {
    return req.header('NGSILD-Tenant') || Config.getConfig().defaultTenant || null;
}

/**
 * The servicePaths that Lepus serves for an entity type: the ones mapped to it
 * (lib/entityServicePaths.js or LEPUS_SERVICE_PATHS), or '/' if it has none.
 */
function servicePathsOf(type) {
    const servicePaths = Config.getConfig().servicePaths || {};
    const paths = servicePaths[type];
    if (!paths) {
        return ['/'];
    }
    return Array.isArray(paths) ? paths : [paths];
}

/**
 * The servicePath of the request: ?scopeQ= if it is one of the servicePaths
 * served for the entity type, otherwise the first one of them. Returns null
 * when ?scopeQ= names any other servicePath: data space policies authorize an
 * entity type, not a servicePath, so a client must not reach servicePaths
 * that Lepus does not serve for that type (e.g. internal ones).
 */
function servicePath(req) {
    const allowed = servicePathsOf(entityType(req));
    if (req.query.scopeQ) {
        const scope = req.query.scopeQ.startsWith('/') ? req.query.scopeQ : '/' + req.query.scopeQ;
        return allowed.includes(scope) ? scope : null;
    }
    return allowed[0];
}

module.exports = { entityType, tenant, servicePath };
