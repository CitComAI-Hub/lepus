/*
 * Fiware-Service and Fiware-ServicePath deduced from the tenant and the entity type.
 */

/* eslint-disable no-unused-vars */

const lepus = require('../../lib/lepus');
const config = Object.assign({}, require('../config-test'), {
    defaultTenant: 'tef_vlci',
    servicePaths: {
        WasteContainer: '/residuos_contenedores_vlc',
        AirQualityObserved: ['/calidad_aire_vlc', '/calidad_aire_emt_vlc']
    }
});
const nock = require('nock');
const should = require('should');
const utils = require('../utils');
const request = utils.request;
const LEPUS_URL = 'http://localhost:3000/ngsi-ld/v1/';
const V2_BROKER = 'http://orion:1026';

let contextBrokerMock;

describe('Tenant and servicePath', function () {
    beforeEach((done) => {
        nock.cleanAll();
        lepus.start(config, () => {
            done();
        });
    });

    afterEach((done) => {
        lepus.stop(function () {
            done();
        });
    });

    describe('When entities are queried by type', function () {
        const options = {
            method: 'GET',
            url: LEPUS_URL + 'entities',
            searchParams: 'type=AirQualityObserved',
            headers: {
                Authorization: 'Bearer data-space-token'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .matchHeader('fiware-service', 'tef_vlci')
                .matchHeader('fiware-servicepath', '/calidad_aire_vlc')
                .matchHeader('authorization', (value) => value === undefined)
                .get('/v2/entities?type=AirQualityObserved&options=count')
                .reply(200, []);
            done();
        });

        it('should use the default tenant and the first servicePath of the type', function (done) {
            request(options, function (error, response, body) {
                contextBrokerMock.done();
                response.headers['ngsild-tenant'].should.equal('tef_vlci');
                response.headers['ngsild-path'].should.equal('/calidad_aire_vlc');
                done();
            });
        });
    });

    describe('When an entity is read by id', function () {
        const options = {
            method: 'GET',
            url: LEPUS_URL + 'entities/urn:ngsi-ld:WasteContainer:001'
        };

        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .matchHeader('fiware-service', 'tef_vlci')
                .matchHeader('fiware-servicepath', '/residuos_contenedores_vlc')
                .get('/v2/entities/urn:ngsi-ld:WasteContainer:001')
                .reply(200, utils.readExampleFile('./test/ngsi-v2/Entity.json'));
            done();
        });

        it('should take the type from the entity id', function (done) {
            request(options, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When the request has a tenant and a scopeQ', function () {
        const options = {
            method: 'GET',
            url: LEPUS_URL + 'entities',
            searchParams: 'type=WasteContainer&scopeQ=other_path',
            headers: {
                'NGSILD-Tenant': 'tenant'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .matchHeader('fiware-service', 'tenant')
                .matchHeader('fiware-servicepath', '/other_path')
                .get('/v2/entities?type=WasteContainer&options=count')
                .reply(200, []);
            done();
        });

        it('should use them instead of the defaults', function (done) {
            request(options, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When the type has no servicePath', function () {
        const options = {
            method: 'GET',
            url: LEPUS_URL + 'types'
        };

        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .matchHeader('fiware-service', 'tef_vlci')
                .matchHeader('fiware-servicepath', '/')
                .get('/v2/types')
                .reply(200, utils.readExampleFile('./test/ngsi-v2/Types.json'));
            done();
        });

        it('should use the root servicePath', function (done) {
            request(options, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
