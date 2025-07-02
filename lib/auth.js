const got = require('got');

let token = null;
let expiresAt = null;

async function getToken() {
    const now = new Date();
    if (token && expiresAt && now < expiresAt) {
        return token;
    }
    // Solicitar nuevo token
    const response = await got.post(process.env.AUTH_URL, {
        json: {
            auth: {
                scope: {
                    project: {
                        domain: { name: process.env.AUTH_DOMAIN },
                        name: process.env.AUTH_PROJECT
                    }
                },
                identity: {
                    password: {
                        user: {
                            domain: { name: process.env.AUTH_DOMAIN },
                            password: process.env.AUTH_PASSWORD,
                            name: process.env.AUTH_USER
                        }
                    },
                    methods: ["password"]
                }
            }
        },
        responseType: 'json',
        throwHttpErrors: false
    });
    if (response.statusCode !== 201 && response.statusCode !== 200) {
        throw new Error('No se pudo obtener el token de autenticación');
    }
    token = response.headers['x-subject-token'];
    expiresAt = new Date(response.body.token.expires_at);
    return token;
}

module.exports = { getToken }; 