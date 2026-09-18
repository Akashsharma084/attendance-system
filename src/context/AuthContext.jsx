import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updatePassword
} from 'firebase/auth'
import { doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../firebase'
import {
  getMockSession,
  setMockSession,
  mockSignIn,
  mockSignOut,
  getStoredUsers,
  mockGoogleSignIn,
  resetDemoData
} from '../mockService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubAuth = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user)
        if (!user) {
          setProfile(null)
          setLoading(false)
        }
      })
      return unsubAuth
    } else {
      // Demo Mode: read session from localStorage
      const session = getMockSession()
      if (session) {
        const users = getStoredUsers()
        const refreshed = users.find((u) => u.uid === session.uid) || session
        setCurrentUser({ uid: refreshed.uid, email: refreshed.email })
        setProfile(refreshed)
      } else {
        setCurrentUser(null)
        setProfile(null)
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) {
      if (!currentUser) setLoading(false)
      return
    }

    if (!db) {
      setLoading(false)
      return
    }

    const ref = doc(db, 'users', currentUser.uid)
    const unsubProfile = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          setProfile(snap.data())
          setLoading(false)
        } else {
          // Document does not exist in Firestore yet: auto-provision
          // Strict security: all new auto-provisioned accounts default to employee
          const initialDoc = {
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Employee',
            email: currentUser.email,
            role: 'employee',
            status: 'active',
            createdAt: serverTimestamp()
          }

          try {
            await setDoc(ref, initialDoc, { merge: true })
            setProfile(initialDoc)
          } catch (e) {
            console.warn('Auto profile doc write note:', e)
            setProfile(initialDoc)
          }
          setLoading(false)
        }
      },
      (err) => {
        console.warn('Profile sync fallback:', err)
        setProfile((prev) => prev || {
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Employee',
          email: currentUser.email,
          role: 'employee',
          status: 'active'
        })
        setLoading(false)
      }
    )
    return unsubProfile
  }, [currentUser])

  async function login(email, password, portalHint = 'employee') {
    if (isFirebaseConfigured && auth) {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password)
      if (db && res.user) {
        const userRef = doc(db, 'users', res.user.uid)
        const snap = await getDoc(userRef)
        let userRole = 'employee'

        if (!snap.exists()) {
          await setDoc(userRef, {
            name: res.user.displayName || email.split('@')[0],
            email: res.user.email,
            role: 'employee',
            status: 'active',
            createdAt: serverTimestamp()
          }, { merge: true })
          userRole = 'employee'
        } else {
          userRole = (snap.data()?.role || 'employee').toLowerCase()
        }

        // CRITICAL SECURITY ENFORCEMENT:
        // If user attempts to log into the Admin portal, verify that their Firestore account has role === 'admin'
        if (portalHint === 'admin' && userRole !== 'admin') {
          await firebaseSignOut(auth)
          localStorage.removeItem('punch_portal')
          throw new Error('Access Denied: This account is an Employee and cannot log in to the Admin Console. Please use the Employee Portal.')
        }
      }
      return res.user
    } else {
      const user = await mockSignIn(email)
      if (portalHint === 'admin' && user.role !== 'admin') {
        mockSignOut()
        throw new Error('Access Denied: This account is an Employee and cannot log in to the Admin Console. Please use the Employee Portal.')
      }
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function loginWithGoogle(portalHint = 'employee') {
    if (isFirebaseConfigured && auth) {
      const provider = new GoogleAuthProvider()
      const res = await signInWithPopup(auth, provider)
      if (db && res.user) {
        const userRef = doc(db, 'users', res.user.uid)
        const snap = await getDoc(userRef)
        let userRole = 'employee'
        if (!snap.exists()) {
          await setDoc(userRef, {
            name: res.user.displayName || res.user.email.split('@')[0],
            email: res.user.email,
            role: 'employee',
            status: 'active',
            createdAt: serverTimestamp()
          }, { merge: true })
          userRole = 'employee'
        } else {
          userRole = (snap.data()?.role || 'employee').toLowerCase()
        }

        if (portalHint === 'admin' && userRole !== 'admin') {
          await firebaseSignOut(auth)
          localStorage.removeItem('punch_portal')
          throw new Error('Access Denied: This Google account does not have Admin privileges. Please use the Employee Portal.')
        }
      }
      return res.user
    } else {
      const user = await mockGoogleSignIn()
      if (portalHint === 'admin' && user.role !== 'admin') {
        mockSignOut()
        throw new Error('Access Denied: This account does not have Admin privileges. Please use the Employee Portal.')
      }
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function logout() {
    localStorage.removeItem('punch_portal')
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth)
    } else {
      mockSignOut()
      setCurrentUser(null)
      setProfile(null)
    }
  }

  async function updateUserProfile({ name, photoURL, phone }) {
    const cleanUpdates = {}
    if (name !== undefined) cleanUpdates.name = name.trim()
    if (photoURL !== undefined) cleanUpdates.photoURL = photoURL
    if (phone !== undefined) cleanUpdates.phone = phone.trim()

    if (isFirebaseConfigured && auth?.currentUser) {
      // Update Firebase Auth profile
      const authUpdates = {}
      if (cleanUpdates.name) authUpdates.displayName = cleanUpdates.name
      if (cleanUpdates.photoURL !== undefined) authUpdates.photoURL = cleanUpdates.photoURL
      try {
        await updateProfile(auth.currentUser, authUpdates)
      } catch (err) {
        console.warn('Auth profile update note:', err)
      }

      // Update Firestore user document
      if (db) {
        const userRef = doc(db, 'users', auth.currentUser.uid)
        await updateDoc(userRef, {
          ...cleanUpdates,
          updatedAt: serverTimestamp()
        })
      }

      // Update local profile state immediately
      setProfile((prev) => ({
        ...prev,
        ...cleanUpdates
      }))
      return true
    } else {
      // Demo Mode
      const users = getStoredUsers()
      const currentUid = currentUser?.uid || 'demo-admin-uid'
      const idx = users.findIndex((u) => u.uid === currentUid)
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...cleanUpdates }
        localStorage.setItem('punch_demo_users', JSON.stringify(users))
        setMockSession(users[idx])
        setProfile(users[idx])
      }
      return true
    }
  }

  async function resetPassword(email) {
    if (isFirebaseConfigured && auth) {
      await sendPasswordResetEmail(auth, email.trim())
    } else {
      const users = getStoredUsers()
      const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())
      if (!exists) {
        throw new Error('No user account found with that email address.')
      }
      return true
    }
  }

  async function changePassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.')
    }
    if (isFirebaseConfigured && auth?.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword)
        return { success: true }
      } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
          await sendPasswordResetEmail(auth, auth.currentUser.email)
          return {
            success: false,
            requiresReauth: true,
            message: 'For security, changing password requires a recent login. A secure password reset link has been dispatched to your email.'
          }
        }
        throw err
      }
    } else {
      // Demo Mode
      const users = getStoredUsers()
      const currentUid = currentUser?.uid || 'demo-admin-uid'
      const idx = users.findIndex((u) => u.uid === currentUid)
      if (idx !== -1) {
        users[idx].password = newPassword
        localStorage.setItem('punch_demo_users', JSON.stringify(users))
        setMockSession(users[idx])
      }
      return { success: true }
    }
  }

  function resetData() {
    if (!isFirebaseConfigured) {
      resetDemoData()
      return true
    }
    return false
  }

  // Strict Admin Evaluation: purely based on verified Firestore profile role
  const isUserAdmin = Boolean(
    profile?.role?.toLowerCase() === 'admin' ||
    profile?.isAdmin === true
  )

  const value = {
    user: currentUser,
    profile,
    role: isUserAdmin ? 'admin' : (profile?.role ?? 'employee'),
    isAdmin: isUserAdmin,
    isDisabled: profile?.status === 'disabled',
    loading,
    login,
    loginWithGoogle,
    logout,
    updateUserProfile,
    resetPassword,
    changePassword,
    resetData,
    isDemoMode: !isFirebaseConfigured
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

