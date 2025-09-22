# Coaches Log

A lightweight, mobile-friendly coaching session tracker that stores data locally in the browser. The main screen focuses on capturing a session quickly with pre-filled dropdowns that stay in sync with your reference data lists.

## Features

- **Session logging** – Capture the essentials (date, coach, coachee, session type, focus area, status, duration, notes) with a single tap-friendly form.
- **Reference data maintenance** – Manage coaches, coachees, session types, focus areas and statuses. Lists feed all dropdowns so the form always stays current.
- **Session history** – Filter previous sessions by coach, coachee, status, or date and export everything as JSON for external reporting.
- **Today view** – Glance at sessions scheduled or completed today without leaving the main screen.
- **Offline-first** – All information is saved in `localStorage`; no backend services required.

## Getting started

1. Open `index.html` in any modern browser (mobile Safari/Chrome supported).
2. Add or edit reference data if needed (Reference data tab).
3. Log a session from the main form – default options are pre-selected to accelerate data entry.
4. Review or export the full history from the Sessions tab.

> Tip: To start fresh, clear the browser's site data or run the app in a private/incognito window.

## Tech stack

- Vanilla HTML, CSS and JavaScript (no build step required)
- Responsive layout optimized for phones and tablets
- Local storage persistence

## Deploying to GitHub Pages

This project ships with a GitHub Actions workflow that publishes the static site straight to GitHub Pages from the `main` branch. To get it live:

1. Push the repository to GitHub if you have not already.
2. In the repository settings, open **Pages** and choose **GitHub Actions** as the source.
3. Trigger the workflow by pushing to `main` (or run it manually from the **Actions** tab). The action uploads the contents of the repository and deploys them to Pages.

Once the run finishes, the site will be available at the URL shown in the workflow summary (typically `https://<username>.github.io/<repo>`). Because all files are referenced with relative paths, no additional configuration is required for the hosted version.
