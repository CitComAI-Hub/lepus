/*
 * NGSI-LD and Smart Data Models conformance of the entities Lepus returns
 * (lib/sdmConformance.js).
 */

/* eslint-disable no-unused-vars */

const lepus = require('../../lib/lepus');
const SdmConformance = require('../../lib/sdmConformance');
const nock = require('nock');
const should = require('should');
const utils = require('../utils');
const request = utils.request;
const LEPUS_URL = 'http://localhost:3000/ngsi-ld/v1/';
const V2_BROKER = 'http://orion:1026';

describe('SDM conformance', function () {
    describe('adaptEntity with keyValues', function () {
        it('should leave out null attributes', function () {
            const out = SdmConformance.adaptEntity(
                { id: 'wc1', type: 'WasteContainer', fillingLevel: null, location: null, temperature: 21 },
                true
            );
            out.should.eql({ id: 'wc1', type: 'WasteContainer', temperature: 21 });
        });

        it('should make refDevice an array and map Superficie to ground', function () {
            const out = SdmConformance.adaptEntity(
                { id: 'wc1', type: 'WasteContainer', refDevice: 'device:wt:1', category: ['Superficie'] },
                true
            );
            out.refDevice.should.eql(['device:wt:1']);
            out.category.should.eql(['ground']);
        });

        it('should keep values that already conform', function () {
            const out = SdmConformance.adaptEntity(
                { id: 'wc1', type: 'WasteContainer', refDevice: ['device:wt:1'], category: ['ground'] },
                true
            );
            out.refDevice.should.eql(['device:wt:1']);
            out.category.should.eql(['ground']);
        });

        it('should leave out an intensity of -1 and keep 0', function () {
            SdmConformance.adaptEntity({ id: 't1', type: 'TrafficFlowObserved', intensity: -1 }, true).should.eql({
                id: 't1',
                type: 'TrafficFlowObserved'
            });
            SdmConformance.adaptEntity({ id: 't1', type: 'TrafficFlowObserved', intensity: 0 }, true).intensity.should.equal(0);
        });

        it('should not change other types', function () {
            const entity = { id: 'a1', type: 'AirQualityObserved', refDevice: 'x', intensity: -1, category: 'Superficie' };
            SdmConformance.adaptEntity(entity, true).should.eql(entity);
        });
    });

    describe('adaptEntity with normalized attributes', function () {
        it('should leave out null values and adapt the value only', function () {
            const out = SdmConformance.adaptEntity(
                {
                    id: 'wc1',
                    type: 'WasteContainer',
                    fillingLevel: { type: 'Number', value: null, metadata: {} },
                    refDevice: { type: 'Text', value: 'device:wt:1', metadata: { TimeInstant: {} } }
                },
                false
            );
            should.not.exist(out.fillingLevel);
            out.refDevice.should.eql({ type: 'Text', value: ['device:wt:1'], metadata: { TimeInstant: {} } });
        });
    });

    describe('When WasteContainer entities are read in keyValues', function () {
        let contextBrokerMock;
        beforeEach(function (done) {
            nock.cleanAll();
            lepus.start(require('../config-test'), () => {
                contextBrokerMock = nock(V2_BROKER)
                    .get('/v2/entities')
                    .query(true)
                    .reply(200, [
                        { id: 'wc1', type: 'WasteContainer', refDevice: 'device:wt:1', category: ['Superficie'], fillingLevel: null }
                    ]);
                done();
            });
        });
        afterEach(function (done) {
            nock.cleanAll();
            lepus.stop(function () {
                done();
            });
        });

        it('should return them conforming to SDM', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities', searchParams: 'type=WasteContainer&options=keyValues' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(200);
                    body[0].refDevice.should.eql(['device:wt:1']);
                    body[0].category.should.eql(['ground']);
                    should.not.exist(body[0].fillingLevel);
                    done();
                }
            );
        });
    });
});
