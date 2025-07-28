// /src/apps/_auth/login/step2.js
// Mock API and config for example purposes
const mockApi = {
  post: (endpoint, data) => {
    console.log(`Mock API POST to ${endpoint} with data:`, data);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (data.username === 'test' && data.password === 'password') {
          resolve({ success: true, token: 'fake-jwt-token-12345' });
        } else {
          reject({ success: false, message: 'Invalid credentials' });
        }
      }, 500);
    });
  }
};
const mockConfig = { AUTH_LOGIN_ENDPOINT: '/api/login' };
// End Mock

export default function(stepElement, data) {
  const { stepData, updateStepDataCallback  } = data;
  console.log('Step 2 (_auth/login/step2.js) loaded.', stepData);
  const passwordInput = stepElement.querySelector('#password');
  const passwordError = stepElement.querySelector('#passwordError');

  if (stepData && stepData.password) {
    passwordInput.value = stepData.password;
  }

  passwordInput.addEventListener('input', () => {
    updateStepDataCallback({ password: passwordInput.value });
    validatePassword();
  });

  function validatePassword() {
    const isValid = passwordInput.value.length >= 6;
    if (!isValid) {
      passwordError.textContent = 'Password must be at least 6 characters.';
    } else {
      passwordError.textContent = '';
    }
    return isValid;
  }

  // Expose validate function for the stepper
  stepElement.validate = () => {
    console.log('Step 2 validate called');
    const isValid = validatePassword();
    // This validation is for the field itself. 
    // The actual login attempt (which is also a form of validation) happens on flowComplete.
    return isValid;
  };

  // Expose a function to be called on flowComplete by two-step-login.js
  // This function will perform the API call.
  stepElement.submitLogin = async (loginData) => {
    try {
      const response = await mockApi.post(mockConfig.AUTH_LOGIN_ENDPOINT, loginData);
      console.log('Login API call successful', response);
      return response; // Contains token
    } catch (error) {
      console.error('Login API call failed', error);
      passwordError.textContent = error.message || 'Login failed.';
      throw error; // Re-throw to be caught by two-step-login.js
    }
  };
}
