import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

export const isFirebaseConfigured = Boolean(
  rawApiKey &&
  rawApiKey.trim() !== '' &&
  rawApiKey !== 'your_api_key' &&
  rawProjectId &&
  rawProjectId.trim() !== ''
)

let app = null
let auth = null
let db = null
let storage = null

export const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: rawProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    try {
      if (firebaseConfig.storageBucket) {
        storage = getStorage(app)
      }
    } catch {
      // Cloud Storage is optional; photos are stored directly in Firestore
    }
  } catch (err) {
    console.warn('Firebase failed to initialize:', err)
  }
}

export { app, auth, db, storage }
export default app
