import { initializeLogApp } from './app.js';

const adminAppSection = document.getElementById('admin-app');
const adminUserName = document.getElementById('admin-user-name');
const adminAccessTriggers = document.querySelectorAll('[data-open-admin]');

function revealAdminApp() {
  if (!adminAppSection) return;

  adminAppSection.removeAttribute('hidden');
  adminAppSection.setAttribute('aria-hidden', 'false');

  if (adminUserName && adminUserName.textContent.trim().length === 0) {
    adminUserName.textContent = 'Coach Admin';
  }
}

function focusAdminApp(event) {
  if (!adminAppSection) return;

  event.preventDefault();
  adminAppSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupAdminAccess() {
  adminAccessTriggers.forEach((trigger) => {
    if (trigger.tagName.toLowerCase() === 'a') {
      return;
    }

    trigger.addEventListener('click', focusAdminApp);
  });
}

async function init() {
  revealAdminApp();
  setupAdminAccess();
  try {
    await initializeLogApp();
  } catch (error) {
    console.error('Failed to initialize admin dashboard', error);
  }
}

init().catch((error) => {
  console.error('Unexpected error while starting the app', error);
});
