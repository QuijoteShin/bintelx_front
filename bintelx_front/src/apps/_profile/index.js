// src/apps/_profile/index.js
import { api } from '../../bnx/api.js';
import { devlog } from '../../bnx/utils.js';
import { authFlow } from '../../bnx/auth.js';
import './index.css';

let cachedProfile = null;

export default function(container) {
  devlog('Profile module loaded');

  // Initialize tabs
  initializeTabs(container);

  // Initialize forms
  initializePasswordForm(container);
  initializeNameForm(container);
  initializeEmailForm(container);

  // Initialize logout button
  initializeLogoutButton(container);

  // Load user profile data
  loadProfileData(container);
}

/**
 * Initialize tab navigation
 */
function initializeTabs(container) {
  const tabs = container.querySelectorAll('[role="tab"]');
  const panels = container.querySelectorAll('[role="tabpanel"]');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('aria-controls');

      // Deactivate all tabs and panels
      tabs.forEach(t => {
        t.setAttribute('aria-selected', 'false');
        t.classList.remove('active');
      });
      panels.forEach(p => {
        p.hidden = true;
      });

      // Activate current tab and panel
      e.currentTarget.setAttribute('aria-selected', 'true');
      e.currentTarget.classList.add('active');
      const panel = container.querySelector(`#${target}`);
      if (panel) {
        panel.hidden = false;
      }

      devlog(`Tab switched to: ${target}`);
    });
  });
}

/**
 * Initialize password change form
 */
function initializePasswordForm(container) {
  const form = container.querySelector('#form-password');
  const cancelBtn = container.querySelector('#cancel-password');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const currentPassword = formData.get('current_password');
      const newPassword = formData.get('new_password');
      const confirmPassword = formData.get('confirm_password');

      // Validate passwords match
      if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
      }

      // Validate password strength
      if (newPassword.length < 8) {
        alert('La contraseña debe tener al menos 8 caracteres');
        return;
      }

      try {
        devlog('Submitting password change...');
        await api.put('/profile/password', {
          current_password: currentPassword,
          new_password: newPassword
        });
        alert('Contraseña actualizada exitosamente');
        form.reset();
      } catch (error) {
        console.error('Error updating password:', error);
        alert('Error al actualizar la contraseña. Por favor intenta de nuevo.');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.reset();
      devlog('Password form cancelled');
    });
  }
}

/**
 * Initialize name edit form
 */
function initializeNameForm(container) {
  const form = container.querySelector('#form-name');
  const cancelBtn = container.querySelector('#cancel-name');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const firstName = formData.get('first_name');
      const lastName = formData.get('last_name');
      const displayName = formData.get('display_name');

      try {
        devlog('Submitting name change...');
        await api.put('/profile/name', {
          first_name: firstName,
          last_name: lastName,
          display_name: displayName
        });
        await loadProfileData(container);
        alert('Nombre actualizado exitosamente');
      } catch (error) {
        console.error('Error updating name:', error);
        alert('Error al actualizar el nombre. Por favor intenta de nuevo.');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (cachedProfile) populateForms(container, cachedProfile);
      devlog('Name form cancelled and reset');
    });
  }
}

/**
 * Initialize email edit form
 */
function initializeEmailForm(container) {
  const form = container.querySelector('#form-email');
  const cancelBtn = container.querySelector('#cancel-email');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const newEmail = formData.get('new_email');
      const confirmEmail = formData.get('confirm_email');
      const password = formData.get('password');

      // Validate emails match
      if (newEmail !== confirmEmail) {
        alert('Los correos electrónicos no coinciden');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        alert('Por favor ingresa un correo electrónico válido');
        return;
      }

      try {
        devlog('Submitting email change...');
        await api.put('/profile/email', {
          new_email: newEmail,
          password: password
        });
        // Optimistic UI update while refetching from API
        if (cachedProfile) {
          cachedProfile.account_email = newEmail;
          cachedProfile.profile_email = newEmail;
          cachedProfile.email = newEmail;
          updateDashboard(container, cachedProfile);
          populateForms(container, cachedProfile);
        }
        await loadProfileData(container);
        alert('Se ha actualizado el correo a ' + newEmail);
        form.reset();
      } catch (error) {
        console.error('Error updating email:', error);
        alert('Error al actualizar el correo. Por favor intenta de nuevo.');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.reset();
      if (cachedProfile) populateForms(container, cachedProfile);
      devlog('Email form cancelled');
    });
  }
}

