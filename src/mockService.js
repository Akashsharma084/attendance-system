import { todayDateKey, monthKey } from './utils/dateHelpers.js'

const STORAGE_KEY_USERS = 'punch_demo_users'
const STORAGE_KEY_ATTENDANCE = 'punch_demo_attendance'
const STORAGE_KEY_LEAVES = 'punch_demo_leaves'
const STORAGE_KEY_SESSION = 'punch_demo_session'

const SAMPLE_MEDICAL_PROOF = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="20" y="20" width="560" height="360" rx="12" fill="%23ffffff" stroke="%23cbd5e1" stroke-width="2"/><text x="50" y="65" font-family="sans-serif" font-size="20" font-weight="bold" fill="%230f172a">🏥 CITY GENERAL HOSPITAL</text><text x="50" y="90" font-family="sans-serif" font-size="12" fill="%2364748b">Medical Consultation %26 Sickness Certificate</text><line x1="50" y1="105" x2="550" y2="105" stroke="%23e2e8f0" stroke-width="1.5"/><text x="50" y="140" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23334155">Patient Name:</text><text x="160" y="140" font-family="sans-serif" font-size="14" fill="%230f172a">Maria Santos</text><text x="50" y="170" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23334155">Diagnosis:</text><text x="160" y="170" font-family="sans-serif" font-size="14" fill="%230f172a">Acute Viral Pharyngitis %26 High Grade Fever</text><text x="50" y="200" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23334155">Recommended:</text><text x="160" y="200" font-family="sans-serif" font-size="14" fill="%230f172a">Strict bed rest for 2 days (Sep 10 - Sep 11, 2026)</text><rect x="50" y="235" width="220" height="70" rx="8" fill="%23f0fdf4" stroke="%2386efac" stroke-width="1"/><text x="65" y="260" font-family="sans-serif" font-size="12" font-weight="bold" fill="%2315803d">✓ VERIFIED MEDICAL SLIP</text><text x="65" y="282" font-family="sans-serif" font-size="11" fill="%23166534">Dr. Robert Chen, MD • Reg #84920</text><circle cx="500" cy="270" r="35" fill="%23f1f5f9" stroke="%2394a3b8" stroke-dasharray="4"/><text x="500" y="275" font-family="sans-serif" font-size="11" text-anchor="middle" fill="%2364748b">OFFICIAL STAMP</text></svg>'

const DEFAULT_LEAVES = []

const DEFAULT_USERS = [
  {
    uid: 'swl-admin-jai',
    email: 'admin@softwindlabs.com',
    name: 'Jai Chaturvedi',
    role: 'admin',
    isAdmin: true,
    status: 'active',
    employeeId: 'SWL-ADM01',
    department: 'Management'
  },
  {
    uid: 'orb5VodOu8MupkouNauVtFpZI1t1',
    email: 'akash@softwindlabs.com',
    name: 'Akash',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-101',
    department: 'Engineering'
  },
  {
    uid: 'G81Oj1ojTWPD9zK0XXGOYec861g2',
    email: 'vipin@softwindlabs.com',
    name: 'Vipin',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-102',
    department: 'Operations'
  },
  {
    uid: 'J9NCovlzGRfCuM894Lrw9q2erRy1',
    email: 'abhishek@softwindlabs.com',
    name: 'Abhishek',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-103',
    department: 'Engineering'
  },
  {
    uid: '20ujjczIVJZcT0nqZlZbJWbZ83I2',
    email: 'rohit@softwindlabs.com',
    name: 'Rohit',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-104',
    department: 'Operations'
  },
  {
    uid: 'wrpVMbA4jfhYYj11h8gSybrrtTl2',
    email: 'dushyant@softwindlabs.com',
    name: 'Dushyant',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-105',
    department: 'Engineering'
  },
  {
    uid: 'nyBEzJ2tYxMvpiczsPo4EB5nRyb2',
    email: 'satrughan@softwindlabs.com',
    name: 'Satrughan',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-106',
    department: 'Operations'
  },
  {
    uid: 'MQR2SJVx0EQXwDFg0mbQc69tBdl1',
    email: 'dhananjay@softwindlabs.com',
    name: 'Dhananjay',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-107',
    department: 'Engineering'
  },
  {
    uid: 'GOlxMC8609Up8oF7TwQWyRTCSnI3',
    email: 'jai@softwindlabs.com',
    name: 'Jai',
    role: 'employee',
    status: 'active',
    employeeId: 'SWL-108',
    department: 'Operations'
  }
]

