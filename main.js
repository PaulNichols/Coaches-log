import { initializeLogApp } from './app.js';

const defaultConfig = {
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
    appId: 'YOUR_FIREBASE_APP_ID',
  },
  adminEmails: ['coach@example.com'],
};

const globalConfig = window.COACHES_LOG_CONFIG || {};
const firebaseConfig = {
  ...defaultConfig.firebase,
  ...(globalConfig.firebase || {}),
};
const adminEmails = Array.isArray(globalConfig.adminEmails) && globalConfig.adminEmails.length
  ? globalConfig.adminEmails
  : defaultConfig.adminEmails;

const sanitizedAdminEmails = new Set(
  adminEmails
    .filter((email) => typeof email === 'string' && email.trim().length > 0)
    .map((email) => email.trim().toLowerCase()),
);

const loginOverlay = document.getElementById('admin-login');
const openLoginButtons = document.querySelectorAll('[data-open-login]');
const closeLoginButton = document.getElementById('close-login');
const loginStatus = document.getElementById('login-status');
const loginError = document.getElementById('login-error');
const loginInstructions = document.getElementById('login-instructions');
const authButtons = document.querySelectorAll('[data-auth-provider]');
const adminAppSection = document.getElementById('admin-app');
const adminUserName = document.getElementById('admin-user-name');
const signOutButton = document.getElementById('sign-out-button');

let firebaseModules = null;
let authInstance = null;
let adminInitialized = false;
let unauthorizedMessage = '';

const firebaseConfigured = isFirebaseConfigured(firebaseConfig);

updateLoginAvailability();

if (firebaseConfigured) {
  ensureFirebase().catch((error) => {
    console.error('Authentication setup failed', error);
    showLoginError('Unable to initialize sign-in. Check your Firebase configuration.');
  });
} else if (loginInstructions) {
  loginInstructions.textContent =
    'Connect Firebase Authentication to enable admin sign-in for the coaching dashboard.';
}

openLoginButtons.forEach((button) => {
  button.addEventListener('click', () => {
    clearMessages();
    showLoginOverlay();
  });
});

if (closeLoginButton) {
  closeLoginButton.addEventListener('click', hideLoginOverlay);
}

if (loginOverlay) {
  loginOverlay.addEventListener('click', (event) => {
    if (event.target === loginOverlay) {
      hideLoginOverlay();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && loginOverlay && !loginOverlay.hasAttribute('hidden')) {
    hideLoginOverlay();
  }
});

authButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (!firebaseConfigured) return;
    clearMessages();
    button.classList.add('is-loading');
    button.disabled = true;

    try {
      const modules = await ensureFirebase();
      const provider =
        button.dataset.authProvider === 'google'
          ? new modules.GoogleAuthProvider()
          : new modules.OAuthProvider('apple.com');

      if (button.dataset.authProvider === 'google') {
        provider.setCustomParameters({ prompt: 'select_account' });
      } else {
        provider.addScope('email');
        provider.addScope('name');
      }

      await modules.signInWithPopup(authInstance, provider);
      loginStatus.textContent = 'Signing you in…';
    } catch (error) {
      handleSignInError(error);
    } finally {
      button.classList.remove('is-loading');
      button.disabled = false;
    }
  });
});

if (signOutButton) {
  signOutButton.addEventListener('click', async () => {
    try {
      const modules = await ensureFirebase();
      await modules.signOut(authInstance);
      loginStatus.textContent = 'You have signed out.';
      clearAdminDetails();
      showLoginOverlay();
    } catch (error) {
      console.error('Sign out failed', error);
      showLoginError('Sign out failed. Please try again.');
    }
  });
}

function isFirebaseConfigured(config) {
  if (!config || typeof config !== 'object') return false;
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return requiredKeys.every((key) => {
    const value = config[key];
    return (
      typeof value === 'string' &&
      value.trim() !== '' &&
      !/YOUR_|REPLACE_ME|EXAMPLE/.test(value)
    );
  });
}

