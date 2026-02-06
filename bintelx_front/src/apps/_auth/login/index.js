// bnx/apps/_auth/login/index.js
import { devlog } from '@bnx/utils.js';
import { authFlow } from '@bnx/auth.js';
import { config } from '@config';
import { loadContentIntoElement } from '@bnx/loader.js';

export default function(container, data) {
  const form = container.querySelector('#login-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const showRegisterLink = container.querySelector('#show-register');

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
      // Use centralized token request method
      const token = await authFlow.requestToken(username, password);

      if (token) {
        devlog('Login successful. Passing token to auth manager.');
        if (data && typeof data.onSuccess === 'function') {
          data.onSuccess(token);
        }
      } else {
        console.error('Login failed: No token received');
        alert('Login failed: Invalid credentials or server error.');
        if(submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Login';
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert(`Login failed: ${error.message}`);
      if(submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Login';
      }
    }
  });

  // Handle register link click
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      devlog('Switching to registration form...');

      // Clear the container and load the registration form
      container.innerHTML = '';
      loadContentIntoElement(
        {
          templatePath: '_auth/register/index.tpls',
          scriptPath: '_auth/register/index.js'
        },
        container,
        {
          onSuccess: data?.onSuccess,
          onCancel: () => {
            // When user cancels registration, reload to show login again
            window.location.reload();
          }
        }
      );
    });
  }
}
