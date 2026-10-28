/*
 * NGSI_V2_PLAIN_IDS: the urn:ngsi-ld:<type>: prefix that Lepus adds to plain
 * NGSI-v2 ids is stripped again from the requests.
 */

/* eslint-disable no-unused-vars */

const lepus = require('../../lib/lepus');
const nock = require('nock');
const should = require('should');
const utils = require('../utils');
const request = utils.request;
const LEPUS_URL = 'http://localhost:3000/ngsi-ld/v1/';
const V2_BROKER = 'http://orion:1026';
const LD_ID = 'urn:ngsi-ld:WasteContainer:wastecontainer:001';
const V2_ID = 'wastecontainer:001';

let contextBrokerMock;

function startLepus(plainIds) {
    const config = Object.assign({}, require('../config-test'), { plainIds });
    return (done) => {
        nock.cleanAll();
        lepus.start(config, () => {
            done();
        });
    };
}

describe('Plain NGSI-v2 ids', function () {
    afterEach((done) => {
        lepus.stop(function () {
            done();
        });
    });

    describe('When an entity is read by id with NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(true));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/' + V2_ID)
                .reply(200, { id: V2_ID, type: 'WasteContainer' });
            done();
        });

        it('should forward the plain id and return it as a URN', function (done) {
            request({ method: 'GET', url: LEPUS_URL + 'entities/' + LD_ID }, function (error, response, body) {
                contextBrokerMock.done();
                response.statusCode.should.equal(200);
                body.id.should.equal(LD_ID);
                done();
            });
        });
    });

    describe('When the attributes of an entity are read with NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(true));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/' + V2_ID + '/attrs/temperature')
                .reply(200, { type: 'Number', value: 3 });
            done();
        });

        it('should forward the plain id', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities/' + LD_ID + '/attrs/temperature' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    done();
                }
            );
        });
    });

    describe('When entities are queried by id with NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(true));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities')
                .query({ id: V2_ID + ',wastecontainer:002', type: 'WasteContainer', options: 'count' })
                .reply(200, []);
            done();
        });

        it('should forward the plain ids', function (done) {
            request(
                {
                    method: 'GET',
                    url: LEPUS_URL + 'entities',
                    searchParams: 'type=WasteContainer&id=' + LD_ID + ',urn:ngsi-ld:WasteContainer:wastecontainer:002'
                },
                function (error, response, body) {
                    contextBrokerMock.done();
                    done();
                }
            );
        });
    });

    describe('When an entity is read by id in keyValues with NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(true));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/' + V2_ID)
                .query(true)
                .reply(200, { id: V2_ID, type: 'WasteContainer', fillingLevel: 0.5 });
            done();
        });

        it('should return the id as a URN', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities/' + LD_ID, searchParams: 'options=keyValues' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(200);
                    body.id.should.equal(LD_ID);
                    body.fillingLevel.should.equal(0.5);
                    done();
                }
            );
        });
    });

    describe('When entities are queried in keyValues with NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(true));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities')
                .query(true)
                .reply(200, [
                    { id: V2_ID, type: 'WasteContainer', fillingLevel: 0.5 },
                    { id: LD_ID, type: 'WasteContainer', fillingLevel: 0.2 }
                ]);
            done();
        });

        it('should return every id as a URN, without prefixing twice', function (done) {
            request(
                { method: 'GET', url: LEPUS_URL + 'entities', searchParams: 'type=WasteContainer&options=keyValues' },
                function (error, response, body) {
                    contextBrokerMock.done();
                    response.statusCode.should.equal(200);
                    body.map((e) => e.id).should.eql([LD_ID, LD_ID]);
                    done();
                }
            );
        });
    });

    describe('When an entity is read by id without NGSI_V2_PLAIN_IDS', function () {
        beforeEach(startLepus(false));
        beforeEach(function (done) {
            contextBrokerMock = nock(V2_BROKER)
                .get('/v2/entities/' + LD_ID)
                .reply(200, { id: LD_ID, type: 'WasteContainer' });
            done();
        });

        it('should forward the id unchanged', function (done) {
            request({ method: 'GET', url: LEPUS_URL + 'entities/' + LD_ID }, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
