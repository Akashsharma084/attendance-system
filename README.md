# Punch — Employee Attendance System

React (Vite) + Firebase. Employees check in/out with a selfie + live GPS location;
admins manage users and see everyone's attendance.

## What's included

- Email/password login (Firebase Auth)
- Check-in / check-out with camera selfie + geolocation + server timestamp
- Employee dashboard: own attendance, filterable by month
- Admin dashboard: everyone's attendance, filterable by month + employee
- Admin user management: create employee/admin logins, enable/disable accounts
  (via Cloud Functions, using the Admin SDK)
- Firestore + Storage security rules enforcing "employees only see their own data"

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. In the project, add a **Web app** (</> icon) — copy the config values shown.
3. Enable these products from the left sidebar:
   - **Authentication** → Sign-in method → enable **Email/Password**
   - **Firestore Database** → Create database (start in production mode)
   - **Storage** → Get started
   - **Functions** → requires the project to be on the **Blaze** (pay-as-you-go) plan.
     Attendance apps stay well within the free tier for normal use; Blaze is
     only required because Functions needs it enabled, not because you'll be billed much.

## 2. Configure the app

```bash
cp .env.example .env
```

Paste the values from step 1 into `.env`.

## 3. Install & run locally

```bash
npm install
npm run dev
```

Open the printed URL. Camera + geolocation require **HTTPS or localhost** — plain
`http://<lan-ip>` won't work if you open it from another device. Use
`npm run dev -- --host` and Vite's HTTPS options, or just test on the same machine
during development.

## 4. Create your first admin user

Cloud Functions' `createUser` requires you to already be an admin — so the very
first user has to be created by hand:

1. Firebase Console → Authentication → Add user (email + password).
2. Firestore → create collection `users` → document ID = that user's **UID**
   (copy it from the Authentication tab) → fields:
   ```
   name: "Your Name"        (string)
   email: "you@company.com" (string)
   role: "admin"             (string)
   status: "active"          (string)
   ```
3. Log in with that account — you'll land on the admin dashboard, and from
   there "Manage users" can create everyone else properly.

## 5. Deploy

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase init                   # select your existing project, keep existing files
npm run build
firebase deploy
```

This deploys Hosting, Firestore rules/indexes, Storage rules, and Functions together.
On first deploy, Firestore may ask you to create the composite indexes listed in
`firestore.indexes.json` — `firebase deploy` creates them automatically.

## Project structure

```
src/
  firebase.js           Firebase SDK init (reads .env)
  context/AuthContext.jsx   current user + their Firestore role
  components/
    NavBar.jsx
    ProtectedRoute.jsx   route guard (auth + admin-only routes)
  pages/
    Login.jsx
    CheckIn.jsx          selfie + geolocation + check-in/out
    EmployeeDashboard.jsx
    AdminDashboard.jsx
    AdminUsers.jsx
  utils/dateHelpers.js
functions/
  index.js               createUser, setUserStatus (admin-only, Admin SDK)
firestore.rules
storage.rules
firestore.indexes.json
```

## Notes & things to decide before going to production

- **Selfie storage cost/privacy**: selfies are stored indefinitely in Firebase
  Storage. Consider a retention policy (e.g. a scheduled Cloud Function that
  deletes selfies older than N months) if that matters for your org.
- **Location accuracy**: browsers report GPS accuracy in meters
  (`checkInLocation.accuracy`) — worth surfacing in the admin view if you want
  to catch spoofed/low-accuracy check-ins.
- **Offline / spotty network**: the current check-in flow assumes a live
  connection. If employees check in from areas with poor signal, consider
  Firestore's offline persistence + retry queue.
- **Password resets**: not wired up yet — add Firebase Auth's
  `sendPasswordResetEmail` to the login screen if employees need self-serve resets.
