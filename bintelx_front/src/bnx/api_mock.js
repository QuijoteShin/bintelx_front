// src/bnx/api_mock.js
import {devlog} from "./utils";
import {config} from "../config";

// --- Mock Data ---
const mockUsers = [
    { id: 1, name: 'Alice Developer', email: 'alice@example.com' },
    { id: 2, name: 'Bob Tester', email: 'bob@example.com' },
    { id: 3, name: 'Charlie Mock', email: 'charlie@example.com' },
];

/**
 * Processes a request and returns a mock response if found.
 * @param {string} endpoint - The API endpoint (e.g., '/users').
 * @param {object} options - The request options, including the method and body.
 * @returns {Promise<any>|null} - A Promise that resolves to the mock data, or null if there is no mock for this route.
 */
async function handleMockRequest(endpoint, options) {
    const url = `http://mock.api${endpoint}`;

    switch (`${options.method.toUpperCase()} ${endpoint}`) {

        case 'GET /_users':
            devlog(`[MOCK API] Intercepted: GET ${url}`);
            return new Promise(resolve => setTimeout(() => resolve(mockUsers), 500));

        case 'POST /_security/devtools-opened':
            devlog(`[MOCK API] Intercepted: POST ${url} with body:`, options.body);
            return Promise.resolve({ status: 'logged' });
            
        case 'POST /_demo/form/push':
            devlog(`[MOCK API] Intercepted FormData: POST ${url}`);

            const formData = options.body;
            const files = formData.getAll('documentos');

            devlog(`   > Received Name: ${formData.childNodes.length}`);
            devlog(`   > Received ${files.length} file(s):`);

            const uploadedFilesInfo = files.map(file => {
                devlog(`     - File Name: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);
                console.table(file);
                return {
                    filename: file.name,
                    size: file.size,
                    type: file.type
                };
            });

            const mockResponse = {
                status: 'success',
                message: `Form data for '${userName}' received successfully.`,
                filesProcessed: files.length,
                files: uploadedFilesInfo
            };

            return new Promise(resolve => setTimeout(() => resolve(mockResponse), 800));

        // case `POST ${config.AUTH_LOGIN_ENDPOINT}`:
        //     devlog(`[MOCK API] Intercepted: POST ${url}`);
        //     const credentials = options.body;
        //     // just send both
        //     if ((credentials.username && credentials.password)
        //         && (credentials.username !== credentials.password)
        //     ) {
        //         devlog(`   > Login attempt for user: ${credentials.username}`);
        //         // fake token
        //         return Promise.resolve({
        //             status: 'success',
        //             token: 'mock-token-from-api-login-endpoint-valid'
        //         });
        //     } else {
        //         return Promise.reject(new Error('Invalid credentials'));
        //     }
        //  case `POST ${config.AUTH_TOKEN_VALIDATE_ENDPOINT}`:
        //        const bodyT = options.body;
        //        devlog(`[MOCK API] Intercepted: POST ${url} with token: ${bodyT.token}`);
        //        if (bodyT.token) { // Cualquier token es válido en este mock
        //            return Promise.resolve({ status: 'success' });
        //        } else {
        //            return Promise.reject(new Error('Invalid Mock Token'));
        //        }

        default:
            // keep api call
            return null;
    }
}

export default handleMockRequest;