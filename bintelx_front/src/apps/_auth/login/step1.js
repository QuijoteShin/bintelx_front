// /src/apps/_auth/login/step1.js
export default function(stepElement, data) {
  const { stepData, updateStepDataCallback  } = data;
  console.log('Step 1 (_auth/login/step1.js) loaded.', stepData);
  const usernameInput = stepElement.querySelector('#username');
  const usernameError = stepElement.querySelector('#usernameError');

  if (stepData && stepData.username) {
    usernameInput.value = stepData.username;
  }

  usernameInput.addEventListener('input', () => {
    updateStepDataCallback({ username: usernameInput.value });
    validateUsername();
  });

  function validateUsername() {
    const isValid = usernameInput.value.trim() !== '';
    if (!isValid) {
      usernameError.textContent = 'Username is required.';
    } else {
      usernameError.textContent = '';
    }
    return isValid;
  }

  // Expose validate function for the stepper
  stepElement.validate = () => {
    console.log('Step 1 validate called');
    return validateUsername();
  };
}
