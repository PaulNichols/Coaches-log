(function () {
  const loginView = document.getElementById('login-view');
  const adminApp = document.getElementById('admin-app');
  const messageEl = document.getElementById('auth-message');
  const googleButton = document.getElementById('google-signin');
  const appleButton = document.getElementById('apple-signin');
  const signOutButton = document.getElementById('sign-out');
  const profileContainer = document.getElementById('admin-profile');
  const profileName = document.getElementById('auth-user-name');

  const adminEmails = Array.isArray(window.adminEmails)
    ? window.adminEmails
        .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
        .filter(Boolean)
    : [];

  const setMessage = (text = '', variant = 'info') => {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.dataset.variant = variant;
    messageEl.hidden = !text;
  };

  const setButtonsDisabled = (isDisabled) => {
    [googleButton, appleButton].forEach((btn) => {
      if (btn) {
        btn.disabled = isDisabled;
        btn.classList.toggle('auth-button--loading', isDisabled);
      }
    });
  };

  const showLogin = () => {
    if (loginView) {
      loginView.classList.remove('is-hidden');
      loginView.removeAttribute('aria-hidden');
    }
    if (adminApp) {
      adminApp.classList.add('is-hidden');
      adminApp.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('admin-authenticated');
    setButtonsDisabled(false);
  };

  const initializeFirebase = () => {
    if (!window.firebaseConfig || !window.firebaseConfig.apiKey) {
      setMessage('Add your Firebase configuration to auth-config.js to enable sign in.', 'error');
      setButtonsDisabled(true);
      return null;
    }
    try {
      if (firebase.apps && firebase.apps.length === 0) {
        firebase.initializeApp(window.firebaseConfig);
      }
      return firebase.auth();
    } catch (error) {
      console.error('Failed to initialize Firebase', error);
      setMessage('Unable to start authentication. Check the console for details.', 'error');
      setButtonsDisabled(true);
      return null;
    }
  };

  const auth = initializeFirebase();
  if (!auth) {
    return;
  }

  const showAdmin = (user) => {
    if (loginView) {
      loginView.classList.add('is-hidden');
      loginView.setAttribute('aria-hidden', 'true');
    }
    if (adminApp) {
      adminApp.classList.remove('is-hidden');
      adminApp.setAttribute('aria-hidden', 'false');
    }
    if (profileContainer) {
      profileContainer.hidden = false;
    }
    if (profileName) {
      profileName.textContent = user.displayName || user.email || 'Coach';
    }
    document.body.classList.add('admin-authenticated');
    setMessage('', 'info');
    setButtonsDisabled(false);
    document.dispatchEvent(new Event('coaching-app:init'));
  };

  const handleUnauthorized = async () => {
    setMessage('This account is not authorized for admin access.', 'error');
    await auth.signOut();
  };

  const handleAuthError = (error) => {
    console.error('Authentication error', error);
    const code = error && error.code;
    let text = 'Unable to sign in right now. Please try again.';
    if (code === 'auth/popup-closed-by-user') {
      text = 'The sign-in popup was closed. Please try again.';
    } else if (code === 'auth/network-request-failed') {
      text = 'Network error. Check your connection and retry.';
    } else if (code === 'auth/account-exists-with-different-credential') {
      text = 'This email is already linked with a different provider. Use that provider to sign in.';
    }
    setMessage(text, 'error');
    setButtonsDisabled(false);
  };

  const requireAdminAccess = (user) => {
    if (!user) {
      showLogin();
      return;
    }
    const email = (user.email || '').toLowerCase();
    if (adminEmails.length && !adminEmails.includes(email)) {
      handleUnauthorized();
      return;
    }
    showAdmin(user);
  };

  auth.onAuthStateChanged((user) => {
    requireAdminAccess(user);
  });

  if (googleButton) {
    googleButton.addEventListener('click', () => {
      setMessage('', 'info');
      setButtonsDisabled(true);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      auth.signInWithPopup(provider).catch((error) => {
        handleAuthError(error);
      });
    });
  }

  if (appleButton) {
    appleButton.addEventListener('click', () => {
      setMessage('', 'info');
      setButtonsDisabled(true);
      const provider = new firebase.auth.OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      auth.signInWithPopup(provider).catch((error) => {
        handleAuthError(error);
      });
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener('click', () => {
      auth.signOut().catch((error) => {
        console.error('Sign out failed', error);
        setMessage('Unable to sign out. Please refresh and try again.', 'error');
      });
    });
  }
})();
