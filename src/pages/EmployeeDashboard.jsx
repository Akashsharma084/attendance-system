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
  const [selectedDayDetail, setSelectedDayDetail] = useState(null)
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'table' | 'cards'
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

  function handlePrevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number)
    const prevD = new Date(y, m - 2, 1)
    const newKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newKey)
  }

  function handleNextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number)
    const nextD = new Date(y, m, 1)
    const newKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newKey)
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

  // Monthly Calendar Matrix Generation
  const calendarData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr) // 1-indexed

    const totalDays = new Date(year, month, 0).getDate()
    // 1st of month: 0=Sun, 1=Mon, ..., 6=Sat
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
    // Monday-based calendar: 0=Mon, 1=Tue, ..., 5=Sat, 6=Sun
    const startPadding = (firstDayOfWeek + 6) % 7

    const recordMap = new Map()
    records.forEach((r) => {
      if (r.date) recordMap.set(r.date, r)
    })

    const pad = (n) => String(n).padStart(2, '0')
    const days = []

    // Previous month padding cells
    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate()
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        isPadding: true,
        dayNum: prevMonthTotalDays - i,
        key: `prev-${i}`
      })
    }

    // Days of current selected month
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${pad(month)}-${pad(d)}`
      const dateObj = new Date(year, month - 1, d)
      const dayOfWeek = dateObj.getDay() // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isToday = dateKey === todayKey
      const isFuture = dateKey > todayKey

      const record = recordMap.get(dateKey)
      let status = 'FUTURE'
      if (isFuture) {
        status = 'FUTURE'
      } else if (record) {
        status = 'P'
      } else if (isWeekend) {
        status = 'WEEKEND'
      } else {
        status = 'A'
      }

      const duration = record ? calcDayDuration(record.checkInTime, record.checkOutTime) : null

      days.push({
        isPadding: false,
        key: dateKey,
        dateKey,
        dayNum: d,
        weekdayShort: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        weekdayFull: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        isWeekend,
        isToday,
        isFuture,
        record,
        status,
        duration
      })
    }

    // End padding to complete last row of 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        isPadding: true,
        dayNum: i,
        key: `next-${i}`
      })
    }

    return { days, year, month, totalDays }
  }, [selectedMonth, records, todayKey])

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              to="/leaves"
              className="sw-toggle-btn"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.85rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
              title="Request and track leaves"
            >
              <span>🌴</span>
              <span>Time Off / Leaves</span>
            </Link>
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

        {/* Schedule View Section with Calendar (Default), Table & Cards Toggle */}
        <div className="sw-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Attendance Record</h3>
            <p className="subtle" style={{ margin: '0.2rem 0 0' }}>
              Full overview for {formatMonthLabel(selectedMonth)}. Tap any day for punch &amp; biometric details.
            </p>
          </div>

          <div className="sw-view-toggle-bar">
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              id="toggle-view-calendar"
            >
              📅 Calendar View
            </button>
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              id="toggle-view-table"
            >
              📋 Detailed Table
            </button>
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              id="toggle-view-cards"
            >
              🗂️ Cards
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sw-loading-box">
            <span className="sw-spinner" />
            <p>Fetching your verified attendance stream…</p>
          </div>
        ) : (
          <>
            {/* ================= VIEW 1: MONTHLY CALENDAR GRID (PRIMARY DEFAULT) ================= */}
            {viewMode === 'calendar' && (
              <div className="sw-calendar-wrapper">
                {/* Calendar Navigation & Month Title Bar */}
                <div className="sw-calendar-nav-bar">
                  <div className="sw-calendar-nav-controls">
                    <button
                      type="button"
                      className="sw-cal-btn-prev"
                      onClick={handlePrevMonth}
                      title="Previous Month"
                    >
                      ‹
                    </button>
                    <h3 className="sw-cal-month-title">{formatMonthLabel(selectedMonth)}</h3>
                    <button
                      type="button"
                      className="sw-cal-btn-next"
                      onClick={handleNextMonth}
                      title="Next Month"
                    >
                      ›
                    </button>
                    {selectedMonth !== monthKey() && (
                      <button
                        type="button"
                        className="sw-cal-today-shortcut"
                        onClick={() => setSelectedMonth(monthKey())}
                        title="Jump to current month"
                      >
                        Today
                      </button>
                    )}
                  </div>

                  {/* Calendar Quick Legend */}
                  <div className="sw-calendar-legend">
                    <span className="sw-legend-item">
                      <span className="sw-legend-dot present" /> Present
                    </span>
                    <span className="sw-legend-item">
                      <span className="sw-legend-dot absent" /> Absent
                    </span>
                    <span className="sw-legend-item">
                      <span className="sw-legend-dot weekend" /> Weekend
                    </span>
                    <span className="sw-legend-item">
                      <span className="sw-legend-dot today" /> Today
                    </span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="sw-calendar-container">
                  {/* Weekday Column Headers */}
                  <div className="sw-calendar-weekdays">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={day} className={`sw-cal-weekday-head ${idx >= 5 ? 'weekend' : ''}`}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Cells */}
                  <div className="sw-calendar-grid">
                    {calendarData.days.map((cell) => {
                      if (cell.isPadding) {
                        return (
                          <div key={cell.key} className="sw-cal-cell empty-pad">
                            <span className="sw-cal-pad-number">{cell.dayNum}</span>
                          </div>
                        )
                      }

                      const hasRecord = Boolean(cell.record)
                      const isPresent = cell.status === 'P'
                      const isAbsent = cell.status === 'A'
                      const isWeekend = cell.isWeekend
                      const isToday = cell.isToday
                      const isFuture = cell.isFuture

                      return (
                        <div
                          key={cell.key}
                          className={`sw-cal-cell ${
                            isPresent
                              ? 'cell-present'
                              : isAbsent
                              ? 'cell-absent'
                              : isWeekend
                              ? 'cell-weekend'
                              : isFuture
                              ? 'cell-future'
                              : ''
                          } ${isToday ? 'cell-today' : ''}`}
                          onClick={() => {
                            if (!isFuture) setSelectedDayDetail(cell)
                          }}
                          title={isFuture ? 'Upcoming day' : 'Click to inspect attendance details'}
                        >
                          {/* Cell Header: Day Number & Today indicator */}
                          <div className="sw-cal-cell-header">
                            <span className={`sw-cal-day-num ${isToday ? 'today-active' : ''}`}>
                              {cell.dayNum}
                            </span>
                            {isToday && <span className="sw-cal-today-chip">TODAY</span>}
                          </div>

                          {/* Cell Body: Status Pill & Punches */}
                          <div className="sw-cal-cell-content">
                            {isPresent && (
                              <div className="sw-cal-punch-info">
                                <span className="sw-cal-status-pill present">
                                  ✓ Present
                                </span>
                                <div className="sw-cal-times">
                                  <span className="in" title="Punch In">
                                    IN: {cell.record?.checkInTime ? formatTime(cell.record.checkInTime) : '—'}
                                  </span>
                                  {cell.record?.checkOutTime ? (
                                    <span className="out" title="Punch Out">
                                      OUT: {formatTime(cell.record.checkOutTime)}
                                    </span>
                                  ) : (
                                    <span className="in-progress">In Shift…</span>
                                  )}
                                </div>
                                {cell.duration && (
                                  <span className="sw-cal-duration-chip">⏱️ {cell.duration}</span>
                                )}
                              </div>
                            )}

                            {isAbsent && (
                              <div className="sw-cal-absent-info">
                                <span className="sw-cal-status-pill absent">
                                  ✕ Absent
                                </span>
                                <span className="sw-cal-missed-label">Missed Day</span>
                              </div>
                            )}

                            {isWeekend && !hasRecord && (
                              <div className="sw-cal-weekend-info">
                                <span className="sw-cal-weekend-pill">Weekend</span>
                              </div>
                            )}

                            {isFuture && (
                              <div className="sw-cal-future-info">
                                <span className="sw-cal-future-dash">—</span>
                              </div>
                            )}
                          </div>

                          {/* Mini Selfie Indicator Bar */}
                          {hasRecord && (cell.record?.checkInSelfieUrl || cell.record?.checkOutSelfieUrl) && (
                            <div className="sw-cal-selfie-dots">
                              {cell.record?.checkInSelfieUrl && (
                                <span
                                  className="sw-cal-selfie-dot in"
                                  title="Check-In Selfie Logged"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSelfie({ url: cell.record.checkInSelfieUrl, title: `${cell.dateKey} — Check-In Selfie` })
                                  }}
                                >
                                  📸 IN
                                </span>
                              )}
                              {cell.record?.checkOutSelfieUrl && (
                                <span
                                  className="sw-cal-selfie-dot out"
                                  title="Check-Out Selfie Logged"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSelfie({ url: cell.record.checkOutSelfieUrl, title: `${cell.dateKey} — Check-Out Selfie` })
                                  }}
                                >
                                  OUT
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 2: VISUAL DAY CARDS ================= */}
            {viewMode === 'cards' && (
              schedule.length === 0 ? (
                <p className="subtle">No working days recorded for {formatMonthLabel(selectedMonth)}.</p>
              ) : (
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
              )
            )}

            {/* ================= VIEW 3: DETAILED TABLE ================= */}
            {viewMode === 'table' && (
              schedule.length === 0 ? (
                <p className="subtle">No working days recorded for {formatMonthLabel(selectedMonth)}.</p>
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
              )
            )}
          </>
        )}
      </div>

      {/* Interactive Day Inspection Modal (Opens on date click from Calendar) */}
      {selectedDayDetail && (
        <div className="modal-overlay" onClick={() => setSelectedDayDetail(null)}>
          <div className="modal-card sw-day-inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="sw-inspect-weekday">{selectedDayDetail.weekdayFull}</span>
                <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem' }}>{selectedDayDetail.dateKey}</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedDayDetail(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {/* Status Header Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <span className={`sw-inspect-status-badge ${selectedDayDetail.status === 'P' ? 'present' : selectedDayDetail.status === 'A' ? 'absent' : 'weekend'}`}>
                  {selectedDayDetail.status === 'P' ? '✓ Verified Present' : selectedDayDetail.status === 'A' ? '✕ Absent (Unrecorded)' : '🏖️ Weekend / Rest Day'}
                </span>

                {selectedDayDetail.duration && (
                  <span className="sw-shift-hours-badge" style={{ fontSize: '0.9rem' }}>
                    ⏱️ {selectedDayDetail.duration}
                  </span>
                )}
              </div>

              {/* Present Day Details */}
              {selectedDayDetail.status === 'P' && selectedDayDetail.record && (
                <div className="sw-inspect-grid">
                  {/* In Punch Card */}
                  <div className="sw-inspect-punch-card in">
                    <div className="sw-inspect-card-top">
                      <span className="sw-punch-tag in">CHECK IN</span>
                      <strong className="sw-punch-time">
                        {formatTime(selectedDayDetail.record.checkInTime)}
                      </strong>
                    </div>
                    {selectedDayDetail.record.checkInSelfieUrl ? (
                      <div
                        className="sw-inspect-selfie-preview"
                        onClick={() => setSelectedSelfie({ url: selectedDayDetail.record.checkInSelfieUrl, title: `${selectedDayDetail.dateKey} — Check-In Selfie` })}
                        title="Click to expand selfie"
                      >
                        <img src={selectedDayDetail.record.checkInSelfieUrl} alt="In Selfie" />
                        <span className="sw-selfie-zoom-hint">🔍 Tap to Zoom</span>
                      </div>
                    ) : (
                      <div className="sw-inspect-no-selfie">No selfie image</div>
                    )}
                    <span className="sw-inspect-geo">📍 Biometric &amp; GPS Verified</span>
                  </div>

                  {/* Out Punch Card */}
                  <div className="sw-inspect-punch-card out">
                    <div className="sw-inspect-card-top">
                      <span className="sw-punch-tag out">CHECK OUT</span>
                      <strong className="sw-punch-time">
                        {selectedDayDetail.record.checkOutTime ? formatTime(selectedDayDetail.record.checkOutTime) : 'Pending Out Punch'}
                      </strong>
                    </div>
                    {selectedDayDetail.record.checkOutSelfieUrl ? (
                      <div
                        className="sw-inspect-selfie-preview"
                        onClick={() => setSelectedSelfie({ url: selectedDayDetail.record.checkOutSelfieUrl, title: `${selectedDayDetail.dateKey} — Check-Out Selfie` })}
                        title="Click to expand selfie"
                      >
                        <img src={selectedDayDetail.record.checkOutSelfieUrl} alt="Out Selfie" />
                        <span className="sw-selfie-zoom-hint">🔍 Tap to Zoom</span>
                      </div>
                    ) : (
                      <div className="sw-inspect-no-selfie">
                        {selectedDayDetail.record.checkOutTime ? 'No selfie image' : 'Shift still open'}
                      </div>
                    )}
                    <span className="sw-inspect-geo">
                      {selectedDayDetail.record.checkOutTime ? '📍 Biometric & GPS Verified' : '⏳ Awaiting checkout punch'}
                    </span>
                  </div>
                </div>
              )}

              {/* Absent Day Explanation */}
              {selectedDayDetail.status === 'A' && (
                <div className="sw-inspect-absent-card">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                  <h4 style={{ margin: '0 0 0.4rem', color: '#991b1b' }}>No Attendance Logged</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                    You have not recorded a biometric punch for this working day. If you were on duty or have an approved on-duty pass, you can submit an adjustment query via <strong>Contact Admin</strong>.
                  </p>
                </div>
              )}

              {/* Weekend Details */}
              {selectedDayDetail.status === 'WEEKEND' && (
                <div className="sw-inspect-weekend-card">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏖️</div>
                  <h4 style={{ margin: '0 0 0.4rem', color: '#334155' }}>Scheduled Weekend Off</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                    This was an official non-working rest day.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedDayDetail(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Zoom Preview Modal */}
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
