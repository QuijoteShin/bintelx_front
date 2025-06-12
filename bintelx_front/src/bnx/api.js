const API_BASE_URL = 'https://api.bintelx.com/v1'; // Placeholder

// Mock user data for initial development
const mockUsers = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

/**
 * A wrapper for the fetch API.
 * @param {string} endpoint - The API endpoint to call (e.g., '/users').
 * @param {object} options - The options for the fetch call.
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Placeholder for auth token logic
  const token = localStorage.getItem('authToken');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // --- MOCKING LOGIC ---
  // For this initial build, we will return mock data for specific endpoints.
  if (endpoint === '/users' && options.method === 'GET') {
    console.log(`[MOCK API] GET ${url}`);
    return new Promise(resolve => setTimeout(() => resolve(mockUsers), 500));
  }
  // --- END MOCKING LOGIC ---

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  // Add put, delete, etc. as needed
};
