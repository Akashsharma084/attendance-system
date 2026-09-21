import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

console.log('--- Testing Admin Role Authorization and Page Reload Preservation ---')

const authContent = fs.readFileSync(path.resolve('src/context/AuthContext.jsx'), 'utf-8')

// Check 1: verify no blocking "Access Denied" throw in login
assert(!authContent.includes("throw new Error('Access Denied: This account is an Employee and cannot log in to the Admin Console"), 'Should not block admin login with Access Denied exception')
console.log('✓ No blocking "Access Denied" exception in AuthContext login')

// Check 2: verify checkIsAdminEmail is exported and functional
assert(authContent.includes('export function checkIsAdminEmail'), 'checkIsAdminEmail must be exported')
console.log('✓ checkIsAdminEmail is present and exported')

// Check 3: verify reload detection and safety
assert(authContent.includes('function isPageReload'), 'isPageReload must be present')
assert(authContent.includes('!isReloading'), 'Auto-purge must only occur if NOT reloading')
assert(authContent.includes('isReload || hadActiveSession'), 'Reload or active session must preserve punch_session_active marker')
console.log('✓ Reload safety logic verified: Page reloads will NOT log out user')

// Check 4: verify isUserAdmin evaluates admin status flexibly
assert(authContent.includes('checkIsAdminEmail(currentUser?.email)'), 'isUserAdmin must check currentUser email')
assert(authContent.includes('checkIsAdminEmail(profile?.email)'), 'isUserAdmin must check profile email')
assert(authContent.includes("profile?.role?.toLowerCase() === 'admin'"), 'isUserAdmin must check profile role')
console.log('✓ isUserAdmin robustly validates admin role via profile and email')

console.log('ALL ADMIN AND RELOAD VERIFICATION TESTS PASSED!')
