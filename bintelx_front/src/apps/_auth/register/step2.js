// /src/apps/_auth/register/step2.js
import { api } from '../../../bnx/api.js';
import { config } from '../../../config.js';

export default function(stepElement, data) {
  const { stepData, updateStepDataCallback } = data;
  console.log('Step 2 (register/step2.js) loaded.', stepData);

  const profileNameInput = stepElement.querySelector('#profile-name');
  const entityNameInput = stepElement.querySelector('#entity-name');
  const entityTypeSelect = stepElement.querySelector('#entity-type');
  const nationalIdInput = stepElement.querySelector('#national-id');
  const nationalIsocodeSelect = stepElement.querySelector('#national-isocode');

  const profileNameError = stepElement.querySelector('#profileNameError');
  const entityNameError = stepElement.querySelector('#entityNameError');
  const entityTypeError = stepElement.querySelector('#entityTypeError');
  const nationalIdError = stepElement.querySelector('#nationalIdError');
  const nationalIsocodeError = stepElement.querySelector('#nationalIsocodeError');

  // Restore data if user went back
  if (stepData) {
    if (stepData.profileName) profileNameInput.value = stepData.profileName;
    if (stepData.entityName) entityNameInput.value = stepData.entityName;
    if (stepData.entityType) entityTypeSelect.value = stepData.entityType;
    if (stepData.nationalId) nationalIdInput.value = stepData.nationalId;
    if (stepData.nationalIsocode) nationalIsocodeSelect.value = stepData.nationalIsocode;
  }

  // Input event listeners to update stepData
  profileNameInput.addEventListener('input', () => {
    updateStepDataCallback({ profileName: profileNameInput.value });
    clearError(profileNameError);
  });

  entityNameInput.addEventListener('input', () => {
    updateStepDataCallback({ entityName: entityNameInput.value });
    clearError(entityNameError);
  });

  entityTypeSelect.addEventListener('change', () => {
    updateStepDataCallback({ entityType: entityTypeSelect.value });
    clearError(entityTypeError);
  });

  nationalIdInput.addEventListener('input', () => {
    updateStepDataCallback({ nationalId: nationalIdInput.value });
    clearError(nationalIdError);
  });

  nationalIsocodeSelect.addEventListener('change', () => {
    updateStepDataCallback({ nationalIsocode: nationalIsocodeSelect.value });
    clearError(nationalIsocodeError);
  });

  function clearError(errorElement) {
    errorElement.textContent = '';
  }

  // Validation functions
  function validateProfileName() {
    const profileName = profileNameInput.value.trim();
    if (profileName === '') {
      profileNameError.textContent = 'El nombre del perfil es requerido.';
      return false;
    }
    profileNameError.textContent = '';
    return true;
  }

  function validateEntityName() {
    const entityName = entityNameInput.value.trim();
    if (entityName === '') {
      entityNameError.textContent = 'El nombre completo es requerido.';
      return false;
    }
    entityNameError.textContent = '';
    return true;
  }

  function validateNationalId() {
    const nationalId = nationalIdInput.value.trim();
    if (nationalId === '') {
      nationalIdError.textContent = 'La identificaci\u00f3n nacional es requerida.';
      return false;
    }
    nationalIdError.textContent = '';
    return true;
  }

  // Expose validate function for the stepper
  stepElement.validate = () => {
    console.log('Step 2 validate called');
    const isProfileNameValid = validateProfileName();
    const isEntityNameValid = validateEntityName();
    const isNationalIdValid = validateNationalId();
    return isProfileNameValid && isEntityNameValid && isNationalIdValid;
  };

  // Expose submitProfile function to be called on flowComplete
  stepElement.submitProfile = async (profileData) => {
    try {
      // accountId should be stored in stepData from step 1
      if (!profileData.accountId) {
        throw new Error('No se encontr\u00f3 el ID de cuenta. Por favor, int\u00e9ntalo de nuevo.');
      }

      const response = await api.post('/_demo/profile/create', {
        accountId: profileData.accountId,
        profileName: profileData.profileName,
        entityName: profileData.entityName,
        entityType: profileData.entityType,
        nationalId: profileData.nationalId,
        nationalIsocode: profileData.nationalIsocode
      });

      // Accept 2xx status codes (200-299)
      if (response && response.status >= 200 && response.status < 300 && response.d) {
        // Verify success flag if present
        if (response.d.success === false) {
          const errorMessage = response.d.message || 'Error al crear el perfil.';
          profileNameError.textContent = errorMessage;
          throw new Error(errorMessage);
        }

        console.log('Profile creation successful:', response.d);
        return response.d;
      } else {
        const errorMessage = response?.message || 'Error al crear el perfil.';
        profileNameError.textContent = errorMessage;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Profile creation API call failed:', error);
      const errorMessage = error.response?.d?.message || error.message || 'Error al crear el perfil.';
      profileNameError.textContent = errorMessage;
      throw error;
    }
  };
}
