const Config = require('./configService');

const SDM_LIST_URL = "https://raw.githubusercontent.com/smart-data-models/data-models/refs/heads/master/specs/AllSubjects/official_list_data_models.json";

if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

async function getUserContextForEntityType(entityType) {
    const url = SDM_LIST_URL;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo descargar la lista oficial de modelos');
        const data = await response.json();
        const subjects = data.officialList
            .filter(repo => repo.dataModels.includes(entityType))
            .map(repo => repo.repoName);
        if (subjects.length > 0) {
            // URL de contexto general del subject
            return `https://raw.githubusercontent.com/smart-data-models/${subjects[0]}/refs/heads/master/context.jsonld`;
        }
    } catch (e) {
        // Si hay error, loguea y retorna el contexto por defecto
        console.error('Error obteniendo contexto SDM:', e);
    }
    return Config.getConfig().userContext;
}

module.exports = { getUserContextForEntityType }; 