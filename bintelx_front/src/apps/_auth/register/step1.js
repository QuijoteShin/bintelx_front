// /src/apps/_auth/register/step1.js
import { api } from '@bnx/api.js';
import { authFlow } from '@bnx/auth.js';
import { config } from '@config';

export default function(stepElement, data) {
  const { stepData, updateStepDataCallback } = data;
  console.log('Step 1 (register/step1.js) loaded.', stepData);

  const usernameInput = stepElement.querySelector('#reg-username');
  const passwordInput = stepElement.querySelector('#reg-password');
  const passwordConfirmInput = stepElement.querySelector('#reg-password-confirm');
  const usernameError = stepElement.querySelector('#usernameError');
  const passwordError = stepElement.querySelector('#passwordError');
  const passwordConfirmError = stepElement.querySelector('#passwordConfirmError');

  // Restore data if user went back
  if (stepData && stepData.username) {
    usernameInput.value = stepData.username;
  }

  // Input event listeners to update stepData
  usernameInput.addEventListener('input', () => {
    updateStepDataCallback({ username: usernameInput.value });
    validateUsername();
  });

  passwordInput.addEventListener('input', () => {
    updateStepDataCallback({ password: passwordInput.value });
    validatePassword();
    // Also re-validate confirm password if it has a value
    if (passwordConfirmInput.value) {
      validatePasswordConfirm();
    }
  });

  passwordConfirmInput.addEventListener('input', () => {
    validatePasswordConfirm();
  });

  // Validation functions
  function validateUsername() {
    const username = usernameInput.value.trim();
    let isValid = true;

    if (username === '') {
      usernameError.textContent = 'El nombre de usuario es requerido.';
      isValid = false;
    } else if (username.length < 3) {
      usernameError.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
      isValid = false;
    } else {
      usernameError.textContent = '';
    }

    return isValid;
  }

  function validatePassword() {
    const password = passwordInput.value;
    let isValid = true;

    if (password === '') {
      passwordError.textContent = 'La contrase\u00f1a es requerida.';
      isValid = false;
    } else if (password.length < 6) {
      passwordError.textContent = 'La contrase\u00f1a debe tener al menos 6 caracteres.';
      isValid = false;
    } else {
      passwordError.textContent = '';
    }

    return isValid;
  }

  function validatePasswordConfirm() {
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;
    let isValid = true;

    if (passwordConfirm === '') {
      passwordConfirmError.textContent = 'Debes confirmar tu contrase\u00f1a.';
      isValid = false;
    } else if (password !== passwordConfirm) {
      passwordConfirmError.textContent = 'Las contrase\u00f1as no coinciden.';
      isValid = false;
    } else {
      passwordConfirmError.textContent = '';
    }

    return isValid;
  }

  // Expose validate function for the stepper
  stepElement.validate = () => {
    console.log('Step 1 validate called');
    const isUsernameValid = validateUsername();
    const isPasswordValid = validatePassword();
    const isPasswordConfirmValid = validatePasswordConfirm();
    return isUsernameValid && isPasswordValid && isPasswordConfirmValid;
  };

  // Expose submitRegistration function to be called by the main script
  stepElement.submitRegistration = async (registrationData) => {
    try {
      // Step 1: Create the account
      const registerResponse = await api.post('/_demo/register', {
        username: registrationData.username,
        password: registrationData.password
      });

      // Check for 2xx status codes (200-299) and valid response
      if (registerResponse && registerResponse.status >= 200 && registerResponse.status < 300 && registerResponse.d) {
        console.log('Registration API response:', registerResponse);

        // Verify success flag if present
        if (registerResponse.d.success === false) {
          const errorMessage = registerResponse.d.message || 'Error en el registro.';
          usernameError.textContent = errorMessage;
          throw new Error(errorMessage);
        }

        // Handle nested data structure: response.d.data contains the actual data
        const actualData = registerResponse.d.data || registerResponse.d;
        const accountId = actualData.accountId;

        if (!accountId) {
          throw new Error('No se recibió el ID de cuenta del servidor.');
        }

        console.log('Account created with ID:', accountId);

        // Extract profileId and entityId from response (automatically created by backend)
        const profileId = actualData.profileId;
        const entityId = actualData.entityId;

        if (!profileId || !entityId) {
          console.warn('Profile or Entity ID not received from server. Profile update may fail.');
        } else {
          console.log('Profile and Entity created:', { profileId, entityId });
        }

        // Step 2: Request token using centralized method
        console.log('Requesting authentication token...');
        const token = await authFlow.requestToken(
          registrationData.username,
          registrationData.password
        );

        if (!token) {
          console.warn('Account created but token request failed. User may need to login manually.');
        } else {
          console.log('Token obtained successfully');
        }

        return {
          accountId: accountId,
          profileId: profileId,
          entityId: entityId,
          token: token
        };
      } else {
        const errorMessage = registerResponse?.message || 'Error en el registro.';
        usernameError.textContent = errorMessage;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error.response?.d?.message || error.message || 'Error al registrar usuario.';
      usernameError.textContent = errorMessage;
      throw error;
    }
  };
}
