import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeaves, reviewLeaveRequest } from '../services/leaveService'
import { todayDateKey } from '../utils/dateHelpers'
import NavBar from '../components/NavBar'

const LEAVE_TYPES = [
  { id: 'vacation', label: 'Vacation / PTO', icon: '🌴', color: '#0ea5e9' },
  { id: 'sick', label: 'Sick Leave', icon: '🤒', color: '#f59e0b' },
  { id: 'casual', label: 'Casual Leave', icon: '☕', color: '#8b5cf6' },
  { id: 'emergency', label: 'Emergency Leave', icon: '🚨', color: '#ef4444' },
  { id: 'other', label: 'Unpaid / Other', icon: '📋', color: '#64748b' }
]

export default function AdminLeaves() {
  const { user, profile } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Review Modal State
  const [activeReviewLeave, setActiveReviewLeave] = useState(null)
  const [reviewAction, setReviewAction] = useState('approved') // 'approved' | 'rejected'
  const [adminNote, setAdminNote] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [selectedProof, setSelectedProof] = useState(null)

  const today = todayDateKey()

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeLeaves({
      onUpdate: (data) => {
        setLeaves(data)
        setLoading(false)
      },
      onError: (err) => {
        console.error('Failed to subscribe admin leaves:', err)
        setLoading(false)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Distinct list of employees from leave requests
  const employeesList = useMemo(() => {
    const map = new Map()
    leaves.forEach((l) => {
      if (l.uid && !map.has(l.uid)) {
        map.set(l.uid, l.userName || l.userEmail?.split('@')[0] || 'Employee')
      }
    })
    return Array.from(map, ([uid, name]) => ({ uid, name }))
  }, [leaves])

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

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (employeeFilter !== 'all' && l.uid !== employeeFilter) return false
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = (l.userName || '').toLowerCase().includes(query)
        const matchEmail = (l.userEmail || '').toLowerCase().includes(query)
        const matchReason = (l.reason || '').toLowerCase().includes(query)
        if (!matchName && !matchEmail && !matchReason) return false
      }
      return true
    })
  }, [leaves, statusFilter, employeeFilter, searchTerm])

  function handleOpenReview(leave, action) {
    setActiveReviewLeave(leave)
    setReviewAction(action)
    setAdminNote(leave.adminNote || (action === 'approved' ? 'Approved. Please coordinate handover.' : ''))
    setReviewError('')
  }

  async function handleConfirmReview(e) {
    e.preventDefault()
    if (!activeReviewLeave) return

    setReviewSubmitting(true)
    setReviewError('')

    const reviewerName = profile?.name || user?.displayName || 'Administrator'
    const reviewerUid = user?.uid || 'admin'

    try {
      await reviewLeaveRequest({
        leaveId: activeReviewLeave.id,
        status: reviewAction,
        reviewedBy: reviewerUid,
        reviewedByName: reviewerName,
        adminNote: adminNote.trim()
      })

      setActiveReviewLeave(null)
    } catch (err) {
      setReviewError(err.message || 'Failed to submit review decision. Please try again.')
    } finally {
      setReviewSubmitting(false)
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
        {/* Top Header & Navigation Links */}
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1>Workforce Leave Approvals</h1>
              {stats.pending > 0 ? (
                <span className="sw-leave-pending-badge-pulse" title={`${stats.pending} leave requests waiting for approval`}>
                  ⚠️ {stats.pending} Needs Review
                </span>
              ) : (
                <span className="sw-live-beacon" title="All reviews up to date">
                  <span className="sw-beacon-dot" /> Up to date
                </span>
              )}
            </div>
            <p className="subtle" style={{ margin: '0.35rem 0 0' }}>
              Review submitted time off requests, approve or decline applications, and communicate with team members.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/admin" className="sw-btn-header-link">
              <span>📊</span> Live Attendance
            </Link>
            <Link to="/admin/users" className="sw-btn-header-link">
              <span>👥</span> Manage Team
            </Link>
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="sw-creative-grid" style={{ marginTop: '1.25rem' }}>
          {/* Card 1: Pending Approvals */}
          <div className="sw-metric-card" style={{ borderColor: stats.pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.08)', background: stats.pending > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined }}>
            <div className="sw-metric-header">
              <span className="sw-metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>⏳</span>
              <span className="sw-metric-trend" style={{ color: '#f59e0b' }}>
                {stats.pending > 0 ? 'Action Required' : 'All Clear'}
              </span>
            </div>
            <div className="sw-metric-value" style={{ color: stats.pending > 0 ? '#fbbf24' : undefined }}>{stats.pending}</div>
            <div className="sw-metric-label">Pending Approval</div>
            <div className="sw-metric-sub">Requests awaiting admin review</div>
          </div>

          {/* Card 2: Approved Leaves */}
          <div className="sw-metric-card green">
            <div className="sw-metric-header">
              <span className="sw-light-indicator green">
                <span className="sw-indicator-dot green" />
                <span className="sw-indicator-letter">✓</span>
              </span>
              <span className="sw-metric-trend">Granted</span>
            </div>
            <div className="sw-metric-value">{stats.approved}</div>
            <div className="sw-metric-label">Approved Requests</div>
            <div className="sw-metric-sub">{stats.totalApprovedDays} approved employee days off</div>
          </div>

          {/* Card 3: Declined */}
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
            <div className="sw-metric-sub">Returned with manager notes</div>
          </div>

          {/* Card 4: Total Requests */}
          <div className="sw-metric-card purple">
            <div className="sw-metric-header">
              <span className="sw-metric-icon-box purple">🌴</span>
              <span className="sw-metric-trend purple">Total</span>
            </div>
            <div className="sw-metric-value">{stats.total}</div>
            <div className="sw-metric-label">Total Submissions</div>
            <div className="sw-metric-sub">Across all employees</div>
          </div>
        </div>

        <div className="sw-admin-leave-filters-bar">
          <div className="sw-leave-filter-bar">
            <button
              type="button"
              className={`sw-leave-filter-pill all ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>📋</span> All ({leaves.length})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill pending ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span>⏳</span> Pending ({stats.pending})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill approved ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <span>✅</span> Approved ({stats.approved})
            </button>
            <button
              type="button"
              className={`sw-leave-filter-pill rejected ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <span>❌</span> Declined ({stats.rejected})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="employee-picker-select"
            >
              <option value="all">All Employees ({employeesList.length})</option>
              {employeesList.map((e) => (
                <option key={e.uid} value={e.uid}>{e.name}</option>
              ))}
            </select>

            <div className="sw-search-input-wrap">
              <input
                type="text"
                placeholder="Search employee or reason…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sw-input"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', width: '220px' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="sw-search-clear"
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Leave Requests Grid */}
        {loading ? (
          <div className="sw-loading-box">
            <span className="sw-spinner" />
            <p>Loading workforce leave applications…</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="sw-empty-leaves-card">
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
            <h4>No Leave Requests Match Filter</h4>
            <p className="subtle" style={{ maxWidth: '420px', margin: '0.35rem auto 1rem' }}>
              {statusFilter === 'pending'
                ? 'All pending leave requests have been reviewed! Excellent work.'
                : 'No leave records found matching your selected status or search criteria.'}
            </p>
            {(statusFilter !== 'all' || employeeFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                className="sw-btn-reset-filters"
                onClick={() => {
                  setStatusFilter('all')
                  setEmployeeFilter('all')
                  setSearchTerm('')
                }}
              >
                🔄 Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="sw-admin-leaves-grid">
            {filteredLeaves.map((l) => {
              const typeInfo = getLeaveTypeInfo(l.leaveType)
              const isPending = l.status === 'pending'
              const isApproved = l.status === 'approved'
              const isRejected = l.status === 'rejected'
              const isCancelled = l.status === 'cancelled'
              const initial = (l.userName || l.userEmail || 'E').charAt(0).toUpperCase()

              return (
                <div key={l.id} className={`sw-admin-leave-card ${l.status}`}>
                  {/* Card Header: Employee info + Status */}
                  <div className="sw-admin-leave-header">
                    <div className="sw-admin-leave-user">
                      <div className="sw-admin-leave-avatar">{initial}</div>
                      <div>
                        <div className="sw-admin-leave-name">{l.userName || 'Employee'}</div>
                        <div className="sw-admin-leave-email">{l.userEmail}</div>
                      </div>
                    </div>

                    <div className="sw-leave-badge-group">
                      <span className={`sw-leave-status-pill ${l.status}`}>
                        {isPending && '⏳ Needs Review'}
                        {isApproved && '✅ Approved'}
                        {isRejected && '❌ Declined'}
                        {isCancelled && '🚫 Cancelled'}
                      </span>
                    </div>
                  </div>

                  {/* Leave Details: Type + Dates */}
                  <div className="sw-admin-leave-details">
                    <div className="sw-admin-leave-type-chip">
                      <span>{typeInfo.icon}</span>
                      <span>{typeInfo.label}</span>
                    </div>

                    <div className="sw-leave-duration-pill">
                      {l.daysCount} Day{l.daysCount === 1 ? '' : 's'} Off
                    </div>
                  </div>

                  {/* Dates Box */}
                  <div className="sw-leave-dates-box" style={{ margin: '0.85rem 0' }}>
                    <div className="sw-leave-date-col">
                      <span className="sw-leave-date-label">Start Date</span>
                      <strong className="sw-leave-date-val">{formatLeaveDate(l.startDate)}</strong>
                    </div>
                    <div className="sw-leave-arrow">➜</div>
                    <div className="sw-leave-date-col">
                      <span className="sw-leave-date-label">End Date</span>
                      <strong className="sw-leave-date-val">{formatLeaveDate(l.endDate)}</strong>
                    </div>
                  </div>

                  {/* Reason Box */}
                  <div className="sw-leave-reason-box">
                    <span className="sw-leave-reason-label">Employee Reason:</span>
                    <p className="sw-leave-reason-text">"{l.reason}"</p>
                  </div>

                  {/* Medical Proof Photo if attached */}
                  {l.proofPhotoUrl && (
                    <div style={{ margin: '0.65rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}
                        onClick={() => setSelectedProof({ url: l.proofPhotoUrl, title: `${l.userName || 'Employee'} — Medical Proof Certificate` })}
                      >
                        <span>🩺</span>
                        <span>Inspect Medical Proof Photo</span>
                      </button>
                    </div>
                  )}

                  {/* Review note if present */}
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

                  {/* Admin Actions Bar */}
                  <div className="sw-admin-leave-actions">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="sw-btn-approve-leave"
                          onClick={() => handleOpenReview(l, 'approved')}
                          id={`approve-btn-${l.id}`}
                        >
                          ✓ Approve Leave
                        </button>
                        <button
                          type="button"
                          className="sw-btn-decline-leave"
                          onClick={() => handleOpenReview(l, 'rejected')}
                          id={`decline-btn-${l.id}`}
                        >
                          ✕ Decline
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="sw-btn-reconsider-leave"
                        onClick={() => handleOpenReview(l, isApproved ? 'rejected' : 'approved')}
                      >
                        🔄 Change Decision / Update Note
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Review Decision Modal */}
        {activeReviewLeave && (
          <div className="modal-overlay" onClick={() => setActiveReviewLeave(null)}>
            <div className="sw-leave-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sw-modal-top-bar">
                <span className="sw-modal-top-title">
                  {reviewAction === 'approved' ? '✅ Approve Leave Request' : '❌ Decline Leave Request'}
                </span>
                <button
                  type="button"
                  className="sw-modal-close-icon-btn"
                  onClick={() => setActiveReviewLeave(null)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmReview} className="sw-leave-form">
                {reviewError && (
                  <div className="form-error" style={{ margin: '0 0 1rem' }}>
                    {reviewError}
                  </div>
                )}

                {/* Target Employee Info Summary */}
                <div className="sw-review-employee-summary">
                  <div style={{ color: '#f8fafc', fontSize: '0.98rem' }}>
                    <strong style={{ color: '#38bdf8' }}>{activeReviewLeave.userName}</strong>{' '}
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>({activeReviewLeave.userEmail})</span>
                  </div>
                  <div className="subtle" style={{ fontSize: '0.86rem', marginTop: '4px', color: '#cbd5e1' }}>
                    Requesting <strong style={{ color: '#38bdf8' }}>{activeReviewLeave.daysCount} day{activeReviewLeave.daysCount === 1 ? '' : 's'}</strong> ({formatLeaveDate(activeReviewLeave.startDate)} – {formatLeaveDate(activeReviewLeave.endDate)})
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.88rem', fontStyle: 'italic', color: '#f1f5f9', background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                    "{activeReviewLeave.reason}"
                  </div>
                  {activeReviewLeave.proofPhotoUrl && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <img
                        src={activeReviewLeave.proofPhotoUrl}
                        alt="Medical proof slip"
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #f59e0b' }}
                        onClick={() => setSelectedProof({ url: activeReviewLeave.proofPhotoUrl, title: `${activeReviewLeave.userName || 'Employee'} — Medical Proof Certificate` })}
                        title="Click to zoom proof photo"
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fbbf24' }}>🩺 Doctor / Medical Proof Attached</span>
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Click thumbnail to inspect full document</div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: '#f59e0b', color: '#fbbf24' }}
                        onClick={() => setSelectedProof({ url: activeReviewLeave.proofPhotoUrl, title: `${activeReviewLeave.userName || 'Employee'} — Medical Proof Certificate` })}
                      >
                        Enlarge
                      </button>
                    </div>
                  )}
                </div>

                {/* Decision Toggle */}
                <div className="sw-input-group" style={{ marginTop: '1.25rem' }}>
                  <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Decision</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className={`sw-decision-btn approve ${reviewAction === 'approved' ? 'active' : ''}`}
                      onClick={() => setReviewAction('approved')}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      className={`sw-decision-btn decline ${reviewAction === 'rejected' ? 'active' : ''}`}
                      onClick={() => setReviewAction('rejected')}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>

                {/* Optional Admin Note */}
                <div className="sw-input-group" style={{ marginTop: '1rem' }}>
                  <label style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    {reviewAction === 'approved' ? 'Manager Feedback / Handover Note (Optional)' : 'Reason for Declining (Recommended)'}
                  </label>
                  <textarea
                    rows="3"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder={
                      reviewAction === 'approved'
                        ? 'e.g. Approved. Please ensure critical tickets are covered before departure.'
                        : 'e.g. Declined due to high coverage demands during this sprint. Please choose another date.'
                    }
                    className="sw-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Actions */}
                <div className="sw-sheet-actions" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    className={`sw-btn-decision-confirm ${reviewAction === 'rejected' ? 'danger' : 'approve'}`}
                    disabled={reviewSubmitting}
                    id="confirm-review-btn"
                  >
                    {reviewSubmitting
                      ? 'Saving Decision…'
                      : reviewAction === 'approved'
                      ? '✓ Confirm Approval'
                      : '✕ Confirm Decline'}
                  </button>
                  <button
                    type="button"
                    className="sw-btn-modal-cancel"
                    disabled={reviewSubmitting}
                    onClick={() => setActiveReviewLeave(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Medical Proof Zoom Modal */}
        {selectedProof && (
          <div className="modal-overlay" onClick={() => setSelectedProof(null)} style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '540px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedProof.title || 'Medical Proof Document'}</h2>
                <button className="btn-close" onClick={() => setSelectedProof(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
                {selectedProof.url?.startsWith('data:application/pdf') || selectedProof.url?.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ padding: '2rem 1rem', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '3.2rem', marginBottom: '0.5rem' }}>📄</div>
                    <h4 style={{ color: '#f8fafc', margin: '0 0 0.5rem' }}>{selectedProof.title}</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      PDF Medical Certificate / Note Attached
                    </p>
                    <a
                      href={selectedProof.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.55rem 1.25rem' }}
                    >
                      <span>↗ Open / View Full PDF</span>
                    </a>
                  </div>
                ) : (
                  <img
                    src={selectedProof.url}
                    alt="Medical proof document"
                    style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                  />
                )}
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
    </div>
  )
}
