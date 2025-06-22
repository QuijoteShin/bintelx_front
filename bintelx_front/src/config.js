// /src/config.js
export const config = {
    appName: 'Bintelx Clinical Agnostic Front',
    defaultLocale: 'es-CL',
    defaultRoute: '/_dashboard/index',
    appContainer: { loading: '<h2>Loading...</h2>' },
    api: {
        baseUrl: '/api',
        timeout: 15000
    },
    authAppPath: '_auth/login',
    AUTH_APP_TEMPLATE_PATH: '_auth/login/index.tpls',
    AUTH_APP_SCRIPT_PATH: '_auth/login/index.js',
    AUTH_TOKEN_NAME: 'bnxt',
    AUTH_LOGIN_ENDPOINT: '/_demo/login',
    AUTH_TOKEN_VALIDATE_ENDPOINT: '/_demo/validate',
    DEV_TOOLS_OPENED_ENDPOINT: '/_demo/report',
};