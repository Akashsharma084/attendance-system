import { useEffect, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, app, auth, firebaseConfig, isFirebaseConfigured } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getStoredUsers, mockCreateUser, mockToggleUserStatus, mockGetAttendanceList } from '../mockService'
import { monthKey, buildEmployeeSchedule } from '../utils/dateHelpers'
import NavBar from '../components/NavBar'

let createUserFn = null
let setUserStatusFn = null

if (isFirebaseConfigured && app) {
  try {
    const functions = getFunctions(app)
    createUserFn = httpsCallable(functions, 'createUser')
    setUserStatusFn = httpsCallable(functions, 'setUserStatus')
  } catch (err) {
    console.warn('Functions initialization skipped:', err)
  }
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' })
  const [autoSendEmail, setAutoSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(null)
  const [createdModal, setCreatedModal] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setUsers(getStoredUsers())
      setAttendanceRecords(mockGetAttendanceList({ month: monthKey() }))
      return
    }

    const curMonth = monthKey()
    const qUsers = query(collection(db, 'users'))
    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
        list.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
        setUsers(list)
      },
      (err) => {
        console.error('Error loading users:', err)
        setError('Notice: ' + (err.message || 'Failed to sync users'))
      }
    )

    const qAtt = query(collection(db, 'attendance'), where('month', '==', curMonth))
    const unsubAtt = onSnapshot(
      qAtt,
      (snap) => {
        setAttendanceRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (err) => {
        console.error('Error loading attendance for users:', err)
      }
    )

    return () => {
      unsubUsers()
      unsubAtt()
    }
  }, [])

  function getUserMonthlyStats(uid) {
    const userRecords = attendanceRecords.filter((r) => r.uid === uid)
    const curMonth = monthKey()
    const { presentCount, absentCount, totalWorkingDays } = buildEmployeeSchedule(userRecords, curMonth, { uid })
    const rate = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 0
    return { presentCount, absentCount, rate }
  }

  // Auto-generate a secure random temporary password
  function handleGeneratePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
    let pwd = ''
    for (let i = 0; i < 9; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm((prev) => ({ ...prev, password: pwd }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    const targetName = form.name.trim()
    const targetEmail = form.email.trim()
    const targetPassword = form.password
    const targetRole = form.role === 'admin' ? 'admin' : 'employee'

    try {
      let emailDispatched = false

      if (!isFirebaseConfigured || !db) {
        // Demo Mode
        mockCreateUser({ name: targetName, email: targetEmail, role: targetRole })
        setUsers(getStoredUsers())
        if (autoSendEmail) {
          emailDispatched = true
        }
        setCreatedModal({
          name: targetName,
          email: targetEmail,
          password: targetPassword,
          role: targetRole,
          emailSent: emailDispatched
        })
        setNotice(`✅ Created user ${targetName}.`)
        setForm({ name: '', email: '', password: '', role: 'employee' })
        return
      }

      // Direct Firebase Creation:
      const secondaryName = 'SecondaryAdminCreator'
      const secondaryApp =
        getApps().find((a) => a.name === secondaryName) ||
        initializeApp(firebaseConfig, secondaryName)
      const secondaryAuth = getAuth(secondaryApp)

      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        targetEmail,
        targetPassword
      )

      await setDoc(doc(db, 'users', cred.user.uid), {
        name: targetName,
        email: targetEmail,
        role: targetRole,
        status: 'active',
        createdAt: serverTimestamp()
      })

      await signOut(secondaryAuth)

      // Send Firebase password reset link if enabled
      if (autoSendEmail && auth) {
        try {
          await sendPasswordResetEmail(auth, targetEmail)
          emailDispatched = true
        } catch (emailErr) {
          console.warn('Password reset email note:', emailErr)
        }
      }

      setCreatedModal({
        name: targetName,
        email: targetEmail,
        password: targetPassword,
        role: targetRole,
        emailSent: emailDispatched
      })

      setNotice(`✅ Created user ${targetName} (${targetEmail})!`)
      setForm({ name: '', email: '', password: '', role: 'employee' })
    } catch (err) {
      console.error('Error creating user:', err)
      let msg = err.message || 'Could not create user.'
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email address is already registered in Firebase.'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password must be at least 6 characters.'
      } else if (err.code === 'permission-denied') {
        msg = 'Database permission denied. Please verify your Firestore security rules.'
      }
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Launch admin's default email client with pre-filled credentials
  function openMailClient(email, name, password) {
    const portalUrl = `${window.location.origin}/login`
    const subject = encodeURIComponent(`Your Login Credentials - Softwind Attendance Portal`)
    const body = encodeURIComponent(
      `Hello ${name || 'Team Member'},\n\n` +
      `Your account for the Softwind Attendance Portal has been created.\n\n` +
      `Attendance Portal: ${portalUrl}\n` +
      `Work Email: ${email}\n` +
      (password ? `Temporary Password: ${password}\n\n` : '\n') +
      `Please log in to record your attendance punches.\n\n` +
      `Best regards,\n` +
      `Management Team`
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
  }

  // Quick copy credentials for Slack / WhatsApp
  function copyCredentials(email, password, name) {
    const portalUrl = `${window.location.origin}/login`
    const text =
      `Softwind Attendance Portal: ${portalUrl}\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      (password ? `Temporary Password: ${password}\n` : '') +
      `Portal: Employee Attendance Login`
    navigator.clipboard.writeText(text)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2500)
  }

  async function toggleStatus(u) {
    setError('')
    try {
      if (!isFirebaseConfigured || !db) {
        // Demo Mode
        const updated = mockToggleUserStatus(u.uid)
        setUsers(updated)
        return
      }

      if (setUserStatusFn) {
        try {
          await setUserStatusFn({ uid: u.uid, disabled: u.status !== 'disabled' })
          return
        } catch {
          // fallback to direct Firestore update
        }
      }

      await updateDoc(doc(db, 'users', u.uid), {
        status: u.status === 'disabled' ? 'active' : 'disabled'
      })
    } catch (err) {
      setError(err.message || 'Could not update user.')
    }
  }

  async function handleDeleteUser(u) {
    const confirmMsg = `Are you sure you want to permanently delete profile for "${u.name || u.email}"? This will completely remove this employee.`
    if (!window.confirm(confirmMsg)) return

    setError('')
    setNotice('')
    try {
      if (!isFirebaseConfigured || !db) {
        const updated = users.filter((x) => x.uid !== u.uid)
        setUsers(updated)
        localStorage.setItem('punch_demo_users', JSON.stringify(updated))
        setNotice(`🗑️ Deleted profile for ${u.name || u.email}.`)
        return
      }

      await deleteDoc(doc(db, 'users', u.uid))
      setNotice(`🗑️ Deleted profile for ${u.name || u.email}.`)
    } catch (err) {
      console.error('Error deleting user:', err)
      setError('Could not delete user: ' + (err.message || 'Permission denied'))
    }
  }

  return (
    <div className="page">
      <NavBar />
      <div className="page-body">
        <div className="row-between">
          <div>
            <h1>Manage Users &amp; Employee Access</h1>
            <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>
              Create verified employee accounts, manage portal roles, and control active status.
            </p>
          </div>
        </div>

        {/* User Creation Card */}
        <div className="sw-user-create-card">
          <div className="sw-card-section-title">
            <span className="sw-section-icon">➕</span>
            <div>
              <h3>Add New Team Member</h3>
              <p>Create employee credentials and provide login access.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="sw-create-user-form">
            <div className="sw-form-grid">
              <div className="sw-input-group">
                <label>Full Name</label>
                <input
                  placeholder="e.g. Alex Chen"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="sw-input-group">
                <label>Work Email</label>
                <input
                  type="email"
                  placeholder="e.g. alex@company.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="sw-input-group">
                <div className="sw-label-with-action">
                  <label>Temporary Password</label>
                  <button
                    type="button"
                    className="sw-generate-pwd-btn"
                    onClick={handleGeneratePassword}
                    title="Generate secure random password"
                  >
                    🎲 Generate
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="sw-input-group">
                <label>System Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Employee (Punch &amp; Attendance only)</option>
                  <option value="admin">Administrator (Full workforce &amp; reports)</option>
                </select>
              </div>
            </div>

            <div className="sw-create-footer-row">
              <label className="sw-checkbox-option">
                <input
                  type="checkbox"
                  checked={autoSendEmail}
                  onChange={(e) => setAutoSendEmail(e.target.checked)}
                />
                <span className="sw-checkbox-text">
                  <strong>Send reset password link</strong>
                </span>
              </label>

              <button className="sw-btn-creative-primary" type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="sw-btn-spinner-wrap">
                    <span className="sw-spinner-creative" />
                    <span>Creating User…</span>
                  </span>
                ) : (
                  <span className="sw-btn-content">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" x2="19" y1="8" y2="14" />
                      <line x1="22" x2="16" y1="11" y2="11" />
                    </svg>
                    <span>Create User</span>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {notice && (
          <div className="form-notice" style={{ marginTop: '1.25rem' }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="form-error" style={{ marginTop: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* User Roster Table with Centered Monthly Attendance Records */}
        <div className="table-wrap" style={{ marginTop: '1.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Work Email</th>
                <th>Role</th>
                <th style={{ textAlign: 'center' }}>Present (Days)</th>
                <th style={{ textAlign: 'center' }}>Absent (Days)</th>
                <th style={{ textAlign: 'center' }}>Monthly Rate</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const stats = getUserMonthlyStats(u.uid)
                return (
                  <tr key={u.uid}>
                    <td data-label="Team Member">
                      <strong>{u.name || 'Unnamed'}</strong>
                      {u.uid === currentUser?.uid && (
                        <span style={{ fontSize: '0.75rem', marginLeft: '0.4rem', color: '#6366f1' }}>(You)</span>
                      )}
                    </td>
                    <td data-label="Work Email">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', wordBreak: 'break-all' }}>{u.email}</span>
                    </td>
                    <td data-label="Role">
                      <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-employee'}`}>
                        {u.role === 'admin' ? '🛡️ Admin' : '👤 Employee'}
                      </span>
                    </td>
                    <td data-label="Present Days" style={{ textAlign: 'center' }}>
                      <span className="status-pill-p-count">{stats.presentCount} P</span>
                    </td>
                    <td data-label="Absent Days" style={{ textAlign: 'center' }}>
                      <span className="status-pill-a-count">{stats.absentCount} A</span>
                    </td>
                    <td data-label="Monthly Rate" style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: stats.rate >= 80 ? '#10b981' : stats.rate >= 60 ? '#f59e0b' : '#ef4444' }}>
                        {stats.rate}%
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${u.status === 'disabled' ? 'badge-disabled' : 'badge-active'}`}>
                        {u.status === 'disabled' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td data-label="Action" style={{ textAlign: 'right' }}>
                      {u.uid !== currentUser?.uid ? (
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={u.status === 'disabled' ? 'sw-btn-action-enable' : 'sw-btn-action-disable'}
                            onClick={() => toggleStatus(u)}
                            title={u.status === 'disabled' ? 'Re-enable portal access' : 'Disable portal access'}
                          >
                            {u.status === 'disabled' ? (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                                <span>Enable</span>
                              </>
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                <span>Disable</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="sw-btn-action-delete"
                            onClick={() => handleDeleteUser(u)}
                            title={`Permanently delete profile for ${u.name || u.email}`}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Current Session</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No users found. Create the first team member above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Modal Showing Freshly Created Credentials */}
      {createdModal && (
        <div className="modal-overlay" onClick={() => setCreatedModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '92vw', boxSizing: 'border-box' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎉</span> Employee Login Created
              </h2>
              <button className="btn-close" onClick={() => setCreatedModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0, color: '#475569' }}>
                The account has been created in the attendance system. You can send or share these credentials directly:
              </p>

              <div className="sw-cred-box">
                <div className="sw-cred-row">
                  <span className="sw-cred-label">Full Name:</span>
                  <strong className="sw-cred-val">{createdModal.name}</strong>
                </div>
                <div className="sw-cred-row">
                  <span className="sw-cred-label">Work Email:</span>
                  <strong className="sw-cred-val" style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{createdModal.email}</strong>
                </div>
                <div className="sw-cred-row">
                  <span className="sw-cred-label">Temp Password:</span>
                  <strong className="sw-cred-val" style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                    {createdModal.password}
                  </strong>
                </div>
                <div className="sw-cred-row">
                  <span className="sw-cred-label">Role:</span>
                  <span className="badge badge-employee">{createdModal.role}</span>
                </div>
                <div className="sw-cred-row">
                  <span className="sw-cred-label">Reset Link:</span>
                  <span style={{ color: createdModal.emailSent ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {createdModal.emailSent ? '✅ Link sent to user inbox' : '⚠️ Not sent automatically'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                {/* Creative Primary Button to open mail client */}
                <button
                  type="button"
                  className="sw-btn-send-credentials"
                  onClick={() => openMailClient(createdModal.email, createdModal.name, createdModal.password)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>Send Login Credentials</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="sw-btn-creative-secondary"
                    onClick={() => copyCredentials(createdModal.email, createdModal.password, createdModal.name)}
                  >
                    {copiedEmail === createdModal.email ? '✓ Copied Details' : '📋 Copy Details'}
                  </button>

                  <button
                    type="button"
                    className="sw-btn-creative-secondary"
                    onClick={() => setCreatedModal(null)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