/**
 * Load user profile data from API
 */
async function loadProfileData(container) {
  try {
    devlog('Loading profile data...');
    const response = await api.get('/profile');
    const payload = response?.d || {};
    const profile = payload.data || payload || {};
    cachedProfile = {
      ...profile,
      display_name: profile.display_name || profile.profile_name || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      role: profile.role || 'usuario',
      last_login: profile.last_login || 'N/D',
      active_sessions: profile.active_sessions ?? 1,
      created_at: profile.created_at || ''
    };

    // Update dashboard with real data
    updateDashboard(container, cachedProfile);

    // Populate forms with current data
    populateForms(container, cachedProfile);

  } catch (error) {
    console.error('Error loading profile:', error);
    // Show error state
    const dashboard = container.querySelector('.profile-dashboard');
    if (dashboard) {
      dashboard.innerHTML = `
        <div class="error-state">
          <p>Error al cargar el perfil</p>
          <button class="button-primary" onclick="location.reload()">Reintentar</button>
        </div>
      `;
    }
  }
}

/**
 * Update dashboard with profile data
 */
function updateDashboard(container, profile) {
  const userName = container.querySelector('.user-name');
  const userEmail = container.querySelector('.user-email');
  const userProfileEmail = container.querySelector('.user-profile-email');
  const userRole = container.querySelector('.user-role');

  const fallbackName = `${profile.first_name} ${profile.last_name}`.trim();
  if (userName) userName.textContent = profile.display_name || fallbackName || profile.email || 'Usuario';
  if (userEmail) userEmail.textContent = `Cuenta: ${profile.account_email || profile.email || 'N/D'}`;
  if (userProfileEmail) userProfileEmail.textContent = `Perfil: ${profile.profile_email || profile.email || 'N/D'}`;
  if (userRole) userRole.textContent = profile.role || 'usuario';

  // Update stats
  const statValues = container.querySelectorAll('.stat-value');
  if (statValues.length >= 3) {
    statValues[0].textContent = profile.last_login || 'N/D';
    statValues[1].textContent = `${profile.active_sessions || 0} dispositivos`;
    statValues[2].textContent = profile.created_at || 'N/D';
  }
}

/**
 * Populate forms with current profile data
 */
function populateForms(container, profile) {
  // Name form
  const firstNameInput = container.querySelector('#first-name');
  const lastNameInput = container.querySelector('#last-name');
  const displayNameInput = container.querySelector('#display-name');

  if (firstNameInput) firstNameInput.value = profile.first_name;
  if (lastNameInput) lastNameInput.value = profile.last_name;
  if (displayNameInput) displayNameInput.value = profile.display_name;

  // Email form
  const currentEmailInput = container.querySelector('#current-email');
  if (currentEmailInput) currentEmailInput.value = profile.account_email || profile.email;
  const currentProfileEmailInput = container.querySelector('#current-profile-email');
  if (currentProfileEmailInput) currentProfileEmailInput.value = profile.profile_email || profile.email;
}

/**
 * Initialize logout button
 */
function initializeLogoutButton(container) {
  const logoutBtn = container.querySelector('#logout-button');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      devlog('Logout button clicked');

      // Optional: Show confirmation dialog
      const confirmed = confirm('¿Estás seguro que deseas cerrar sesión?');

      if (confirmed) {
        devlog('User confirmed logout');
        authFlow.logout();
      } else {
        devlog('User cancelled logout');
      }
    });
  }
}
