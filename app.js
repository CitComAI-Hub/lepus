const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const nsgiLdRouter = require('./routes/ngsi-ld');
const nsgiv2Router = require('./routes/ngsi-v2');
const nocache = require('nocache');
const Request = require('./lib/request');
const tryCatch = require('./lib/errors').tryCatch;
const Tenant = require('./lib/tenant');

const app = express();
app.disable('x-powered-by');
app.set('etag', false);

app.use(logger('dev'));
const bodyParser = require('body-parser');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/*+json' }));
// Never cache
app.use(nocache());

// NGSI-v2 headers of the request. Only these are forwarded to the broker: never
// the client's Host or Authorization (the data space token).
app.use(function (req, res, next) {
    const headers = {
        'x-forwarded-for': Request.getClientIp(req),
        accept: 'application/json'
    };

    const tenant = Tenant.tenant(req);
    if (tenant) {
        res.locals.tenant = tenant;
        headers['fiware-service'] = tenant;
    }
    res.locals.servicePath = Tenant.servicePath(req);
    headers['fiware-servicepath'] = res.locals.servicePath;

    res.locals.headers = headers;
    next();
});

app.use('/ngsi/v2', nsgiv2Router);
app.use('//ngsi/v2', nsgiv2Router);
app.use('/ngsi-ld/v1', nsgiLdRouter);
app.use('//ngsi-ld/v1', nsgiLdRouter);

app.get('/context.jsonld', (req, res) => {
    return Request.serveContext(req, res);
});

app.get(
    '/health',
    tryCatch(async (req, res) => {
        const options = {
            method: 'GET',
            throwHttpErrors: false,
            retry: 0
        };
        const result = await Request.sendRequest('/../version/', options);
        return res.sendStatus(result.statusCode);
    })
);

module.exports = app;
