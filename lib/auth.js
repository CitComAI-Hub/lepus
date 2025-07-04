const got = require('got');

// Cache de tokens por combinación domain+project
const tokenCache = {};

async function getToken(domain, project) {
    const cacheKey = `${domain}::${project}`;
    const now = new Date();
    const cached = tokenCache[cacheKey];
    if (cached && cached.token && cached.expiresAt && now < cached.expiresAt) {
        return cached.token;
    }
    // Solicitar nuevo token
    const response = await got.post(process.env.AUTH_URL, {
        json: {
            auth: {
                scope: {
                    project: {
                        domain: { name: domain },
                        name: project
                    }
                },
                identity: {
                    password: {
                        user: {
                            domain: { name: domain },
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
    const token = response.headers['x-subject-token'];
    const expiresAt = new Date(response.body.token.expires_at);
    tokenCache[cacheKey] = { token, expiresAt };
    return token;
}

module.exports = { getToken }; 