// Empty seed attendance - start fresh for real profiles
function generateSeedAttendance() {
  return []
}

export function getStoredUsers() {
  const data = localStorage.getItem(STORAGE_KEY_USERS)
  if (!data) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS))
    return DEFAULT_USERS
  }
  try {
    return JSON.parse(data)
  } catch {
    return DEFAULT_USERS
  }
}

export function getStoredAttendance() {
  const data = localStorage.getItem(STORAGE_KEY_ATTENDANCE)
  let records = []
  if (!data) {
    records = generateSeedAttendance()
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records))
    return records
  }
  try {
    records = JSON.parse(data) || []
  } catch {
    records = generateSeedAttendance()
  }

  // Ensure today's records are always populated in demo store
  const todayKey = todayDateKey()
  const hasToday = records.some((r) => r.date === todayKey)
  if (!hasToday) {
    const freshToday = generateSeedAttendance().filter((r) => r.date === todayKey)
    if (freshToday.length > 0) {
      records = [...records, ...freshToday]
      try {
        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records))
      } catch {}
    }
  }
  return records
}

// Clean up any legacy cross-session mock login stored in localStorage
try {
  localStorage.removeItem(STORAGE_KEY_SESSION)
} catch {
  // ignore
}

export function getMockSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_SESSION)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setMockSession(user) {
  try {
    if (user) {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user))
    } else {
      sessionStorage.removeItem(STORAGE_KEY_SESSION)
    }
    // Always clear legacy persistent localStorage session
    localStorage.removeItem(STORAGE_KEY_SESSION)
  } catch {
    // ignore
  }
}

export async function mockSignIn(email) {
  const users = getStoredUsers()
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim())
  if (!found) {
    // If not found in demo mode, auto-create as employee so any email can test!
    const newUser = {
      uid: `demo-user-${Date.now()}`,
      email: email.trim(),
      name: email.split('@')[0],
      role: 'employee',
      status: 'active'
    }
    const updated = [...users, newUser]
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated))
    setMockSession(newUser)
    return newUser
  }
  if (found.status === 'disabled') {
    throw new Error('Your account has been disabled.')
  }
  setMockSession(found)
  return found
}

export function mockSignOut() {
  setMockSession(null)
  try {
    sessionStorage.removeItem(STORAGE_KEY_SESSION)
    localStorage.removeItem(STORAGE_KEY_SESSION)
  } catch {
    // ignore
  }
}

export function mockGetTodayRecord(uid) {
  const all = getStoredAttendance()
  const today = todayDateKey()
  return all.find((r) => r.uid === uid && r.date === today) || null
}

export function mockSaveAttendance({ uid, name, location, selfieUrl, network, isCheckIn }) {
  const all = getStoredAttendance()
  const today = todayDateKey()
  const currentMonth = monthKey()
  const existingIndex = all.findIndex((r) => r.uid === uid && r.date === today)

  if (isCheckIn) {
    const newRecord = {
      id: `att-${Date.now()}`,
      uid,
      name,
      date: today,
      month: currentMonth,
      checkInTime: new Date().toISOString(),
      checkInLocation: location,
      checkInSelfieUrl: selfieUrl,
      checkInNetwork: network?.name || null,
      checkInNetworkType: network?.type || null,
      checkOutTime: null,
      checkOutLocation: null,
      checkOutSelfieUrl: null,
      checkOutNetwork: null,
      checkOutNetworkType: null
    }
    const updated = [newRecord, ...all]
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updated))
    return newRecord
  } else {
    if (existingIndex >= 0) {
      all[existingIndex] = {
        ...all[existingIndex],
        checkOutTime: new Date().toISOString(),
        checkOutLocation: location,
        checkOutSelfieUrl: selfieUrl,
        checkOutNetwork: network?.name || null,
        checkOutNetworkType: network?.type || null
      }
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify([...all]))
      return all[existingIndex]
    }
  }
}

export function mockGetAttendanceList({ uid, month }) {
  const all = getStoredAttendance()
  return all.filter((r) => {
    if (uid && r.uid !== uid) return false
    if (month && r.month !== month) return false
    return true
  })
}

export function mockCreateUser({ name, email, role }) {
  const users = getStoredUsers()
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())) {
    throw new Error('A user with that email already exists.')
  }
  const newUser = {
    uid: `demo-user-${Date.now()}`,
    name,
    email: email.trim(),
    role: role || 'employee',
    status: 'active'
  }
  const updated = [...users, newUser]
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated))
  return newUser
}

