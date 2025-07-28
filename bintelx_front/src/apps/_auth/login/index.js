// bnx/apps/_auth/login/index.js
import { devlog } from '../../../bnx/utils.js';
import { api } from '../../../bnx/api.js';
import { config } from '../../../config.js';

export default function(container, data) {
  const form = container.querySelector('#login-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    devlog('Login form submitted. Attempting to log in via API...');

    const username = form.elements.username.value;
    const password = form.elements.password.value;

    if(submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Logging in...';
    }

    try {
      // Llamar al endpoint de login de la API con las credenciales
      const response = await api.post(config.AUTH_LOGIN_ENDPOINT, { username, password });

      if (response && response.status === 200 && response.d && response.d.token) {
        devlog('API login successful. Passing token to auth manager.');
        if (data && typeof data.onSuccess === 'function') {
          data.onSuccess(response.d.token);
        }
      } else {
        const errorMessage = response?.message || 'Invalid response from server.';
        console.error(`Login failed: ${errorMessage}`);
        if(submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Login';
        }
      }
    } catch (error) {
      console.error('Login API call failed:', error);
      const errorMessage = error.response?.d?.message || error.message;
      alert(`Login failed: ${errorMessage}`);
      if(submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Login';
      }
    }
  });
}
