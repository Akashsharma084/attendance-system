import fs from 'fs'
import path from 'path'

console.log('--- Verifying Notification-Style Permission Prompt and Card View Joining Date ---')

const checkInPath = path.resolve('src/pages/CheckIn.jsx')
const checkInCode = fs.readFileSync(checkInPath, 'utf8')

const empDashPath = path.resolve('src/pages/EmployeeDashboard.jsx')
const empDashCode = fs.readFileSync(empDashPath, 'utf8')

const adminDashPath = path.resolve('src/pages/AdminDashboard.jsx')
const adminDashCode = fs.readFileSync(adminDashPath, 'utf8')

const cssPath = path.resolve('src/index.css')
const cssCode = fs.readFileSync(cssPath, 'utf8')

// 1. Compact Notification Toast in CheckIn.jsx
const hasNotifToast = checkInCode.includes('sw-perm-notif-toast')
console.log(`1. CheckIn.jsx has compact notification toast (.sw-perm-notif-toast): ${hasNotifToast ? 'PASS ✓' : 'FAIL ✗'}`)

const hasAlwaysAllowBtn = checkInCode.includes('Always Allow')
console.log(`2. CheckIn.jsx asks "Always Allow": ${hasAlwaysAllowBtn ? 'PASS ✓' : 'FAIL ✗'}`)

const hasAllowOnceBtn = checkInCode.includes('Allow Once')
console.log(`3. CheckIn.jsx asks "Allow Once": ${hasAllowOnceBtn ? 'PASS ✓' : 'FAIL ✗'}`)

const hasNeverAllow = checkInCode.toLowerCase().includes('never allow')
console.log(`4. CheckIn.jsx does NOT contain "Never Allow": ${!hasNeverAllow ? 'PASS ✓' : 'FAIL ✗'}`)

// 2. Card View in EmployeeDashboard.jsx
const cardHasNotJoined = empDashCode.includes("r.status === 'NOT_JOINED'")
console.log(`5. Card View handles r.status === 'NOT_JOINED': ${cardHasNotJoined ? 'PASS ✓' : 'FAIL ✗'}`)

const cardHasPreCompany = empDashCode.includes("r.status === 'PRE_COMPANY'")
console.log(`6. Card View handles r.status === 'PRE_COMPANY': ${cardHasPreCompany ? 'PASS ✓' : 'FAIL ✗'}`)

const cardHasNotJoinedPill = empDashCode.includes('status-pill-not-joined')
console.log(`7. Card View renders status-pill-not-joined: ${cardHasNotJoinedPill ? 'PASS ✓' : 'FAIL ✗'}`)

const cardClassHandlesNotJoined = empDashCode.includes('not-joined')
console.log(`8. Card View applies not-joined class to sw-day-card: ${cardClassHandlesNotJoined ? 'PASS ✓' : 'FAIL ✗'}`)

// 3. Calendar View in EmployeeDashboard.jsx
const calHasCellNotJoined = empDashCode.includes('cell-notjoined')
console.log(`9. Calendar View applies cell-notjoined class: ${calHasCellNotJoined ? 'PASS ✓' : 'FAIL ✗'}`)

// 4. Admin Dashboard handling
const adminRosterNotJoined = adminDashCode.includes("status === 'NOT_JOINED'") || adminDashCode.includes("item.status === 'NOT_JOINED'")
console.log(`10. Admin Dashboard handles NOT_JOINED in roster & calendar: ${adminRosterNotJoined ? 'PASS ✓' : 'FAIL ✗'}`)

// 5. CSS styles
const cssHasNotifToast = cssCode.includes('.sw-perm-notif-toast')
console.log(`11. CSS has styles for .sw-perm-notif-toast: ${cssHasNotifToast ? 'PASS ✓' : 'FAIL ✗'}`)

const cssHasDayCardNotJoined = cssCode.includes('.sw-day-card.not-joined')
console.log(`12. CSS has styles for .sw-day-card.not-joined: ${cssHasDayCardNotJoined ? 'PASS ✓' : 'FAIL ✗'}`)

if (
  hasNotifToast &&
  hasAlwaysAllowBtn &&
  hasAllowOnceBtn &&
  !hasNeverAllow &&
  cardHasNotJoined &&
  cardHasPreCompany &&
  cardHasNotJoinedPill &&
  cardClassHandlesNotJoined &&
  calHasCellNotJoined &&
  adminRosterNotJoined &&
  cssHasNotifToast &&
  cssHasDayCardNotJoined
) {
  console.log('\n>>> ALL 12 VERIFICATION CHECKS PASSED! <<<')
  process.exit(0)
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<')
  process.exit(1)
}
