/*
 * Make the NGSI-v2 entities of VLCi conform to NGSI-LD and to the official
 * Smart Data Models (SDM) schemas before they are returned, without inventing
 * data. Checked with the SDM audit of 2026-11-12 (WasteManagement v0.3.0,
 * Environment v0.1.4, Transportation v0.0.1).
 *
 * - Attributes whose value is null are left out: NGSI-LD has no null values,
 *   and "no data" is the absence of the attribute.
 * - Per type, ADAPTATIONS maps an attribute to a function of its value. A
 *   function that returns null drops the attribute. Remove an entry once VLCi
 *   publishes the attribute as SDM expects.
 */

function asArray(value) {
    return Array.isArray(value) ? value : [value];
}

// A number written as a string ("0") becomes that number; anything else is kept.
function asNumber(value) {
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return value;
}

const ADAPTATIONS = {
    WasteContainer: {
        // SDM: refDevice is an array of references; VLCi sends one string.
        refDevice: asArray,
        // SDM enum: fixed, ground, other, portable, underground. VLCi uses the
        // Spanish 'Superficie' for ground-level containers (confirmed by the
        // data space team, 2026-11-12).
        category: (value) => asArray(value).map((c) => (c === 'Superficie' ? 'ground' : c)),
        // SDM: fillingLevel is a number; VLCi sometimes sends it as a string ("0").
        fillingLevel: asNumber
    },
    TrafficFlowObserved: {
        // SDM: intensity >= 0. VLCi sends -1 when the sensor has no
        // measurement; that is "no data", so the attribute is left out.
        intensity: (value) => (value === -1 ? null : value)
    }
};

/**
 * Adapt one NGSI-v2 entity (normalized or keyValues) as described above.
 *
 * @param {Object} entity the entity from NGSI-v2
 * @param {boolean} keyValues true if the entity is in keyValues format
 */
function adaptEntity(entity, keyValues) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
        return entity;
    }
    const rules = ADAPTATIONS[entity.type] || {};
    const adapted = {};
    Object.keys(entity).forEach((key) => {
        const attr = entity[key];
        if (key === 'id' || key === 'type') {
            adapted[key] = attr;
            return;
        }
        let value = keyValues ? attr : attr && attr.value;
        if (value === null || value === undefined) {
            return;
        }
        if (rules[key]) {
            value = rules[key](value);
            if (value === null || value === undefined) {
                return;
            }
        }
        adapted[key] = keyValues ? value : Object.assign({}, attr, { value });
    });
    return adapted;
}

/**
 * Adapt an NGSI-v2 response body: one entity or a list of them.
 */
function adaptBody(body, keyValues) {
    return Array.isArray(body) ? body.map((entity) => adaptEntity(entity, keyValues)) : adaptEntity(body, keyValues);
}

exports.adaptEntity = adaptEntity;
exports.adaptBody = adaptBody;
exports.ADAPTATIONS = ADAPTATIONS;
