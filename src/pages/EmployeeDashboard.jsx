import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { useAuth } from '../context/AuthContext'
import {
  monthKey,
  todayDateKey,
  formatMonthLabel,
  formatTime,
  lastNMonthKeys,
  buildEmployeeSchedule
} from '../utils/dateHelpers'
import { mockGetAttendanceList } from '../mockService'
import NavBar from '../components/NavBar'

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSelfie, setSelectedSelfie] = useState(null)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const monthOptions = useMemo(() => lastNMonthKeys(6), [])
  const todayKey = todayDateKey()

  function calcDayDuration(inTime, outTime) {
    if (!inTime || !outTime) return null
    const dIn = inTime.toDate ? inTime.toDate() : new Date(inTime)
    const dOut = outTime.toDate ? outTime.toDate() : new Date(outTime)
    const diffMs = Math.max(0, dOut - dIn)
    const hrs = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hrs}h ${mins}m`
  }

  useEffect(() => {
    let cancelled = false
    if (!user?.uid) return
    setLoading(true)

    if (!isFirebaseConfigured || !db) {
      const list = mockGetAttendanceList({ uid: user.uid, month: selectedMonth })
      setRecords(list)
      setLoading(false)
      return
    }

    // Live Real-Time Listener:
    // Querying by 'uid' alone ensures ZERO composite index requirement!
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return
        const allUserDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // Filter by selected month & sort in JavaScript memory
        const monthDocs = allUserDocs.filter((r) => r.month === selectedMonth)
        monthDocs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        setRecords(monthDocs)
        setLoading(false)
      },
      (err) => {
        console.error('Error in live employee attendance:', err)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [user?.uid, selectedMonth])

  // Build complete day-by-day attendance schedule for the month (matching P and A)
  const { schedule, presentCount, absentCount, totalWorkingDays, fullDaysCount } = useMemo(() => {
    return buildEmployeeSchedule(records, selectedMonth, {
      uid: user?.uid,
      name: profile?.name || user?.email
    })
  }, [records, selectedMonth, user?.uid, profile?.name, user?.email])

  const attendanceRate = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 0

  // Today's record detection
  const todayRecord = useMemo(() => {
    return records.find((r) => r.date === todayKey)
  }, [records, todayKey])

  // Calculate consecutive attendance streak
  const streakDays = useMemo(() => {
    let streak = 0
    const pastRecords = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    for (const r of pastRecords) {
      if (r.checkInTime) streak++
      else break
    }
    return streak
  }, [records])

  // SVG Gauge calculations (radius = 42, circumference = 2 * PI * 42 ~= 264)
  const circumference = 264
  const strokeDashoffset = circumference - (attendanceRate / 100) * circumference

  return (
    <div className="page">
      <NavBar />

      <div className="page-body">
        {/* Top Header & Month Filter */}
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1>My Attendance Hub</h1>
              <span className="sw-live-beacon" title="Connected to live attendance stream">
                <span className="sw-beacon-dot" /> Live
              </span>
            </div>
            <p className="subtle" style={{ margin: '0.35rem 0 0' }}>
              Welcome back, <strong>{profile?.name || user?.email?.split('@')[0]}</strong>. Here is your biometric &amp; punctuality summary.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-picker-select"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Creative Today Status Widget Banner */}
        <div className={`sw-today-status-card ${todayRecord?.checkOutTime ? 'done' : todayRecord ? 'checked-in' : 'pending'}`}>
          <div className="sw-today-left">
            <div className="sw-today-icon">
              {todayRecord?.checkOutTime ? '🏁' : todayRecord ? '🟢' : '⏳'}
            </div>
            <div>
              <div className="sw-today-title">
                {todayRecord?.checkOutTime
                  ? "Today's Shift Completed"
                  : todayRecord
                  ? "You're Checked In for Today!"
                  : "You haven't checked in yet today"}
              </div>
              <div className="sw-today-subtitle">
                {todayRecord?.checkOutTime ? (
                  <>
                    Checked in at <strong>{formatTime(todayRecord.checkInTime)}</strong> • Checked out at <strong>{formatTime(todayRecord.checkOutTime)}</strong>
                  </>
                ) : todayRecord ? (
                  <>
                    Biometric Check-in confirmed at <strong>{formatTime(todayRecord.checkInTime)}</strong>. Remember to check out before leaving.
                  </>
                ) : (
                  <>Verify your presence by capturing a selfie punch from the check-in screen.</>
                )}
              </div>

              {/* Today's In & Out Selfie Previews */}
              {(todayRecord?.checkInSelfieUrl || todayRecord?.checkOutSelfieUrl) && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  {todayRecord.checkInSelfieUrl && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      onClick={() => setSelectedSelfie({ url: todayRecord.checkInSelfieUrl, title: `Today (${todayRecord.date}) — Check-In Selfie` })}
                      title="Click to zoom Check-In Selfie"
                    >
                      <img src={todayRecord.checkInSelfieUrl} alt="Check In Selfie" className="selfie-thumb-circle" style={{ width: '36px', height: '36px', borderColor: '#10b981' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>In Selfie</span>
                    </div>
                  )}
                  {todayRecord.checkOutSelfieUrl && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      onClick={() => setSelectedSelfie({ url: todayRecord.checkOutSelfieUrl, title: `Today (${todayRecord.date}) — Check-Out Selfie` })}
                      title="Click to zoom Check-Out Selfie"
                    >
                      <img src={todayRecord.checkOutSelfieUrl} alt="Check Out Selfie" className="selfie-thumb-circle" style={{ width: '36px', height: '36px', borderColor: '#f43f5e' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f43f5e' }}>Out Selfie</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="sw-today-right">
            {!todayRecord ? (
              <Link to="/" className="btn-primary sw-today-action-btn">
                📸 Punch In Now
              </Link>
            ) : !todayRecord.checkOutTime ? (
              <Link to="/" className="btn-primary sw-today-action-btn out">
                👋 Punch Out Now
              </Link>
            ) : (
              <span className="sw-status-completed-badge">✓ All Punches Logged</span>
            )}
          </div>
        </div>

        {/* Creative Analytics KPI Grid with SVG Circular Gauge */}
        <div className="sw-creative-grid">
          {/* Circular Attendance Gauge Card */}
          <div className="sw-gauge-card">
            <div className="sw-gauge-visual">
              <svg width="110" height="110" viewBox="0 0 100 100" className="sw-gauge-svg">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="sw-gauge-track"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="sw-gauge-bar"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  stroke={attendanceRate >= 80 ? '#10b981' : attendanceRate >= 60 ? '#f59e0b' : '#ef4444'}
                />
              </svg>
              <div className="sw-gauge-center-text">
                <span className="sw-gauge-number">{attendanceRate}%</span>
                <span className="sw-gauge-caption">Rate</span>
              </div>
            </div>

            <div className="sw-gauge-details">
              <div className="sw-gauge-title">Attendance Rate</div>
              <div className="sw-gauge-desc">
                {attendanceRate >= 90
                  ? '🌟 Excellent record! Top tier punctuality.'
                  : attendanceRate >= 75
                  ? '👍 Good standing. Keep the streak going!'
                  : '⚠️ Attendance below target. Check your absences.'}
              </div>
              <div className="sw-gauge-badge-row">
                <span className={`sw-rating-pill ${attendanceRate >= 80 ? 'green' : 'amber'}`}>
                  {attendanceRate >= 90 ? 'High Performer' : attendanceRate >= 75 ? 'On-Track' : 'Review Needed'}
                </span>
              </div>
            </div>
          </div>

          {/* Metric 2: Present Days */}
          <div className="sw-metric-card green">
            <div className="sw-metric-header">
              <span className="sw-light-indicator green">
                <span className="sw-indicator-dot green" />
                <span className="sw-indicator-letter">P</span>
              </span>
              <span className="sw-metric-trend">Verified</span>
            </div>
            <div className="sw-metric-value">{presentCount}</div>
            <div className="sw-metric-label">Days Present</div>
            <div className="sw-metric-sub">Out of {totalWorkingDays} working days</div>
          </div>

          {/* Metric 3: Absent Days */}
          <div className="sw-metric-card red">
            <div className="sw-metric-header">
              <span className="sw-light-indicator red">
                <span className="sw-indicator-dot red" />
                <span className="sw-indicator-letter">A</span>
              </span>
              <span className="sw-metric-trend red">Missed</span>
            </div>
            <div className="sw-metric-value">{absentCount}</div>
            <div className="sw-metric-label">Days Absent</div>
            <div className="sw-metric-sub">Leave / unrecorded</div>
          </div>

          {/* Metric 4: Full Day Punches & Streak */}
          <div className="sw-metric-card purple">
            <div className="sw-metric-header">
              <span className="sw-metric-icon-box purple">🔥</span>
              <span className="sw-metric-trend purple">{streakDays}d Streak</span>
            </div>
            <div className="sw-metric-value">{fullDaysCount}</div>
            <div className="sw-metric-label">Full Day Shifts</div>
            <div className="sw-metric-sub">Both In &amp; Out selfies logged</div>
          </div>
        </div>

        {/* Schedule View Section with Creative Day Cards & Table Toggle */}
        <div className="sw-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h3>Day-by-Day Attendance Record</h3>
            <p className="subtle" style={{ margin: '0.2rem 0 0' }}>
              Full log for {formatMonthLabel(selectedMonth)}. Click any selfie thumbnail to enlarge.
            </p>
          </div>

          <div className="sw-view-toggle-bar">
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              📅 Visual Day Cards
            </button>
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              📋 Detailed Table
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sw-loading-box">
            <span className="sw-spinner" />
            <p>Fetching your verified attendance stream…</p>
          </div>
        ) : schedule.length === 0 ? (
          <p className="subtle">No working days recorded for {formatMonthLabel(selectedMonth)}.</p>
        ) : viewMode === 'cards' ? (
          <div className="sw-day-cards-grid">
            {schedule.map((r) => {
              const duration = calcDayDuration(r.checkInTime, r.checkOutTime)
              return (
                <div key={r.id} className={`sw-day-card ${r.status === 'P' ? 'present' : 'absent'}`}>
                  <div className="sw-day-card-header">
                    <div>
                      <div className="sw-day-card-date">{r.date}</div>
                      <div className="sw-day-card-weekday">{r.weekdayFull}</div>
                    </div>
                    <span className={r.status === 'P' ? 'status-pill-p' : 'status-pill-a'}>
                      {r.status === 'P' ? '✓ Present' : '✕ Absent'}
                    </span>
                  </div>

                  <div className="sw-day-card-body">
                    <div className="sw-day-punch-row">
                      <span>Check In (In):</span>
                      <strong>{r.checkInTime ? formatTime(r.checkInTime) : '—'}</strong>
                    </div>
                    <div className="sw-day-punch-row">
                      <span>Check Out (Out):</span>
                      <strong>{r.checkOutTime ? formatTime(r.checkOutTime) : '—'}</strong>
                    </div>
                  </div>

                  <div className="sw-day-card-footer">
                    {duration ? (
                      <span className="sw-shift-hours-badge">⏱️ {duration}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {r.status === 'P' ? 'In-progress' : 'No punch'}
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {r.checkInSelfieUrl && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={r.checkInSelfieUrl}
                            alt="In Selfie"
                            className="selfie-thumb-circle"
                            style={{ borderColor: '#10b981' }}
                            onClick={() => setSelectedSelfie({ url: r.checkInSelfieUrl, title: `${r.date} — Check-In Selfie` })}
                            title="Zoom In Selfie"
                          />
                          <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>IN</span>
                        </div>
                      )}
                      {r.checkOutSelfieUrl && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={r.checkOutSelfieUrl}
                            alt="Out Selfie"
                            className="selfie-thumb-circle"
                            style={{ borderColor: '#f43f5e' }}
                            onClick={() => setSelectedSelfie({ url: r.checkOutSelfieUrl, title: `${r.date} — Check-Out Selfie` })}
                            title="Zoom Out Selfie"
                          />
                          <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#f43f5e', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>OUT</span>
                        </div>
                      )}
                      {!r.checkInSelfieUrl && !r.checkOutSelfieUrl && (
                        <span className="selfie-empty-dash">—</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '85px', textAlign: 'center' }}>Status</th>
                  <th>Date</th>
                  <th>Weekday</th>
                  <th>Check-In (In)</th>
                  <th>Check-Out (Out)</th>
                  <th style={{ width: '120px' }}>Selfies</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.id} className={r.status === 'A' ? 'row-absent' : 'row-present'}>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
                      {r.status === 'P' ? (
                        <span className="status-pill-p" title="Present">P</span>
                      ) : (
                        <span className="status-pill-a" title="Absent">A</span>
                      )}
                    </td>
                    <td data-label="Date">
                      <strong>{r.date}</strong>
                    </td>
                    <td data-label="Weekday">
                      <span className="weekday-tag">{r.weekdayFull}</span>
                    </td>
                    <td data-label="Check-In">
                      {r.checkInTime ? (
                        <span className="time-badge in">{formatTime(r.checkInTime)}</span>
                      ) : (
                        <span className="empty-dash">—</span>
                      )}
                    </td>
                    <td data-label="Check-Out">
                      {r.checkOutTime ? (
                        <span className="time-badge out">{formatTime(r.checkOutTime)}</span>
                      ) : (
                        <span className="empty-dash">—</span>
                      )}
                    </td>
                    <td data-label="Selfies">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {r.checkInSelfieUrl ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                              src={r.checkInSelfieUrl}
                              alt="Check-in Selfie"
                              className="selfie-thumb-circle"
                              style={{ borderColor: '#10b981' }}
                              onClick={() => setSelectedSelfie({ url: r.checkInSelfieUrl, title: `${r.date} — Check-In Selfie` })}
                              title="Click to zoom Check-in Selfie"
                            />
                            <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>IN</span>
                          </div>
                        ) : null}

                        {r.checkOutSelfieUrl ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                              src={r.checkOutSelfieUrl}
                              alt="Check-out Selfie"
                              className="selfie-thumb-circle"
                              style={{ borderColor: '#f43f5e' }}
                              onClick={() => setSelectedSelfie({ url: r.checkOutSelfieUrl, title: `${r.date} — Check-Out Selfie` })}
                              title="Click to zoom Check-out Selfie"
                            />
                            <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#f43f5e', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>OUT</span>
                          </div>
                        ) : null}

                        {!r.checkInSelfieUrl && !r.checkOutSelfieUrl && (
                          <span className="selfie-empty-dash">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selfie Preview Modal */}
      {selectedSelfie && (
        <div className="modal-overlay" onClick={() => setSelectedSelfie(null)}>
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedSelfie.title || 'Verified Selfie Capture'}</h2>
              <button className="btn-close" onClick={() => setSelectedSelfie(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <img
                src={selectedSelfie.url || selectedSelfie}
                alt="Enlarged selfie"
                style={{ width: '100%', borderRadius: '12px', display: 'block', maxHeight: '420px', objectFit: 'cover' }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setSelectedSelfie(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