export function mockToggleUserStatus(uid) {
  const users = getStoredUsers()
  const updated = users.map((u) => {
    if (u.uid === uid) {
      return { ...u, status: u.status === 'disabled' ? 'active' : 'disabled' }
    }
    return u
  })
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated))
  return updated
}

export function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY_ATTENDANCE)
  localStorage.removeItem(STORAGE_KEY_USERS)
  localStorage.removeItem(STORAGE_KEY_LEAVES)
  const users = getStoredUsers()
  const attendance = getStoredAttendance()
  const leaves = getStoredLeaves()
  return { users, attendance, leaves }
}

export async function mockGoogleSignIn() {
  const googleUser = {
    uid: 'demo-google-emp',
    email: 'alex.chen@softwindlabs.com',
    name: 'Alex Chen (Google SSO)',
    role: 'employee',
    status: 'active'
  }
  const users = getStoredUsers()
  const existing = users.find((u) => u.email.toLowerCase() === googleUser.email.toLowerCase())
  if (!existing) {
    users.push(googleUser)
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users))
  }
  const activeUser = existing || googleUser
  setMockSession(activeUser)
  return activeUser
}

export function getStoredLeaves() {
  const data = localStorage.getItem(STORAGE_KEY_LEAVES)
  if (!data) {
    localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(DEFAULT_LEAVES))
    return DEFAULT_LEAVES
  }
  try {
    return JSON.parse(data)
  } catch {
    return DEFAULT_LEAVES
  }
}

export function mockGetLeavesList({ uid, status } = {}) {
  const all = getStoredLeaves()
  return all.filter((l) => {
    if (uid && l.uid !== uid) return false
    if (status && status !== 'all' && l.status !== status) return false
    return true
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export function mockCreateLeaveRequest({ uid, userName, userEmail, leaveType, startDate, endDate, daysCount, reason, proofPhotoUrl = null }) {
  const all = getStoredLeaves()
  const newLeave = {
    id: `leave-${Date.now()}`,
    uid,
    userName: userName || userEmail?.split('@')[0] || 'Employee',
    userEmail: userEmail || '',
    leaveType: leaveType || 'casual',
    startDate,
    endDate,
    daysCount: Number(daysCount) || 1,
    reason: (reason || '').trim(),
    proofPhotoUrl: proofPhotoUrl || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    adminNote: ''
  }
  const updated = [newLeave, ...all]
  localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(updated))
  return newLeave
}

export function mockUpdateLeaveStatus({ leaveId, status, reviewedBy, reviewedByName, adminNote }) {
  const all = getStoredLeaves()
  const idx = all.findIndex((l) => l.id === leaveId)
  if (idx === -1) {
    throw new Error('Leave request not found.')
  }
  all[idx] = {
    ...all[idx],
    status,
    reviewedBy: reviewedBy || 'admin',
    reviewedByName: reviewedByName || 'Administrator',
    reviewedAt: new Date().toISOString(),
    adminNote: adminNote !== undefined ? adminNote : all[idx].adminNote
  }
  localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify([...all]))
  return all[idx]
}

export function mockCancelLeaveRequest({ leaveId, uid }) {
  const all = getStoredLeaves()
  const idx = all.findIndex((l) => l.id === leaveId)
  if (idx === -1) {
    throw new Error('Leave request not found.')
  }
  if (uid && all[idx].uid !== uid) {
    throw new Error('You can only cancel your own leave requests.')
  }
  if (all[idx].status !== 'pending') {
    throw new Error('Only pending leave requests can be cancelled.')
  }
  all[idx] = {
    ...all[idx],
    status: 'cancelled',
    cancelledAt: new Date().toISOString()
  }
  localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify([...all]))
  return all[idx]
}

export function mockDeleteLeaveRequest({ leaveId, uid }) {
  const all = getStoredLeaves()
  const idx = all.findIndex((l) => l.id === leaveId)
  if (idx === -1) return true
  if (uid && all[idx].uid !== uid) {
    throw new Error('You can only delete your own leave records.')
  }
  all.splice(idx, 1)
  localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify([...all]))
  return true
}

export function mockClearLeaveRecords({ uid, status }) {
  let all = getStoredLeaves()
  if (uid && status) {
    all = all.filter((l) => !(l.uid === uid && l.status === status))
  } else if (uid) {
    all = all.filter((l) => l.uid !== uid)
  } else if (status) {
    all = all.filter((l) => l.status !== status)
  } else {
    all = []
  }
  localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify([...all]))
  return true
}

