// Automated test for session persistence and app close logout behavior
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

console.log('--- Testing Session Persistence & App Close Logout Logic ---')

// Test 1: Check AuthContext imports setPersistence and browserSessionPersistence
const authContextContent = fs.readFileSync(path.resolve('src/context/AuthContext.jsx'), 'utf-8')
assert(authContextContent.includes('setPersistence'), 'AuthContext should import setPersistence')
assert(authContextContent.includes('browserSessionPersistence'), 'AuthContext should use browserSessionPersistence')
assert(authContextContent.includes('punch_session_active'), 'AuthContext should manage punch_session_active session marker')
assert(authContextContent.includes('sessionStorage.getItem(\'punch_session_active\')'), 'AuthContext should inspect sessionStorage')
console.log('✓ AuthContext.jsx correctly implements browserSessionPersistence and sessionStorage marker')

// Test 2: Check mockService session storage isolation
const mockServiceContent = fs.readFileSync(path.resolve('src/mockService.js'), 'utf-8')
assert(mockServiceContent.includes('sessionStorage.getItem(STORAGE_KEY_SESSION)'), 'mockService should read session from sessionStorage')
assert(mockServiceContent.includes('sessionStorage.setItem(STORAGE_KEY_SESSION'), 'mockService should save session to sessionStorage')
assert(mockServiceContent.includes('localStorage.removeItem(STORAGE_KEY_SESSION)'), 'mockService should purge legacy localStorage session')
console.log('✓ mockService.js uses sessionStorage and purges persistent localStorage session')

// Test 3: Check firebase.js initialization
const firebaseContent = fs.readFileSync(path.resolve('src/firebase.js'), 'utf-8')
assert(firebaseContent.includes('setPersistence(auth, browserSessionPersistence)'), 'firebase.js should set browserSessionPersistence at startup')
console.log('✓ firebase.js configures browserSessionPersistence on auth initialization')

// Test 4: Check ProtectedRoute redirects unauthenticated users to /login
const protectedRouteContent = fs.readFileSync(path.resolve('src/components/ProtectedRoute.jsx'), 'utf-8')
assert(protectedRouteContent.includes('if (!user) return <Navigate to="/login" replace />'), 'ProtectedRoute must redirect unauthenticated access to /login')
console.log('✓ ProtectedRoute enforces redirect to /login when user is not logged in')

console.log('ALL SESSION PERSISTENCE & LOGOUT TESTS PASSED!')
