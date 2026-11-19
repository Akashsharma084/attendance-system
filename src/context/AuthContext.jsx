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
  browserLocalPersistence
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
import {
  validateAndBindEmployeeDevice,
  getDeviceDetails,
  clearLocalDeviceBinding
} from '../services/deviceService'

export function checkIsAdminEmail(email) {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  // Employee Jai
  if (lower === 'jai@softwindlabs.com') return false
  // Admin Jai Chaturvedi
  return (
    lower === 'admin@softwindlabs.com' ||
    lower === 'jai.chaturvedi@softwindlabs.com' ||
    lower.startsWith('admin@') ||
    lower.includes('admin') ||
    lower === 'admin@company.com'
  )
}

function isPageReload() {
  if (typeof window !== 'undefined') return false
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
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('swl_cached_user')
        if (cached) return JSON.parse(cached)
      } catch (_) {}
    }
    return null
  })
  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('swl_cached_profile')
        if (cached) return JSON.parse(cached)
      } catch (_) {}
    }
    return null
  })
  // Loading starts as true so the clean splash screen is always displayed
  // while Firebase determines authentication state, preventing any login screen flash.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      // Use permanent local persistence - user stays logged in until manual logout
      setPersistence(auth, browserLocalPersistence).catch(() => {})

      // Safety timeout: if Firebase Auth takes longer than 4.5s (e.g. offline/network delay), resolve loading
      const fallbackTimer = setTimeout(() => {
        setLoading(false)
      }, 4500)

      const unsubAuth = onAuthStateChanged(auth, (user) => {
        clearTimeout(fallbackTimer)
        setCurrentUser(user)
        if (user) {
          try {
            localStorage.setItem('swl_cached_user', JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            }))
          } catch (_) {}
          // Session confirmed by Firebase Auth: resolve loading immediately so Dashboard renders smoothly
          setLoading(false)
        } else {
          setProfile(null)
          setLoading(false)
          try {
            localStorage.removeItem('swl_cached_user')
            localStorage.removeItem('swl_cached_profile')
          } catch (_) {}
        }
      })
      return () => {
        clearTimeout(fallbackTimer)
        unsubAuth()
      }
    } else {
      // Demo Mode: persist session
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
      // Do NOT call setLoading(false) here when !currentUser.
      // Loading resolution for unauthenticated state is strictly managed by onAuthStateChanged!
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
          try {
            localStorage.setItem('swl_cached_profile', JSON.stringify(data))
          } catch (_) {}
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
            try {
              localStorage.setItem('swl_cached_profile', JSON.stringify(initialDoc))
            } catch (_) {}
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
        await setPersistence(auth, browserLocalPersistence)
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
        const existingRole = snap?.exists() ? snap.data()?.role?.toLowerCase() : null
        const existingIsAdmin = snap?.exists() ? (snap.data()?.isAdmin === true) : false

        // Determine actual account role (Strict: never modified by portalHint!)
        const isActualAdmin = Boolean(
          existingRole === 'admin' ||
          existingIsAdmin ||
          isAdminByEmail
        )

        // Strict Portal Verification:
        if (portalHint === 'admin' && !isActualAdmin) {
          // Employee account tried logging in via Admin portal -> BLOCK!
          await firebaseSignOut(auth)
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw new Error('Access Denied: Yeh Employee account hai aur Admin portal access nahi kar sakta. Kripya Employee tab select karke login karein.')
        }

        if (portalHint === 'employee' && isActualAdmin) {
          // Admin account tried logging in via Employee portal -> BLOCK!
          await firebaseSignOut(auth)
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw new Error('Access Denied: Yeh Administrator account hai aur Employee portal access nahi kar sakta. Kripya Admin tab select karke login karein.')
        }

        const finalRole = isActualAdmin ? 'admin' : 'employee'

        // --- 1 EMPLOYEE = 1 PHONE UNIQUE DEVICE BINDING ---
        let deviceResult = null
        if (!isActualAdmin) {
          try {
            deviceResult = validateAndBindEmployeeDevice(user, snap?.data(), false)
          } catch (deviceErr) {
            await firebaseSignOut(auth)
            sessionStorage.removeItem('punch_session_active')
            setCurrentUser(null)
            setProfile(null)
            throw deviceErr
          }
        }

        const profileData = {
          name: snap?.data()?.name || user.displayName || email.split('@')[0] || (isActualAdmin ? 'Admin' : 'Employee'),
          email: user.email,
          role: finalRole,
          isAdmin: isActualAdmin,
          status: 'active',
          updatedAt: serverTimestamp()
        }

        if (deviceResult?.deviceData && deviceResult?.isNewBinding) {
          profileData.boundDeviceId = deviceResult.deviceData.deviceId
          profileData.boundDeviceFingerprint = deviceResult.deviceData.deviceFingerprint
          profileData.boundHardwareModelId = deviceResult.deviceData.hardwareModelId
          profileData.boundDeviceName = deviceResult.deviceData.deviceName
          profileData.boundPhoneModel = deviceResult.deviceData.phoneModel
          profileData.boundAt = serverTimestamp()
        }

        if (!snap || !snap.exists()) {
          profileData.createdAt = serverTimestamp()
        }

        try {
          await setDoc(userRef, profileData, { merge: true })
          setProfile(profileData)
          try {
            localStorage.setItem('swl_cached_profile', JSON.stringify(profileData))
          } catch (_) {}
        } catch (e) {
          console.warn('Profile write error:', e)
          setProfile(profileData)
        }
      }

      try {
        localStorage.setItem('swl_cached_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }))
      } catch (_) {}
      setCurrentUser(user)
      setLoading(false)
      return user
    } else {
      // Demo Mode
      const user = await mockSignIn(email)
      const isAdminByEmail = checkIsAdminEmail(user.email)
      const isActualAdmin = Boolean(user.role === 'admin' || user.isAdmin === true || isAdminByEmail)

      // Strict Portal Verification in Demo Mode:
      if (portalHint === 'admin' && !isActualAdmin) {
        mockSignOut()
        sessionStorage.removeItem('punch_session_active')
        setCurrentUser(null)
        setProfile(null)
        throw new Error('Access Denied: Yeh Employee account hai aur Admin portal access nahi kar sakta. Kripya Employee tab select karke login karein.')
      }

      if (portalHint === 'employee' && isActualAdmin) {
        mockSignOut()
        sessionStorage.removeItem('punch_session_active')
        setCurrentUser(null)
        setProfile(null)
        throw new Error('Access Denied: Yeh Administrator account hai aur Employee portal access nahi kar sakta. Kripya Admin tab select karke login karein.')
      }

      // --- 1 EMPLOYEE = 1 PHONE UNIQUE DEVICE BINDING (DEMO) ---
      if (!isActualAdmin) {
        try {
          const deviceResult = validateAndBindEmployeeDevice(user, user, false)
          if (deviceResult?.deviceData && deviceResult?.isNewBinding) {
            user.boundDeviceId = deviceResult.deviceData.deviceId
            user.boundDeviceFingerprint = deviceResult.deviceData.deviceFingerprint
            user.boundHardwareModelId = deviceResult.deviceData.hardwareModelId
            user.boundDeviceName = deviceResult.deviceData.deviceName
            user.boundPhoneModel = deviceResult.deviceData.phoneModel
          }
        } catch (deviceErr) {
          mockSignOut()
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw deviceErr
        }
      }

      user.role = isActualAdmin ? 'admin' : 'employee'
      user.isAdmin = isActualAdmin
      setMockSession(user)
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function loginWithGoogle(portalHint = 'admin') {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('punch_session_active', 'true')
    }

    if (isFirebaseConfigured && auth) {
      try {
        await setPersistence(auth, browserLocalPersistence)
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
        const existingRole = snap?.exists() ? snap.data()?.role?.toLowerCase() : null
        const existingIsAdmin = snap?.exists() ? (snap.data()?.isAdmin === true) : false

        const isActualAdmin = Boolean(
          existingRole === 'admin' ||
          existingIsAdmin ||
          isAdminByEmail
        )

        // Strict Portal Verification:
        if (portalHint === 'admin' && !isActualAdmin) {
          await firebaseSignOut(auth)
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw new Error('Access Denied: Yeh Google account Employee profile hai aur Administrator portal access nahi kar sakta.')
        }

        if (portalHint === 'employee' && isActualAdmin) {
          await firebaseSignOut(auth)
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw new Error('Access Denied: Yeh Google account Administrator hai aur Employee portal access nahi kar sakta.')
        }

        const finalRole = isActualAdmin ? 'admin' : 'employee'

        // --- 1 EMPLOYEE = 1 PHONE UNIQUE DEVICE BINDING (GOOGLE LOGIN) ---
        let deviceResult = null
        if (!isActualAdmin) {
          try {
            deviceResult = validateAndBindEmployeeDevice(user, snap?.data(), false)
          } catch (deviceErr) {
            await firebaseSignOut(auth)
            sessionStorage.removeItem('punch_session_active')
            setCurrentUser(null)
            setProfile(null)
            throw deviceErr
          }
        }

        const profileData = {
          name: snap?.data()?.name || user.displayName || user.email.split('@')[0] || (isActualAdmin ? 'Admin' : 'Employee'),
          email: user.email,
          role: finalRole,
          isAdmin: isActualAdmin,
          status: 'active',
          updatedAt: serverTimestamp()
        }

        if (deviceResult?.deviceData && deviceResult?.isNewBinding) {
          profileData.boundDeviceId = deviceResult.deviceData.deviceId
          profileData.boundDeviceFingerprint = deviceResult.deviceData.deviceFingerprint
          profileData.boundHardwareModelId = deviceResult.deviceData.hardwareModelId
          profileData.boundDeviceName = deviceResult.deviceData.deviceName
          profileData.boundPhoneModel = deviceResult.deviceData.phoneModel
          profileData.boundAt = serverTimestamp()
        }

        if (!snap || !snap.exists()) {
          profileData.createdAt = serverTimestamp()
        }

        try {
          await setDoc(userRef, profileData, { merge: true })
          setProfile(profileData)
          try {
            localStorage.setItem('swl_cached_profile', JSON.stringify(profileData))
          } catch (_) {}
        } catch (e) {
          console.warn('Profile write error:', e)
          setProfile(profileData)
        }
      }

      try {
        localStorage.setItem('swl_cached_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }))
      } catch (_) {}
      setCurrentUser(user)
      setLoading(false)
      return user
    } else {
      const user = await mockGoogleSignIn()
      const isAdminByEmail = checkIsAdminEmail(user.email)
      const isActualAdmin = Boolean(user.role === 'admin' || user.isAdmin === true || isAdminByEmail)

      if (portalHint === 'admin' && !isActualAdmin) {
        mockSignOut()
        sessionStorage.removeItem('punch_session_active')
        setCurrentUser(null)
        setProfile(null)
        throw new Error('Access Denied: Yeh Google account Employee profile hai aur Administrator portal access nahi kar sakta.')
      }

      if (portalHint === 'employee' && isActualAdmin) {
        mockSignOut()
        sessionStorage.removeItem('punch_session_active')
        setCurrentUser(null)
        setProfile(null)
        throw new Error('Access Denied: Yeh Google account Administrator hai aur Employee portal access nahi kar sakta.')
      }

      // --- 1 EMPLOYEE = 1 PHONE UNIQUE DEVICE BINDING (GOOGLE DEMO) ---
      if (!isActualAdmin) {
        try {
          const deviceResult = validateAndBindEmployeeDevice(user, user, false)
          if (deviceResult?.deviceData && deviceResult?.isNewBinding) {
            user.boundDeviceId = deviceResult.deviceData.deviceId
            user.boundDeviceFingerprint = deviceResult.deviceData.deviceFingerprint
            user.boundHardwareModelId = deviceResult.deviceData.hardwareModelId
            user.boundDeviceName = deviceResult.deviceData.deviceName
            user.boundPhoneModel = deviceResult.deviceData.phoneModel
          }
        } catch (deviceErr) {
          mockSignOut()
          sessionStorage.removeItem('punch_session_active')
          setCurrentUser(null)
          setProfile(null)
          throw deviceErr
        }
      }

      user.role = isActualAdmin ? 'admin' : 'employee'
      user.isAdmin = isActualAdmin
      setMockSession(user)
      setCurrentUser({ uid: user.uid, email: user.email })
      setProfile(user)
      return user
    }
  }

  async function logout() {
    sessionStorage.removeItem('punch_session_active')
    localStorage.removeItem('punch_portal')
    try {
      localStorage.removeItem('swl_cached_user')
      localStorage.removeItem('swl_cached_profile')
    } catch (_) {}
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

  async function resetEmployeeDeviceBinding(targetUid) {
    if (!targetUid) return
    if (isFirebaseConfigured && db) {
      const targetRef = doc(db, 'users', targetUid)
      await updateDoc(targetRef, {
        boundDeviceId: null,
        boundDeviceFingerprint: null,
        boundHardwareModelId: null,
        boundDeviceName: null,
        boundPhoneModel: null,
        boundAt: null
      })
    } else {
      const users = getStoredUsers()
      const u = users.find(x => x.uid === targetUid)
      if (u) {
        u.boundDeviceId = null
        u.boundDeviceFingerprint = null
        u.boundHardwareModelId = null
        u.boundDeviceName = null
        u.boundPhoneModel = null
        u.boundAt = null
      }
    }
    clearLocalDeviceBinding()
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
    resetEmployeeDeviceBinding,
    currentDevice: getDeviceDetails(),
    isDemoMode: !isFirebaseConfigured
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

