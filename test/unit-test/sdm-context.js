/*
 * Cache of the Smart Data Models context lookup (lib/sdm_context.js)
 */

const should = require('should');
const config = require('../config-test');
const Config = require('../../lib/configService');
const sdm = require('../../lib/sdm_context');

const LIST = {
    officialList: [{ repoName: 'dataModel.WasteManagement', dataModels: ['WasteContainer', 'WasteContainerModel'] }]
};
const WASTE_CONTEXT =
    'https://raw.githubusercontent.com/smart-data-models/dataModel.WasteManagement/refs/heads/master/context.jsonld';

describe('Smart Data Models context', function () {
    let originalFetch;
    let originalError;
    let calls;

    function stubFetch(result) {
        global.fetch = function () {
            calls++;
            return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        };
    }

    beforeEach(() => {
        Config.setConfig(config);
        originalFetch = global.fetch;
        originalError = console.error;
        console.error = () => {};
        calls = 0;
        sdm.resetCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        console.error = originalError;
        sdm.resetCache();
    });

    it('should download the official list once for many entities', async function () {
        stubFetch({ ok: true, json: () => Promise.resolve(LIST) });
        const contexts = await Promise.all(Array.from({ length: 60 }, () => sdm.getUserContextForEntityType('WasteContainer')));
        contexts.forEach((c) => c.should.equal(WASTE_CONTEXT));
        (await sdm.getUserContextForEntityType('WasteContainer')).should.equal(WASTE_CONTEXT);
        calls.should.equal(1);
    });

    it('should return the default context for types not in the list', async function () {
        stubFetch({ ok: true, json: () => Promise.resolve(LIST) });
        (await sdm.getUserContextForEntityType('Unknown')).should.equal(Config.getConfig().userContext);
    });

    it('should fall back to the default context and not retry at once when the download fails', async function () {
        stubFetch(new Error('Connect Timeout Error'));
        (await sdm.getUserContextForEntityType('WasteContainer')).should.equal(Config.getConfig().userContext);
        (await sdm.getUserContextForEntityType('WasteContainer')).should.equal(Config.getConfig().userContext);
        calls.should.equal(1);
    });
});
