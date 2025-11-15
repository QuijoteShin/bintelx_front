// /src/config.js
export const config = {
    appName: 'Bintelx Enterprise Agnostic Front',
    defaultLocale: 'es-CL',
    defaultRoute: '/_dashboard/index',
    appContainer: { loading: '<h2>Loading...</h2>' },
    api: {
        baseUrl: __API_BASE_URL__,
        timeout: __API_TIMEOUT__
    },
    authAppPath: '_auth/login',
    AUTH_APP_TEMPLATE_PATH: '_auth/login/index.tpls',
    AUTH_APP_SCRIPT_PATH: '_auth/login/index.js',
    AUTH_TOKEN_NAME: 'bnxt',
    AUTH_LOGIN_ENDPOINT: __AUTH_LOGIN_ENDPOINT__,
    AUTH_TOKEN_VALIDATE_ENDPOINT: __AUTH_VALIDATE_ENDPOINT__,
    DEV_TOOLS_OPENED_ENDPOINT: __AUTH_REPORT_ENDPOINT__,
};