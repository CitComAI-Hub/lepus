/*
 * Reads by id must return only the entity type that the authorization policy
 * (odrl-pap ngsi-ld:entityType) allowed. odrl-pap takes that type from the last
 * path segment (urn:ngsi-ld:<type>:<id>) or else from ?type=; Lepus makes Orion
 * enforce the same type, so an id that names one type cannot fetch an entity of
 * another one.
 */

/* eslint-disable no-unused-vars */

const lepus = require('../../lib/lepus');
const nock = require('nock');
const should = require('should');
const utils = require('../utils');
const request = utils.request;
const LEPUS_URL = 'http://localhost:3000/ngsi-ld/v1/';
const V2_BROKER = 'http://orion:1026';

let contextBrokerMock;

function startLepus(done) {
    const config = Object.assign({}, require('../config-test'), { plainIds: true });
    nock.cleanAll();
    lepus.start(config, () => {
        done();
    });
}

describe('Type authorized by the path', function () {
    beforeEach(startLepus);
    afterEach((done) => {
        nock.cleanAll();
        lepus.stop(function () {
            done();
        });
    });

    describe('When an id names a type that is not the entity type', function () {
        beforeEach(function (done) {
            // aq001 is an AirQualityObserved: Orion finds no WasteContainer with that id
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/aq001')
                .query({ type: 'WasteContainer' })
                .reply(404, { error: 'NotFound', description: 'The requested entity has not been found.' });
            done();
        });

        it('should make Orion check that type and return 404', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities/urn:ngsi-ld:WasteContainer:aq001' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(404);
                    done();
                }
            );
        });
    });

    describe('When the client adds another ?type= to an id that names a type', function () {
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/aq001')
                .query({ type: 'WasteContainer' })
                .reply(404, { error: 'NotFound', description: 'The requested entity has not been found.' });
            done();
        });

        it('should send the type named by the id, not the one from the client', function (done) {
            request(
                {
                    method: 'GET',
                    url: LEPUS_URL + 'entities/urn:ngsi-ld:WasteContainer:aq001?type=AirQualityObserved'
                },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(404);
                    done();
                }
            );
        });
    });

    describe('When an attribute is read and the last segment names no type', function () {
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/aq001/attrs/no2')
                .query({ type: 'WasteContainer' })
                .reply(404, { error: 'NotFound', description: 'The requested entity has not been found.' });
            done();
        });

        it('should forward the ?type= the policy checked, not the type named by the id', function (done) {
            request(
                {
                    method: 'GET',
                    url: LEPUS_URL + 'entities/urn:ngsi-ld:AirQualityObserved:aq001/attrs/no2?type=WasteContainer'
                },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(404);
                    done();
                }
            );
        });
    });

    describe('When the id names the right type', function () {
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/wc001')
                .query({ type: 'WasteContainer' })
                .reply(200, { id: 'wc001', type: 'WasteContainer' });
            done();
        });

        it('should return the entity', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities/urn:ngsi-ld:WasteContainer:wc001' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(200);
                    body.id.should.equal('urn:ngsi-ld:WasteContainer:wc001');
                    done();
                }
            );
        });
    });
});
