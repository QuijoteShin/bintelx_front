// src/apps/users/list.js

import { api } from '../../bnx/api.js';
import { renderTemplate, devlog } from '../../bnx/utils.js';
import './list.css';

const loadingTemplate = `<p>Loading users...</p>`;

const errorTemplate = `
  <div class="state-container">
    <p class="state-text-error">An error occurred while fetching users.</p>
    <button id="retry-button" class="button-primary">Try Again</button>
  </div>
`;

const emptyStateTemplate = `
  <div class="state-container">
    <svg class="state-icon" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.14-2.72a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.14-2.72a3 3 0 0 1-4.682-2.72 9.094 9.094 0 0 1 3.741-.479m-3.741 2.72a9.094 9.094 0 0 0-3.741.479m14.459 0a9.094 9.094 0 0 1-3.741-.479m-3.741 2.72a3 3 0 0 1-4.682 2.72 3 3 0 0 1-4.682-2.72" />
    </svg>
    <h3 class="state-title">No users yet</h3>
    <p class="state-description">Get started by adding your first user.</p>
    <button id="add-user-button" class="button-primary">+ Add User</button>
  </div>
`;

const userItemTemplate = '<li><span class="math-inline">${user.name} - <em></span>${user.email}</em></li>';

// --- Main Application Logic ---

// Keep track of the main container
let mainContainer;

/**
 * Renders the final list of users.
 * @param {Array} users - The array of user objects.
 */
function renderUserList(users) {
  devlog('data',users);
  const userListHtml = users.map(user => renderTemplate(userItemTemplate, { user })).join('');
  mainContainer.innerHTML = `<ul>${userListHtml}</ul>`;
}

/**
 * Renders an improved empty state with a call to action.
 */
function renderEmptyState() {
  mainContainer.innerHTML = emptyStateTemplate;
  // We can add event listeners to the buttons now
  mainContainer.querySelector('#add-user-button').addEventListener('click', () => {
    alert('Navigating to Add User form...');
    // Here you would navigate to the "add user" page, e.g., using the router.
  });
}

/**
 * Renders a user-friendly error message with a retry button.
 */
function renderErrorState() {
  mainContainer.innerHTML = errorTemplate;
  mainContainer.querySelector('#retry-button').addEventListener('click', fetchAndRenderUsers);
}

/**
 * Main function to fetch data and decide which state to render.
 */
async function fetchAndRenderUsers() {
  mainContainer.innerHTML = loadingTemplate; // Show loading state first

  try {
    const users = await api.get('/_users');
    if (users && users.length > 0) {
      renderUserList(users);
    } else {
      renderEmptyState();
    }
  } catch (error) {
    console.error('Failed to fetch and render users:', error);
    renderErrorState();
  }
}

/**
 * Default export function, the entry point for this app.
 * @param {HTMLElement} container - The main container element for this app.
 */
export default function(container) {
  mainContainer = container.querySelector('#user-list-container');
  if (mainContainer) {
    fetchAndRenderUsers();
  } else {
    console.error('User list container #user-list-container not found.');
  }
}