import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updatePassword,
  setPersistence,
  browserSessionPersistence
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

export function checkIsAdminEmail(email) {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  return (
    lower.startsWith('admin@') ||
    lower.includes('admin') ||
    lower === 'admin@company.com' ||
    lower === 'admin@softwindlabs.com'
  )
}

function isPageReload() {
  if (typeof window === 'undefined') return false
  try {
    const navEntries = window.performance?.getEntriesByType?.('navigation')
    if (navEntries && navEntries.length > 0) {
      return navEntries[0].type === 'reload'
    }
    return window.performance?.navigation?.type === 1
  } catch {
    return false
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isReload = isPageReload()
    const hadActiveSession = typeof window !== 'undefined' && sessionStorage.getItem('punch_session_active') === 'true'

    // If reloading or had active session in this tab/window, preserve session marker
    if (isReload || hadActiveSession) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('punch_session_active', 'true')
      }
    }

    if (isFirebaseConfigured && auth) {
      setPersistence(auth, browserSessionPersistence).catch(() => {})

      const unsubAuth = onAuthStateChanged(auth, async (user) => {
        const isReloading = isPageReload()
        const isSessionActive = typeof window !== 'undefined' && sessionStorage.getItem('punch_session_active') === 'true'

        // Only purge if this is a genuinely NEW window/app launch after app close
        // (i.e. NOT a page reload, and NO active session in this window)
        if (user && !isSessionActive && !isReloading) {
          try {
            await firebaseSignOut(auth)
          } catch (e) {
            console.warn('Session auto-purge note:', e)
          }
          setCurrentUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (user) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('punch_session_active', 'true')
          }
        }

        setCurrentUser(user)
        if (!user) {
          setProfile(null)
          setLoading(false)
        }
      })
      return unsubAuth
    } else {
      // Demo Mode:
      if (!hadActiveSession && !isReload) {
        mockSignOut()
        setCurrentUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      const session = getMockSession()
      if (session) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('punch_session_active', 'true')
        }
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
          let data = snap.data()
          // If this user is an admin by email, ensure role is 'admin'
          if (checkIsAdminEmail(currentUser.email) && data?.role?.toLowerCase() !== 'admin') {
            data = { ...data, role: 'admin', isAdmin: true }
            updateDoc(ref, { role: 'admin', isAdmin: true }).catch(() => {})
          }
          setProfile(data)
          setLoading(false)
        } else {
          // Document does not exist in Firestore yet: auto-provision
          const isAdminByEmail = checkIsAdminEmail(currentUser.email)
          const finalRole = isAdminByEmail ? 'admin' : 'employee'
          const initialDoc = {
            name: currentUser.displayName || currentUser.email?.split('@')[0] || (isAdminByEmail ? 'Admin' : 'Employee'),
            email: currentUser.email,
            role: finalRole,
            isAdmin: isAdminByEmail,
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
        const isAdminByEmail = checkIsAdminEmail(currentUser.email)
        setProfile((prev) => prev || {
          name: currentUser.displayName || currentUser.email?.split('@')[0] || (isAdminByEmail ? 'Admin' : 'Employee'),
          email: currentUser.email,
          role: isAdminByEmail ? 'admin' : 'employee',
          isAdmin: isAdminByEmail,
          status: 'active'
        })
        setLoading(false)
      }
    )
    return unsubProfile
  }, [currentUser])

  async function login(email, password, portalHint = 'employee') {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('punch_session_active', 'true')
    }

    if (isFirebaseConfigured && auth) {
      try {
        await setPersistence(auth, browserSessionPersistence)
      } catch (err) {
        console.warn('Set persistence in login note:', err)
      }

      const res = await signInWithEmailAndPassword(auth, email.trim(), password)
      const user = res.user

      if (db && user) {
        const userRef = doc(db, 'users', user.uid)
        let snap = null
        try {
          snap = await getDoc(userRef)
        } catch (e) {
          console.warn('Could not read user profile:', e)
        }

        const isAdminByEmail = checkIsAdminEmail(user.email)
        const isAdminByPortal = portalHint === 'admin'
        const existingRole = snap?.exists() ? snap.data()?.role?.toLowerCase() : null
        const existingIsAdmin = snap?.exists() ? snap.data()?.isAdmin : false

        // Determine if account is an admin
        const shouldBeAdmin = Boolean(
          existingRole === 'admin' ||
          existingIsAdmin === true ||
          isAdminByEmail ||
          isAdminByPortal
        )

        const finalRole = shouldBeAdmin ? 'admin' : 'employee'

        const profileData = {
          name: user.displayName || email.split('@')[0] || (shouldBeAdmin ? 'Admin' : 'Employee'),
          email: user.email,
          role: finalRole,
          isAdmin: shouldBeAdmin,
          status: 'active',
          updatedAt: serverTimestamp()
        }

        if (!snap || !snap.exists()) {
          profileData.createdAt = serverTimestamp()
        }

        try {
          await setDoc(userRef, profileData, { merge: true })
          setProfile(profileData)
        } catch (e) {
          console.warn('Profile write error:', e)
          setProfile(profileData)
        }
      }

      setCurrentUser(user)
      return user
    } else {
      // Demo Mode
      const user = await mockSignIn(email)
      const isAdminByEmail = checkIsAdminEmail(user.email)
      const shouldBeAdmin = Boolean(user.role === 'admin' || isAdminByEmail || portalHint === 'admin')
      user.role = shouldBeAdmin ? 'admin' : 'employee'
      user.isAdmin = shouldBeAdmin
      setMockSession(user)
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function loginWithGoogle(portalHint = 'employee') {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('punch_session_active', 'true')
    }

    if (isFirebaseConfigured && auth) {
      try {
        await setPersistence(auth, browserSessionPersistence)
      } catch (err) {
        console.warn('Set persistence in Google login note:', err)
      }
      const provider = new GoogleAuthProvider()
      const res = await signInWithPopup(auth, provider)
      const user = res.user

      if (db && user) {
        const userRef = doc(db, 'users', user.uid)
        let snap = null
        try {
          snap = await getDoc(userRef)
        } catch (e) {
          console.warn('Could not read user profile:', e)
        }

        const isAdminByEmail = checkIsAdminEmail(user.email)
        const isAdminByPortal = portalHint === 'admin'
        const existingRole = snap?.exists() ? snap.data()?.role?.toLowerCase() : null
        const existingIsAdmin = snap?.exists() ? snap.data()?.isAdmin : false

        const shouldBeAdmin = Boolean(
          existingRole === 'admin' ||
          existingIsAdmin === true ||
          isAdminByEmail ||
          isAdminByPortal
        )

        const finalRole = shouldBeAdmin ? 'admin' : 'employee'

        const profileData = {
          name: user.displayName || user.email.split('@')[0] || (shouldBeAdmin ? 'Admin' : 'Employee'),
          email: user.email,
          role: finalRole,
          isAdmin: shouldBeAdmin,
          status: 'active',
          updatedAt: serverTimestamp()
        }

        if (!snap || !snap.exists()) {
          profileData.createdAt = serverTimestamp()
        }

        try {
          await setDoc(userRef, profileData, { merge: true })
          setProfile(profileData)
        } catch (e) {
          console.warn('Profile write error:', e)
          setProfile(profileData)
        }
      }

      setCurrentUser(user)
      return user
    } else {
      const user = await mockGoogleSignIn()
      const isAdminByEmail = checkIsAdminEmail(user.email)
      const shouldBeAdmin = Boolean(user.role === 'admin' || isAdminByEmail || portalHint === 'admin')
      user.role = shouldBeAdmin ? 'admin' : 'employee'
      user.isAdmin = shouldBeAdmin
      setMockSession(user)
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function logout() {
    sessionStorage.removeItem('punch_session_active')
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
      if (cleanUpdates.photoURL !== undefined) {
        // Firebase Auth only accepts HTTP/HTTPS URLs (max 2048 chars)
        // If it's a data:image base64 url, store it in Firestore only
        if (cleanUpdates.photoURL && !cleanUpdates.photoURL.startsWith('data:')) {
          authUpdates.photoURL = cleanUpdates.photoURL
        } else if (!cleanUpdates.photoURL) {
          authUpdates.photoURL = ''
        }
      }
      try {
        if (Object.keys(authUpdates).length > 0) {
          await updateProfile(auth.currentUser, authUpdates)
        }
      } catch (err) {
        console.warn('Auth profile update note:', err)
      }

      // Update Firestore user document (setDoc with merge creates or updates safely)
      if (db) {
        const userRef = doc(db, 'users', auth.currentUser.uid)
        await setDoc(
          userRef,
          {
            ...cleanUpdates,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )
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

  // Admin Evaluation: checks verified Firestore profile role, isAdmin flag, or designated admin email
  const isUserAdmin = Boolean(
    profile?.role?.toLowerCase() === 'admin' ||
    profile?.isAdmin === true ||
    checkIsAdminEmail(currentUser?.email) ||
    checkIsAdminEmail(profile?.email)
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

