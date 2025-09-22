# Coaches Log

A modern landing page and private admin workspace for managing basketball coaching sessions. Players see a sleek marketing site
with a Calendly-powered booking widget while coaches unlock the original session tracker after signing in with Google or Apple.

## What's included

- **Marketing homepage** – Hero storytelling, achievements, training approach, testimonials, and contact details styled for a
  basketball skills coach.
- **Calendly booking widget** – An embedded scheduler (front and center on the hero) so athletes can immediately reserve a
  1:1 training slot.
- **Secure admin dashboard** – The previous local-first coaching log gated behind Firebase Authentication with Google and Apple
  providers.
- **Local persistence** – Session data, reference lists, and filters continue to live in `localStorage` in the admin view.

## Updating the Calendly link

Replace `YOUR-CALENDLY-USERNAME/60min` in `index.html` with the scheduling URL for your account:

```html
<div
  class="calendly-inline-widget"
  data-url="https://calendly.com/YOUR-CALENDLY-USERNAME/60min"
  style="min-width: 320px; height: 660px"
></div>
```

Calendly automatically resizes inside the styled container. Adjust the height if your appointment type needs more space.

## Admin authentication setup

Admin access relies on [Firebase Authentication](https://firebase.google.com/docs/auth) using Google and Apple providers. Until
Firebase is configured, the login buttons are disabled and a reminder message appears on the modal.

1. Create a Firebase project (or reuse an existing one) and enable Google and Apple sign-in under **Authentication → Sign-in
   method**.
2. Add the domain where the site is hosted (and `localhost` if testing locally) to **Authentication → Settings → Authorized
domains**.
3. If you plan to use Sign in with Apple, complete the Apple developer setup in Firebase and add the generated services ID.
4. Copy your Firebase configuration snippet (found in **Project settings → General → Your apps**).
5. Before the closing `</body>` in `index.html`, add a small script defining `window.COACHES_LOG_CONFIG` and update the allowed
   admin emails:

```html
<script>
  window.COACHES_LOG_CONFIG = {
    firebase: {
      apiKey: 'YOUR_FIREBASE_API_KEY',
      authDomain: 'your-app.firebaseapp.com',
      projectId: 'your-app',
      appId: 'YOUR_FIREBASE_APP_ID'
      // Optional: measurementId, storageBucket, etc.
    },
    adminEmails: ['you@example.com']
  };
</script>
```

Place this snippet **before** the existing `<script type="module" src="main.js"></script>` line so the configuration is available
when the app initializes. Only signed-in users whose email matches `adminEmails` will see the dashboard. If you pass an empty
array, any authenticated account is allowed.

> Tip: Firebase popups require serving the site over `http://` or `https://`. Opening `index.html` directly from the file
> system may block authentication. For local development, run a lightweight server (e.g. `npx serve` or `python -m http.server`).

## Admin dashboard quick start

After Firebase is configured and a coach signs in:

1. Navigate to the **Log session** tab to capture new training notes.
2. Update coaches, coachees, session types, focus areas, or statuses from the **Reference data** tab.
3. Filter and export historical sessions from the **Sessions** tab.
4. Data persists in the browser. Clear site data or open a private window to reset.

## Tech stack

- Vanilla HTML, CSS, and JavaScript (no build tools required)
- Google Fonts for typography and Calendly's inline widget
- Firebase Authentication for Google and Apple sign-in

## Deploying to GitHub Pages

This project ships with a GitHub Actions workflow that publishes the static site straight to GitHub Pages from the `main`
branch:

1. Push the repository to GitHub if you have not already.
2. In the repository settings, open **Pages** and choose **GitHub Actions** as the source.
3. Trigger the workflow by pushing to `main` (or run it manually from the **Actions** tab). The action uploads the contents of the
   repository and deploys them to Pages.

After the workflow succeeds, update `window.COACHES_LOG_CONFIG` with your production Firebase credentials (and confirm the domain
is authorized) so admin sign-in works on the hosted URL.
