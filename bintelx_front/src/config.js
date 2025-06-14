// /src/config.js
export const config = {
    appName: 'Bintelx Clinical Agnostic Front',
    defaultLocale: 'es-CL',
    defaultRoute: '/_dashboard/index',
    appContainer: { loading: '<h2>Loading...</h2>' },
    api: {
        baseUrl: '/api/v1',
        timeout: 15000
    },
    AUTH_TOKEN_NAME: 'bnxt',
    AUTH_TOKEN_VALIDATE_ENDPOINT: '/_auth/validate',
    DEV_TOOLS_OPENED_ENDPOINT: '/_security/report',
    ENDPOINT_BASE_URL: '',
};