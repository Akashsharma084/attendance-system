import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeaves, submitLeaveRequest, cancelLeaveRequest } from '../services/leaveService'
import { todayDateKey } from '../utils/dateHelpers'
import { getUpcomingHoliday } from '../utils/holidays.js'
import NavBar from '../components/NavBar'

const LEAVE_TYPES = [
  { id: 'vacation', label: 'Vacation / PTO', icon: '🌴', color: '#0ea5e9' },
  { id: 'sick', label: 'Sick Leave', icon: '🤒', color: '#f59e0b' },
  { id: 'casual', label: 'Casual Leave', icon: '☕', color: '#8b5cf6' },
  { id: 'emergency', label: 'Emergency Leave', icon: '🚨', color: '#ef4444' },
  { id: 'other', label: 'Unpaid / Other', icon: '📋', color: '#64748b' }
]

export default function EmployeeLeaves() {
  const { user, profile } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [showModal, setShowModal] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  // Form State
  const today = todayDateKey()
  const [leaveType, setLeaveType] = useState('vacation')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [proofPhotoUrl, setProofPhotoUrl] = useState(null)
  const [proofPhotoName, setProofPhotoName] = useState('')
  const [selectedProof, setSelectedProof] = useState(null)
  const upcomingHoliday = useMemo(() => getUpcomingHoliday(), [])

  function handleProofUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, JPEG) for medical proof.')
      return
    }
    setProofPhotoName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1200
        let w = img.width
        let h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        setProofPhotoUrl(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  // Calculate days between start and end (inclusive)
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1
    const d1 = new Date(startDate + 'T00:00:00')
    const d2 = new Date(endDate + 'T00:00:00')
    const diffMs = d2 - d1
    if (diffMs < 0) return 0
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  useEffect(() => {
    if (!user?.uid) return
    setLoading(true)

    const unsubscribe = subscribeLeaves({
      uid: user.uid,
      onUpdate: (data) => {
        setLeaves(data)
        setLoading(false)
      },
      onError: (err) => {
        console.error('Failed to stream leaves:', err)
        setLoading(false)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [user?.uid])

  // Summary Metrics
  const stats = useMemo(() => {
    const total = leaves.length
    const pending = leaves.filter((l) => l.status === 'pending').length
    const approved = leaves.filter((l) => l.status === 'approved').length
    const rejected = leaves.filter((l) => l.status === 'rejected').length
    const totalApprovedDays = leaves
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + (Number(l.daysCount) || 1), 0)
    return { total, pending, approved, rejected, totalApprovedDays }
  }, [leaves])

  const filteredLeaves = useMemo(() => {
    if (filterStatus === 'all') return leaves
    return leaves.filter((l) => l.status === filterStatus)
  }, [leaves, filterStatus])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!startDate || !endDate) {
      setFormError('Please select both start and end dates.')
      return
    }

    if (calculatedDays <= 0) {
      setFormError('End date cannot be earlier than start date.')
      return
    }

    if (!reason.trim()) {
      setFormError('Please provide a brief reason for your leave request.')
      return
    }

    setSubmitting(true)
    try {
      await submitLeaveRequest({
        uid: user.uid,
        userName: profile?.name || user?.displayName || user?.email?.split('@')[0],
        userEmail: user?.email,
        leaveType,
        startDate,
        endDate,
        daysCount: calculatedDays,
        reason: reason.trim(),
        proofPhotoUrl: leaveType === 'sick' ? proofPhotoUrl : null
      })

      setFormSuccess('🎉 Leave request submitted successfully!')
      setTimeout(() => {
        setShowModal(false)
        setFormSuccess('')
        setReason('')
        setStartDate(today)
        setEndDate(today)
        setLeaveType('vacation')
        setProofPhotoUrl(null)
        setProofPhotoName('')
      }, 1200)
    } catch (err) {
      setFormError(err.message || 'Failed to submit leave request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(leaveId) {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) {
      return
    }
    setCancellingId(leaveId)
    try {
      await cancelLeaveRequest({ leaveId, uid: user.uid })
    } catch (err) {
      alert('Could not cancel request: ' + (err.message || 'Please try again.'))
    } finally {
      setCancellingId(null)
    }
  }

  function formatLeaveDate(dateStr) {
    if (!dateStr) return '—'
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getLeaveTypeInfo(typeId) {
    return LEAVE_TYPES.find((t) => t.id === typeId) || { id: 'other', label: 'Leave', icon: '📋', color: '#64748b' }
  }

  return (
    <div className="page">
      <NavBar />

      <div className="page-body">
        {/* Top Header */}
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1>My Leave &amp; Time Off</h1>
              <span className="sw-live-beacon" title="Live status sync">
                <span className="sw-beacon-dot" /> Real-time
              </span>
            </div>
            <p className="subtle" style={{ margin: '0.35rem 0 0' }}>
              Request planned time off, monitor manager approvals, and manage your leave requests.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="sw-btn-header-link">
              <span>📅</span> Attendance Hub
            </Link>
            <button
              type="button"
              className="sw-btn-request-leave"
              onClick={() => {
                setFormError('')
                setFormSuccess('')
                setShowModal(true)
              }}
              id="open-request-leave-btn"
            >
              <span className="sw-btn-sparkle">✨</span>
              <span>Request Leave</span>
            </button>
          </div>
        </div>

        {/* Analytics & Metrics Cards */}
        <div className="sw-creative-grid" style={{ marginTop: '1.25rem' }}>
          {/* Card 1: Pending Requests */}
          <div className="sw-metric-card purple">
            <div className="sw-metric-header">
              <span className="sw-metric-icon-box purple">⏳</span>
              <span className="sw-metric-trend purple">Awaiting Review</span>
            </div>
            <div className="sw-metric-value">{stats.pending}</div>
            <div className="sw-metric-label">Pending Requests</div>
            <div className="sw-metric-sub">Submitted to admin for approval</div>
          </div>

          {/* Card 2: Approved Leaves */}
          <div className="sw-metric-card green">
            <div className="sw-metric-header">
              <span className="sw-light-indicator green">
                <span className="sw-indicator-dot green" />
                <span className="sw-indicator-letter">✓</span>
              </span>
              <span className="sw-metric-trend">Confirmed</span>
            </div>
            <div className="sw-metric-value">{stats.approved}</div>
            <div className="sw-metric-label">Approved Leaves</div>
            <div className="sw-metric-sub">{stats.totalApprovedDays} total days off approved</div>
          </div>

          {/* Card 3: Rejected */}
          <div className="sw-metric-card red">
            <div className="sw-metric-header">
              <span className="sw-light-indicator red">
                <span className="sw-indicator-dot red" />
                <span className="sw-indicator-letter">✕</span>
              </span>
              <span className="sw-metric-trend red">Declined</span>
            </div>
            <div className="sw-metric-value">{stats.rejected}</div>
            <div className="sw-metric-label">Declined Requests</div>
            <div className="sw-metric-sub">With review feedback</div>
          </div>

          {/* Card 4: Total Applications */}
          <div className="sw-metric-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)' }}>
            <div className="sw-metric-header">
              <span className="sw-metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>📋</span>
              <span className="sw-metric-trend" style={{ color: '#38bdf8' }}>History</span>
            </div>
            <div className="sw-metric-value">{stats.total}</div>
            <div className="sw-metric-label">Total Applications</div>
            <div className="sw-metric-sub">All-time submissions</div>
          </div>
        </div>

        {/* Upcoming Official Holiday Notice Banner */}
        {upcomingHoliday && (
          <div className="sw-upcoming-holiday-card">
            <div className="sw-upcoming-holiday-left">
              <span className="sw-upcoming-holiday-icon">{upcomingHoliday.icon || '🎉'}</span>
              <div>
                <div className="sw-upcoming-holiday-title">
                  Next Official Company Holiday: <strong>{upcomingHoliday.name}</strong>
                </div>
                <div className="sw-upcoming-holiday-sub">
                  Date: <strong>{upcomingHoliday.date}</strong> ({upcomingHoliday.type === 'national' ? 'National Holiday' : 'Official Paid Holiday'}) • Office will remain closed.
                </div>
              </div>
            </div>
            <span className="sw-upcoming-holiday-badge">🏖️ Paid Day Off</span>
          </div>
        )}

        {/* Filter Tabs & Section Header */}
        <div className="sw-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginTop: '2rem' }}>
          <div>
            <h3>Leave Request History</h3>
            <p className="subtle" style={{ margin: '0.2rem 0 0' }}>
              Showing {filteredLeaves.length} {filterStatus !== 'all' ? filterStatus : ''} record{filteredLeaves.length === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="sw-leave-filter-bar">
            <button
              type="button"
              className={`sw-leave-filter-pill all ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              <span>📋</span> All ({leaves.length})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill pending ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              <span>⏳</span> Pending ({stats.pending})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill approved ${filterStatus === 'approved' ? 'active' : ''}`}
              onClick={() => setFilterStatus('approved')}
            >
              <span>✅</span> Approved ({stats.approved})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill rejected ${filterStatus === 'rejected' ? 'active' : ''}`}
              onClick={() => setFilterStatus('rejected')}
            >
              <span>❌</span> Rejected ({stats.rejected})
            </button>
          </div>
        </div>

        {/* Leave Requests List */}
        {loading ? (
          <div className="sw-loading-box">
            <span className="sw-spinner" />
            <p>Fetching your leave requests…</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="sw-empty-leaves-card">
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌴</div>
            <h4>No Leave Requests Found</h4>
            <p className="subtle" style={{ maxWidth: '420px', margin: '0.35rem auto 1.25rem' }}>
              {filterStatus === 'all'
                ? "You haven't submitted any leave requests yet. Click below to request time off."
                : `You have no ${filterStatus} leave requests right now.`}
            </p>
            {filterStatus === 'all' && (
              <button
                type="button"
                className="sw-btn-request-leave"
                style={{ margin: '0 auto' }}
                onClick={() => setShowModal(true)}
              >
                <span>✨</span>
                <span>Request Your First Leave</span>
              </button>
            )}
          </div>
        ) : (
          <div className="sw-leaves-grid">
            {filteredLeaves.map((l) => {
              const typeInfo = getLeaveTypeInfo(l.leaveType)
              const isPending = l.status === 'pending'
              const isApproved = l.status === 'approved'
              const isRejected = l.status === 'rejected'
              const isCancelled = l.status === 'cancelled'

              return (
                <div key={l.id} className={`sw-leave-card ${l.status}`}>
                  <div className="sw-leave-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="sw-leave-type-icon">{typeInfo.icon}</span>
                      <div>
                        <div className="sw-leave-type-name">{typeInfo.label}</div>
                        <div className="sw-leave-applied-date">
                          Applied {formatLeaveDate(l.createdAt ? (l.createdAt.toDate ? todayDateKey(l.createdAt.toDate()) : l.createdAt.slice(0, 10)) : today)}
                        </div>
                      </div>
                    </div>

                    <div className="sw-leave-badge-group">
                      <span className={`sw-leave-status-pill ${l.status}`}>
                        {isPending && '⏳ Pending Review'}
                        {isApproved && '✅ Approved'}
                        {isRejected && '❌ Declined'}
                        {isCancelled && '🚫 Cancelled'}
                      </span>
                    </div>
                  </div>

                  {/* Dates Banner */}
                  <div className="sw-leave-dates-box">
                    <div className="sw-leave-date-col">
                      <span className="sw-leave-date-label">From</span>
                      <strong className="sw-leave-date-val">{formatLeaveDate(l.startDate)}</strong>
                    </div>
                    <div className="sw-leave-arrow">➜</div>
                    <div className="sw-leave-date-col">
                      <span className="sw-leave-date-label">To</span>
                      <strong className="sw-leave-date-val">{formatLeaveDate(l.endDate)}</strong>
                    </div>
                    <div className="sw-leave-duration-pill">
                      {l.daysCount} Day{l.daysCount === 1 ? '' : 's'}
                    </div>
                  </div>

                  {/* Employee Reason */}
                  <div className="sw-leave-reason-box">
                    <span className="sw-leave-reason-label">Reason:</span>
                    <p className="sw-leave-reason-text">"{l.reason}"</p>
                  </div>

                  {/* Medical Proof Photo Preview if attached */}
                  {l.proofPhotoUrl && (
                    <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}
                        onClick={() => setSelectedProof({ url: l.proofPhotoUrl, title: `${typeInfo.label} — Medical Proof Photo` })}
                      >
                        <span>🩺</span>
                        <span>View Medical Proof Photo</span>
                      </button>
                    </div>
                  )}

                  {/* Review feedback if approved or rejected */}
                  {(l.adminNote || l.reviewedByName) && (
                    <div className={`sw-leave-review-box ${l.status}`}>
                      <div className="sw-leave-review-header">
                        <span>🛡️ Reviewed by <strong>{l.reviewedByName || 'Admin'}</strong></span>
                        {l.reviewedAt && (
                          <span className="subtle" style={{ fontSize: '0.75rem' }}>
                            {formatLeaveDate(l.reviewedAt.slice ? l.reviewedAt.slice(0, 10) : today)}
                          </span>
                        )}
                      </div>
                      {l.adminNote && (
                        <p className="sw-leave-review-note">
                          Note: "{l.adminNote}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions for Pending */}
                  {isPending && (
                    <div className="sw-leave-card-actions">
                      <button
                        type="button"
                        className="sw-btn-leave-cancel"
                        disabled={cancellingId === l.id}
                        onClick={() => handleCancel(l.id)}
                      >
                        {cancellingId === l.id ? 'Cancelling…' : '✕ Cancel Request'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Request Leave (Rendered at Root Level for Proper Stacking & No Clipping) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="sw-leave-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sw-modal-top-bar">
                <span className="sw-modal-top-title">🌴 Request Time Off / Leave</span>
                <button
                  type="button"
                  className="sw-modal-close-icon-btn"
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="sw-leave-form">
                {formSuccess && (
                  <div className="form-notice" style={{ margin: '0 0 1rem' }}>
                    {formSuccess}
                  </div>
                )}
                {formError && (
                  <div className="form-error" style={{ margin: '0 0 1rem' }}>
                    {formError}
                  </div>
                )}

                {/* Leave Type Select */}
                <div className="sw-input-group">
                  <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Leave Category</label>
                  <div className="sw-leave-type-selector">
                    {LEAVE_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`sw-leave-type-chip ${t.id} ${leaveType === t.id ? 'active' : ''}`}
                        onClick={() => setLeaveType(t.id)}
                      >
                        <span className="sw-chip-icon">{t.icon}</span>
                        <span className="sw-chip-label">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Ranges */}
                <div className="sw-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="sw-input-group">
                    <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      min={today}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        if (e.target.value > endDate) {
                          setEndDate(e.target.value)
                        }
                      }}
                      className="sw-input"
                    />
                  </div>
                  <div className="sw-input-group">
                    <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      min={startDate || today}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="sw-input"
                    />
                  </div>
                </div>

                {/* Duration Preview Banner */}
                <div className="sw-duration-preview-banner">
                  <span>⏱️ Duration Calculated:</span>
                  <strong>{calculatedDays} Day{calculatedDays === 1 ? '' : 's'}</strong>
                </div>

                {/* Reason Textarea */}
                <div className="sw-input-group" style={{ marginTop: '1rem' }}>
                  <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Reason / Explanation</label>
                  <textarea
                    required
                    rows="3"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe the reason for your absence (e.g. medical appointment, travel, personal family commitment)..."
                    className="sw-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Sick Leave Medical Proof Photo Upload */}
                {leaveType === 'sick' && (
                  <div className="sw-input-group" style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.08)', padding: '0.9rem', borderRadius: '12px', border: '1px dashed rgba(245, 158, 11, 0.45)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <label style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span>🩺 Medical Proof / Doctor Slip</span>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500 }}>(Optional Proof)</span>
                      </label>
                    </div>
                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                      Attach a photo of your doctor's certificate, clinic note, or medical slip as verification.
                    </p>

                    {!proofPhotoUrl ? (
                      <div>
                        <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.45rem 0.9rem', fontSize: '0.84rem', borderColor: '#f59e0b', color: '#fbbf24' }}>
                          <span>📷 Choose Proof Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProofUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#94a3b8' }}>JPG, PNG photo</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15, 23, 42, 0.65)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <img
                          src={proofPhotoUrl}
                          alt="Medical proof preview"
                          style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #f59e0b' }}
                          onClick={() => setSelectedProof({ url: proofPhotoUrl, title: 'Medical Proof Preview' })}
                          title="Click to zoom proof photo"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ✓ {proofPhotoName || 'Proof Photo Attached'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedProof({ url: proofPhotoUrl, title: 'Medical Proof Preview' })}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#38bdf8', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Zoom photo
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ color: '#ef4444', fontSize: '0.78rem', padding: '3px 8px' }}
                          onClick={() => {
                            setProofPhotoUrl(null)
                            setProofPhotoName('')
                          }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Actions */}
                <div className="sw-sheet-actions" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    className="sw-btn-modal-submit"
                    disabled={submitting || Boolean(formSuccess)}
                    id="submit-leave-btn"
                  >
                    {submitting ? 'Submitting Leave Request…' : '🚀 Submit Leave Request'}
                  </button>
                  <button
                    type="button"
                    className="sw-btn-modal-cancel"
                    disabled={submitting}
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* Proof Photo Zoom Modal */}
      {selectedProof && (
        <div className="modal-overlay" onClick={() => setSelectedProof(null)} style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '520px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProof.title || 'Medical Proof Document'}</h2>
              <button className="btn-close" onClick={() => setSelectedProof(null)}>✕</button>
            </div>
            <div style={{ padding: '1rem' }}>
              <img
                src={selectedProof.url}
                alt="Medical proof"
                style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => setSelectedProof(null)}>
                Close Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
