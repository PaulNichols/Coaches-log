# Mitchell Basketball Coaching

This project now ships two complementary experiences:

- **Public marketing site (`index.html`)** – A modern, mobile-friendly landing page that highlights Coach Jordan Mitchell's 1:1 basketball training, showcases achievements, and embeds a Calendly scheduler front and center so athletes can immediately book a session.
- **Coach Control Center (`admin.html`)** – The original coaching log app, now gated behind Google or Apple authentication for approved staff only.

## Public site highlights

- Hero section with bold messaging, stat highlights, and instant booking call to action.
- Inline Calendly widget plus external link for frictionless scheduling.
- Sections for bio, accolades, training blueprint, and testimonials to help parents and athletes evaluate the program quickly.
- Responsive layout with a mobile navigation drawer and accessible color contrast.

## Coach Control Center

- Protected access: requires signing in with Google or Apple. Only emails listed in `auth-config.js` are allowed.
- Session logging, reference data management, and export capabilities from the original app remain unchanged.
- Sign-in status and sign-out controls are surfaced in the header for quick context switching.

> **Security note:** Authentication is handled with Firebase Authentication on the client. Because session data still lives in the browser's `localStorage`, anyone with device access after sign-in can view entries. Use trusted devices or pair with a backend for full data security.

## Configure Firebase authentication

1. [Create a Firebase project](https://console.firebase.google.com/) and add a web app.
2. Enable the **Google** and **Apple** providers under **Authentication ▸ Sign-in method**.
   - Apple sign-in requires additional configuration in the Firebase console (service ID, key, and redirect URI). Follow Firebase's setup guide.
3. Copy your Firebase web configuration and update `auth-config.js`:

   ```js
   window.firebaseConfig = {
     apiKey: 'YOUR_FIREBASE_API_KEY',
     authDomain: 'your-project-id.firebaseapp.com',
     projectId: 'your-project-id',
     appId: 'YOUR_FIREBASE_APP_ID',
   };

   window.adminEmails = ['coach@example.com'];
   ```

4. Replace `window.adminEmails` with the list of email addresses that should be allowed to access the admin experience.
5. Upload `admin.html` and related assets (including your updated `auth-config.js`) to your hosting platform.

## Local development

- Open `index.html` in a browser to review the public marketing site.
- Open `admin.html` to test the control center. Authentication will only work after you provide a valid Firebase configuration and enable the providers above.

## Deployment

These pages are static and can be hosted on any static web platform (GitHub Pages, Netlify, Vercel, etc.). Be sure to include your customized `auth-config.js` in the deployment. For GitHub Pages, you can keep the existing Actions workflow and continue publishing the repository contents to the `gh-pages` branch.
