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
 * ?scopeQ= if given; otherwise the servicePath mapped to the entity type
 * (the first one if it has several), or '/'.
 */
function servicePath(req) {
    if (req.query.scopeQ) {
        const scope = req.query.scopeQ;
        return scope.startsWith('/') ? scope : '/' + scope;
    }
    const servicePaths = Config.getConfig().servicePaths || {};
    const paths = servicePaths[entityType(req)];
    if (Array.isArray(paths)) {
        return paths[0];
    }
    return paths || '/';
}

module.exports = { entityType, tenant, servicePath };