function updateLoginAvailability() {
  authButtons.forEach((button) => {
    button.disabled = !firebaseConfigured;
    button.setAttribute('aria-disabled', String(!firebaseConfigured));
  });
}

function showLoginOverlay() {
  if (!loginOverlay) return;
  loginOverlay.removeAttribute('hidden');
  loginOverlay.classList.add('is-visible');
  document.body.classList.add('login-open');
}

function hideLoginOverlay() {
  if (!loginOverlay) return;
  loginOverlay.classList.remove('is-visible');
  loginOverlay.setAttribute('hidden', '');
  document.body.classList.remove('login-open');
}

function clearMessages() {
  if (loginStatus) loginStatus.textContent = '';
  if (loginError) loginError.textContent = '';
}

function showLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
  }
}

function clearAdminDetails() {
  if (adminUserName) adminUserName.textContent = '';
  if (adminAppSection) {
    adminAppSection.setAttribute('hidden', '');
    adminAppSection.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-active');
  }
}

async function ensureFirebase() {
  if (firebaseModules) {
    return firebaseModules;
  }

  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured.');
  }

  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js'),
  ]);

  const app = appMod.initializeApp(firebaseConfig);
  authInstance = authMod.getAuth(app);
  authInstance.useDeviceLanguage();
  authMod.onAuthStateChanged(authInstance, handleAuthStateChange);

  firebaseModules = {
    ...authMod,
    auth: authInstance,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    OAuthProvider: authMod.OAuthProvider,
    signInWithPopup: authMod.signInWithPopup,
    signOut: authMod.signOut,
  };

  return firebaseModules;
}

function handleAuthStateChange(user) {
  if (!user) {
    clearAdminDetails();
    if (unauthorizedMessage) {
      showLoginError(unauthorizedMessage);
      unauthorizedMessage = '';
      showLoginOverlay();
    }
    return;
  }

  if (!isAuthorized(user)) {
    unauthorizedMessage = 'This account is not authorized to access the coaching dashboard.';
    if (firebaseModules && authInstance) {
      firebaseModules
        .signOut(authInstance)
        .catch((error) => console.error('Failed to clear unauthorized session', error));
    }
    return;
  }

  unauthorizedMessage = '';
  showAdminApp(user);
}

function showAdminApp(user) {
  if (!adminAppSection) return;

  adminAppSection.removeAttribute('hidden');
  adminAppSection.setAttribute('aria-hidden', 'false');
  document.body.classList.add('admin-active');

  if (adminUserName) {
    const displayName = user.displayName?.trim();
    const email = user.email?.trim();
    adminUserName.textContent = displayName || email || 'Coach Admin';
  }

  hideLoginOverlay();
  clearMessages();

  if (!adminInitialized) {
    initializeLogApp();
    adminInitialized = true;
  }
}

function isAuthorized(user) {
  if (!user) return false;
  if (sanitizedAdminEmails.size === 0) return true;
  const email = user.email ? user.email.toLowerCase() : '';
  return sanitizedAdminEmails.has(email);
}

function handleSignInError(error) {
  if (!error) return;
  if (error.code === 'auth/popup-closed-by-user') {
    showLoginError('Sign-in was cancelled before completion.');
    return;
  }
  if (error.code === 'auth/cancelled-popup-request') {
    showLoginError('Another sign-in attempt was in progress. Please try again.');
    return;
  }
  if (error.code === 'auth/operation-not-supported-in-this-environment') {
    showLoginError('Sign-in is not supported in this environment. Please open the site in a secure context.');
    return;
  }
  if (error.code === 'auth/unauthorized-domain') {
    showLoginError('The current domain is not authorized for this Firebase project.');
    return;
  }
  console.error('Sign-in failed', error);
  showLoginError('Unable to sign in. Please try again.');
}

