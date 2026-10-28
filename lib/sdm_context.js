const Config = require('./configService');

const SDM_LIST_URL = "https://raw.githubusercontent.com/smart-data-models/data-models/refs/heads/master/specs/AllSubjects/official_list_data_models.json";

// The official list changes rarely: download it once a day, not once per entity.
// A failed download is retried after FAILURE_TTL_MS; meanwhile the default
// context is used, so a slow or unreachable GitHub no longer delays every request.
const LIST_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

let listPromise = null;
let listExpiresAt = 0;
const contextByType = new Map();

// One shared download: concurrent callers (one per entity of a response) wait
// for the same promise.
function loadOfficialList() {
    const now = Date.now();
    if (listPromise && now < listExpiresAt) {
        return listPromise;
    }
    listExpiresAt = now + LIST_TTL_MS;
    const options = typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) } : {};
    listPromise = fetch(SDM_LIST_URL, options)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Could not download the official list of models');
            }
            return response.json();
        })
        .catch((e) => {
            listExpiresAt = Date.now() + FAILURE_TTL_MS;
            console.error('Error getting SDM context:', e);
            throw e;
        });
    return listPromise;
}

async function getUserContextForEntityType(entityType) {
    if (contextByType.has(entityType)) {
        return contextByType.get(entityType);
    }
    let data;
    try {
        data = await loadOfficialList();
    } catch (e) {
        // Logged once by loadOfficialList
        return Config.getConfig().userContext;
    }
    const subjects = (data.officialList || [])
        .filter((repo) => repo.dataModels.includes(entityType))
        .map((repo) => repo.repoName);
    // General context URL for the subject
    const context =
        subjects.length > 0
            ? `https://raw.githubusercontent.com/smart-data-models/${subjects[0]}/refs/heads/master/context.jsonld`
            : Config.getConfig().userContext;
    contextByType.set(entityType, context);
    return context;
}

function resetCache() {
    listPromise = null;
    listExpiresAt = 0;
    contextByType.clear();
}

module.exports = { getUserContextForEntityType, resetCache };
