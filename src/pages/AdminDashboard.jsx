import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import {
  monthKey,
  todayDateKey,
  formatMonthLabel,
  formatTime,
  lastNMonthKeys,
  getWeekday,
  buildEmployeeSchedule,
  getMonthWorkingDays
} from '../utils/dateHelpers'
import { mockGetAttendanceList, getStoredUsers } from '../mockService'
import NavBar from '../components/NavBar'

export default function AdminDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [records, setRecords] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSelfie, setSelectedSelfie] = useState(null)
  const monthOptions = useMemo(() => lastNMonthKeys(6), [])
  const todayKey = todayDateKey()

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    if (!isFirebaseConfigured || !db) {
      const list = mockGetAttendanceList({ month: selectedMonth })
      setRecords(list)
      setUsersList(getStoredUsers().filter((u) => u.role !== 'admin'))
      setLoading(false)
      return
    }

    // Live Real-Time Attendance Listener:
    // Without 'orderBy' on a separate field, ZERO composite index is required!
    const q = query(
      collection(db, 'attendance'),
      where('month', '==', selectedMonth)
    )

    const unsubAttendance = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // In-memory sort by date descending
        docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        setRecords(docs)
        setLoading(false)
      },
      (err) => {
        console.error('Error in live admin attendance:', err)
        setLoading(false)
      }
    )

    // Real-time users listener so newly created employees show immediately
    const usersQ = query(collection(db, 'users'))
    const unsubUsers = onSnapshot(
      usersQ,
      (snap) => {
        if (cancelled) return
        setUsersList(
          snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((u) => (u.role || '').toLowerCase() !== 'admin')
        )
      },
      (err) => console.warn('Could not fetch users list:', err)
    )

    return () => {
      cancelled = true
      unsubAttendance()
      unsubUsers()
    }
  }, [selectedMonth])

  // Extract all distinct employees present in records or user list
  const employees = useMemo(() => {
    const map = new Map()
    // seed with user list
    usersList.forEach((u) => map.set(u.uid, u.name || u.email?.split('@')[0] || 'Employee'))
    // seed with any attendance record
    records.forEach((r) => {
      if (r.uid && (r.name || r.email)) map.set(r.uid, r.name || r.email)
    })
    return Array.from(map, ([uid, name]) => ({ uid, name }))
  }, [records, usersList])

  // If a single employee is selected, build their day-by-day P/A calendar schedule
  const singleEmployeeData = useMemo(() => {
    if (employeeFilter === 'all') return null
    const empRecords = records.filter((r) => r.uid === employeeFilter)
    const empInfo = employees.find((e) => e.uid === employeeFilter) || { uid: employeeFilter, name: 'Employee' }
    return {
      employee: empInfo,
      ...buildEmployeeSchedule(empRecords, selectedMonth, empInfo)
    }
  }, [employeeFilter, records, selectedMonth, employees])

  async function handleDeleteAttendanceRecord(r) {
    if (!window.confirm(`Delete attendance record for "${r.name || 'Employee'}" on ${r.date}? This cannot be undone.`)) {
      return
    }
    try {
      if (!isFirebaseConfigured || !db) {
        const updated = records.filter((x) => x.id !== r.id)
        setRecords(updated)
        localStorage.setItem('punch_demo_attendance', JSON.stringify(updated))
        return
      }
      await deleteDoc(doc(db, 'attendance', r.id))
    } catch (err) {
      console.error('Error deleting attendance record:', err)
      alert('Could not delete attendance record: ' + (err.message || 'Permission denied'))
    }
  }

  // Per-employee monthly summary statistics (Present & Absent counts for each employee)
  const employeeSummaries = useMemo(() => {
    const workingDaysCount = getMonthWorkingDays(selectedMonth).length

    return employees.map((emp) => {
      const empRecords = records.filter((r) => r.uid === emp.uid)
      const { presentCount, absentCount, fullDaysCount } = buildEmployeeSchedule(
        empRecords,
        selectedMonth,
        emp
      )
      const rate = workingDaysCount > 0 ? Math.round((presentCount / workingDaysCount) * 100) : 0
      return {
        uid: emp.uid,
        name: emp.name,
        presentCount,
        absentCount,
        fullDaysCount,
        totalWorkingDays: workingDaysCount,
        rate
      }
    })
  }, [employees, records, selectedMonth])

  // Today's live punches across workforce
  const todayPunches = useMemo(() => {
    return records.filter((r) => r.date === todayKey)
  }, [records, todayKey])

  const presentTodayCount = todayPunches.length
  const completedTodayCount = todayPunches.filter((r) => r.checkOutTime).length
  const inShiftNowCount = presentTodayCount - completedTodayCount

  // Overall organization attendance average rate
  const overallAvgRate = useMemo(() => {
    if (employeeSummaries.length === 0) return 0
    const sum = employeeSummaries.reduce((acc, s) => acc + s.rate, 0)
    return Math.round(sum / employeeSummaries.length)
  }, [employeeSummaries])

  const totalPresents = useMemo(() => {
    return employeeSummaries.reduce((acc, s) => acc + (s.presentCount || 0), 0)
  }, [employeeSummaries])

  const totalAbsents = useMemo(() => {
    return employeeSummaries.reduce((acc, s) => acc + (s.absentCount || 0), 0)
  }, [employeeSummaries])

  // CSV Export
  function exportCSV() {
    if (records.length === 0) {
      alert('No attendance records to export for this month.')
      return
    }
    const headers = ['Employee Name', 'Date', 'Weekday', 'Check-In Time', 'Check-Out Time', 'GPS Coordinates']
    const rows = records.map((r) => [
      `"${r.name || 'Unknown'}"`,
      r.date,
      getWeekday(r.date, 'long'),
      r.checkInTime ? formatTime(r.checkInTime) : '—',
      r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      r.checkInLocation ? `"${r.checkInLocation.lat}, ${r.checkInLocation.lng}"` : '—'
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Workforce_Attendance_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // SVG Gauge calculations
  const circumference = 264
  const strokeDashoffset = circumference - (overallAvgRate / 100) * circumference

  return (
    <div className="page">
      <NavBar />
      <div className="page-body">
        {/* Top Header & Actions */}
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1>Organization Attendance</h1>
              <span className="sw-live-beacon" title="Live real-time feed active">
                <span className="sw-beacon-dot" /> Live Stream
              </span>
            </div>
            <p className="subtle" style={{ margin: '0.35rem 0 0' }}>
              Real-time employee check-in monitoring, biometric photos, GPS locations &amp; workforce analytics.
            </p>
          </div>

          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-picker-select"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="employee-picker-select"
            >
              <option value="all">All Employees ({employees.length})</option>
              {employees.map((e) => (
                <option key={e.uid} value={e.uid}>{e.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="sw-export-csv-btn"
              onClick={exportCSV}
              title="Download full monthly attendance report as CSV spreadsheet"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Live Attendance Pulse Bar */}
        <div className="sw-admin-live-strip">
          <div className="sw-live-stat">
            <span className="sw-live-dot" />
            <span>Present Today: <strong>{presentTodayCount}</strong> employees</span>
          </div>
          <div className="sw-live-stat">
            <span>⏱️ In-Shift Right Now: <strong>{inShiftNowCount}</strong></span>
          </div>
          <div className="sw-live-stat">
            <span>🏁 Shift Completed Today: <strong>{completedTodayCount}</strong></span>
          </div>
          <div className="sw-live-stat">
            <span>👥 Monitored Workforce: <strong>{employees.length}</strong></span>
          </div>
        </div>

        {/* Creative Analytics Strip with Circular Gauge */}
        {employeeFilter === 'all' ? (
          <div className="sw-creative-grid">
            {/* Circular Gauge Card */}
            <div className="sw-gauge-card">
              <div className="sw-gauge-visual">
                <svg width="110" height="110" viewBox="0 0 100 100" className="sw-gauge-svg">
                  <circle cx="50" cy="50" r="42" className="sw-gauge-track" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="sw-gauge-bar"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    stroke={overallAvgRate >= 80 ? '#10b981' : overallAvgRate >= 60 ? '#f59e0b' : '#ef4444'}
                  />
                </svg>
                <div className="sw-gauge-center-text">
                  <span className="sw-gauge-number">{overallAvgRate}%</span>
                  <span className="sw-gauge-caption">Avg Rate</span>
                </div>
              </div>
              <div className="sw-gauge-details">
                <div className="sw-gauge-title">Company Attendance Avg</div>
                <div className="sw-gauge-desc">
                  Average across all {employees.length} employees for {formatMonthLabel(selectedMonth).split(' ')[0]}.
                </div>
                <div className="sw-gauge-badge-row">
                  <span className={`sw-rating-pill ${overallAvgRate >= 80 ? 'green' : 'amber'}`}>
                    {overallAvgRate >= 80 ? 'Optimal Workforce' : 'Attention Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Present Logs Card */}
            <div className="sw-metric-card green">
              <div className="sw-metric-header">
                <span className="sw-light-indicator green">
                  <span className="sw-indicator-dot green" />
                  <span className="sw-indicator-letter">P</span>
                </span>
                <span className="sw-metric-trend">Total Logs</span>
              </div>
              <div className="sw-metric-value">{totalPresents}</div>
              <div className="sw-metric-label">Total Present Logs</div>
              <div className="sw-metric-sub">Across all employees this month</div>
            </div>

            {/* Absent Logs Card */}
            <div className="sw-metric-card red">
              <div className="sw-metric-header">
                <span className="sw-light-indicator red">
                  <span className="sw-indicator-dot red" />
                  <span className="sw-indicator-letter">A</span>
                </span>
                <span className="sw-metric-trend red">Missed Days</span>
              </div>
              <div className="sw-metric-value">{totalAbsents}</div>
              <div className="sw-metric-label">Total Absent Days</div>
              <div className="sw-metric-sub">Unrecorded / off days</div>
            </div>

            {/* Workforce Working Days */}
            <div className="sw-metric-card purple">
              <div className="sw-metric-header">
                <span className="sw-metric-icon-box purple">📅</span>
                <span className="sw-metric-trend purple">{getMonthWorkingDays(selectedMonth).length} Days</span>
              </div>
              <div className="sw-metric-value">{employees.length}</div>
              <div className="sw-metric-label">Active Team Members</div>
              <div className="sw-metric-sub">{formatMonthLabel(selectedMonth).split(' ')[0]} working period</div>
            </div>
          </div>
        ) : (
          <div className="stat-strip">
            <div className="stat stat-present">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                <span className="sw-indicator-dot green" />
                <strong style={{ fontSize: '1.1rem', color: '#047857' }}>P</strong>
              </div>
              <div>
                <strong>{singleEmployeeData?.presentCount || 0}</strong>
                <span>Present (P) Days</span>
              </div>
            </div>

            <div className="stat stat-absent">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                <span className="sw-indicator-dot red" />
                <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>A</strong>
              </div>
              <div>
                <strong>{singleEmployeeData?.absentCount || 0}</strong>
                <span>Absent (A) Days</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-icon-wrap icon-blue">
                <span>⏱️</span>
              </div>
              <div>
                <strong>{singleEmployeeData?.fullDaysCount || 0}</strong>
                <span>Full Days (In + Out)</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-icon-wrap icon-purple">
                <span>📊</span>
              </div>
              <div>
                <strong>
                  {singleEmployeeData?.totalWorkingDays > 0
                    ? Math.round((singleEmployeeData.presentCount / singleEmployeeData.totalWorkingDays) * 100)
                    : 0}%
                </strong>
                <span>Monthly Attendance</span>
              </div>
            </div>
          </div>
        )}

        {/* If 'all' is selected: Show Monthly Employee Report Cards Breakdown */}
        {employeeFilter === 'all' && employeeSummaries.length > 0 && (
          <div className="sw-section-block">
            <div className="sw-section-header">
              <h3>Monthly Employee Attendance Breakdown ({formatMonthLabel(selectedMonth)})</h3>
              <span className="subtle">Summary of each employee's Present &amp; Absent counts</span>
            </div>
            <div className="table-wrap" style={{ marginBottom: '2.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th style={{ textAlign: 'center' }}>Present (Days)</th>
                    <th style={{ textAlign: 'center' }}>Absent (Days)</th>
                    <th style={{ textAlign: 'center' }}>Attendance Rate (%)</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeSummaries.map((emp) => (
                    <tr key={emp.uid}>
                      <td data-label="Employee"><strong>{emp.name}</strong></td>
                      <td data-label="Present Days" style={{ textAlign: 'center' }}>
                        <span className="status-pill-p-count">{emp.presentCount} P</span>
                      </td>
                      <td data-label="Absent Days" style={{ textAlign: 'center' }}>
                        <span className="status-pill-a-count">{emp.absentCount} A</span>
                      </td>
                      <td data-label="Attendance Rate" style={{ textAlign: 'center' }}>
                        <div className="progress-bar-wrap" style={{ margin: '0 auto', maxWidth: '140px', justifyContent: 'center' }}>
                          <div className="progress-bar-fill" style={{ width: `${emp.rate}%` }} />
                          <span className="progress-bar-label">{emp.rate}%</span>
                        </div>
                      </td>
                      <td data-label="Action" style={{ textAlign: 'center' }}>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setEmployeeFilter(emp.uid)}
                        >
                          View Days
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Attendance Records Table */}
        <div className="sw-section-header">
          <h3>
            {employeeFilter === 'all'
              ? `Daily Punch Records (${formatMonthLabel(selectedMonth)})`
              : `Day-by-Day Attendance: ${employees.find((e) => e.uid === employeeFilter)?.name || 'Employee'}`}
          </h3>
          {employeeFilter !== 'all' && (
            <button className="btn-ghost btn-sm" onClick={() => setEmployeeFilter('all')}>
              ← Back to All Employees
            </button>
          )}
        </div>

        {loading ? (
          <p className="subtle">Loading attendance records…</p>
        ) : employeeFilter !== 'all' ? (
          /* Single Employee Detailed Schedule Table (All working days with P or A) */
          singleEmployeeData?.schedule.length === 0 ? (
            <p className="subtle">No working days recorded for {formatMonthLabel(selectedMonth)}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                    <th>Date</th>
                    <th>Weekday</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th style={{ width: '90px' }}>Selfie</th>
                    <th>Location</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {singleEmployeeData?.schedule.map((r) => (
                    <tr key={r.id} className={r.status === 'A' ? 'row-absent' : 'row-present'}>
                      <td data-label="Status" style={{ textAlign: 'center' }}>
                        {r.status === 'P' ? (
                          <span className="status-pill-p" title="Present">P</span>
                        ) : (
                          <span className="status-pill-a" title="Absent">A</span>
                        )}
                      </td>
                      <td data-label="Date"><strong>{r.date}</strong></td>
                      <td data-label="Weekday"><span className="weekday-tag">{r.weekdayFull}</span></td>
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
                      <td data-label="Selfie">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.checkInSelfieUrl && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={r.checkInSelfieUrl}
                                alt="Check-in Selfie"
                                className="selfie-thumb-circle"
                                style={{ borderColor: '#10b981' }}
                                onClick={() => setSelectedSelfie({ url: r.checkInSelfieUrl, title: `${singleEmployeeData?.employee?.name || 'Employee'} — Check-In (${r.date})` })}
                                title="Click to zoom Check-In Selfie"
                              />
                              <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>IN</span>
                            </div>
                          )}
                          {r.checkOutSelfieUrl && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={r.checkOutSelfieUrl}
                                alt="Check-out Selfie"
                                className="selfie-thumb-circle"
                                style={{ borderColor: '#f43f5e' }}
                                onClick={() => setSelectedSelfie({ url: r.checkOutSelfieUrl, title: `${singleEmployeeData?.employee?.name || 'Employee'} — Check-Out (${r.date})` })}
                                title="Click to zoom Check-Out Selfie"
                              />
                              <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#f43f5e', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>OUT</span>
                            </div>
                          )}
                          {!r.checkInSelfieUrl && !r.checkOutSelfieUrl && (
                            <span className="selfie-empty-dash">—</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Location">
                        {r.checkInLocation ? (
                          <a
                            href={`https://maps.google.com/?q=${r.checkInLocation.lat},${r.checkInLocation.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="table-link map-link"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>Map</span>
                          </a>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>
                      <td data-label="Action" style={{ textAlign: 'right' }}>
                        {r.status === 'P' && r.id ? (
                          <button
                            type="button"
                            className="sw-btn-action-delete-sm"
                            onClick={() => handleDeleteAttendanceRecord({ id: r.id, name: singleEmployeeData?.employee?.name, date: r.date })}
                            title={`Delete attendance record on ${r.date}`}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* All Employees Punch Table */
          records.length === 0 ? (
            <p className="subtle">No attendance recorded for {formatMonthLabel(selectedMonth)}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Weekday</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th style={{ width: '90px' }}>Selfie</th>
                    <th>Location</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="row-present">
                      <td data-label="Status" style={{ textAlign: 'center' }}>
                        <span className="status-pill-p" title="Present">P</span>
                      </td>
                      <td data-label="Employee"><strong>{r.name}</strong></td>
                      <td data-label="Date">{r.date}</td>
                      <td data-label="Weekday"><span className="weekday-tag">{getWeekday(r.date, 'long')}</span></td>
                      <td data-label="Check-In">
                        <span className="time-badge in">{formatTime(r.checkInTime)}</span>
                      </td>
                      <td data-label="Check-Out">
                        {r.checkOutTime ? (
                          <span className="time-badge out">{formatTime(r.checkOutTime)}</span>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>
                      <td data-label="Selfie">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.checkInSelfieUrl && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={r.checkInSelfieUrl}
                                alt={`${r.name} check-in selfie`}
                                className="selfie-thumb-circle"
                                style={{ borderColor: '#10b981' }}
                                onClick={() => setSelectedSelfie({ url: r.checkInSelfieUrl, title: `${r.name} — Check-In (${r.date})` })}
                                title="Click to zoom Check-In Selfie"
                              />
                              <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>IN</span>
                            </div>
                          )}
                          {r.checkOutSelfieUrl && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img
                                src={r.checkOutSelfieUrl}
                                alt={`${r.name} check-out selfie`}
                                className="selfie-thumb-circle"
                                style={{ borderColor: '#f43f5e' }}
                                onClick={() => setSelectedSelfie({ url: r.checkOutSelfieUrl, title: `${r.name} — Check-Out (${r.date})` })}
                                title="Click to zoom Check-Out Selfie"
                              />
                              <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#f43f5e', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', lineHeight: 1 }}>OUT</span>
                            </div>
                          )}
                          {!r.checkInSelfieUrl && !r.checkOutSelfieUrl && (
                            <span className="selfie-empty-dash">—</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Location">
                        {r.checkInLocation ? (
                          <a
                            href={`https://maps.google.com/?q=${r.checkInLocation.lat},${r.checkInLocation.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="table-link map-link"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>Map</span>
                          </a>
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
                      </td>
                      <td data-label="Action" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="sw-btn-action-delete-sm"
                          onClick={() => handleDeleteAttendanceRecord(r)}
                          title={`Delete record of ${r.name} on ${r.date}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Selfie Preview Modal */}
      {selectedSelfie && (
        <div className="modal-overlay" onClick={() => setSelectedSelfie(null)}>
          <div className="modal-content" style={{ maxWidth: '440px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
