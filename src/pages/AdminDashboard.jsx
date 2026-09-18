import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { subscribeLeaves } from '../services/leaveService'
import NavBar from '../components/NavBar'

export default function AdminDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [records, setRecords] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSelfie, setSelectedSelfie] = useState(null)
  const [selectedDayRoster, setSelectedDayRoster] = useState(null)
  const [rosterFilter, setRosterFilter] = useState('all') // 'all' | 'present' | 'absent'
  const [rosterSearch, setRosterSearch] = useState('')
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'table'
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0)
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
    const unsubLeaves = subscribeLeaves({
      onUpdate: (list) => {
        setPendingLeavesCount(list.filter((l) => l.status === 'pending').length)
      },
      onError: () => {}
    })
    return () => unsubLeaves && unsubLeaves()
  }, [])

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

    const q = query(
      collection(db, 'attendance'),
      where('month', '==', selectedMonth)
    )

    const unsubAttendance = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        setRecords(docs)
        setLoading(false)
      },
      (err) => {
        console.error('Error in live admin attendance:', err)
        setLoading(false)
      }
    )

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

  // Extract all distinct employees
  const employees = useMemo(() => {
    const map = new Map()
    usersList.forEach((u) => map.set(u.uid, u.name || u.email?.split('@')[0] || 'Employee'))
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
        if (selectedDayRoster) {
          setSelectedDayRoster((prev) => {
            if (!prev) return null
            return {
              ...prev,
              roster: prev.roster?.map((item) => item.record?.id === r.id ? { ...item, status: 'A', record: null } : item)
            }
          })
        }
        return
      }
      await deleteDoc(doc(db, 'attendance', r.id))
      if (selectedDayRoster) {
        setSelectedDayRoster((prev) => {
          if (!prev) return null
          return {
            ...prev,
            roster: prev.roster?.map((item) => item.record?.id === r.id ? { ...item, status: 'A', record: null } : item)
          }
        })
      }
    } catch (err) {
      console.error('Error deleting attendance record:', err)
      alert('Could not delete attendance record: ' + (err.message || 'Permission denied'))
    }
  }

  // Per-employee monthly summary statistics
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
      const punchedToday = records.some((r) => r.uid === emp.uid && r.date === todayKey)
      return {
        uid: emp.uid,
        name: emp.name,
        presentCount,
        absentCount,
        fullDaysCount,
        totalWorkingDays: workingDaysCount,
        rate,
        punchedToday
      }
    })
  }, [employees, records, selectedMonth, todayKey])

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

  // Monthly Calendar Matrix Generation for Admin
  const calendarData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr) // 1-indexed

    const totalDays = new Date(year, month, 0).getDate()
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
    const startPadding = (firstDayOfWeek + 6) % 7

    const pad = (n) => String(n).padStart(2, '0')
    const days = []

    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate()
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        isPadding: true,
        dayNum: prevMonthTotalDays - i,
        key: `prev-${i}`
      })
    }

    // Color gradient presets for avatars
    const avatarGradients = [
      'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)'
    ]

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${pad(month)}-${pad(d)}`
      const dateObj = new Date(year, month - 1, d)
      const dayOfWeek = dateObj.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isToday = dateKey === todayKey
      const isFuture = dateKey > todayKey

      if (employeeFilter !== 'all') {
        // Single employee mode
        const empRecords = records.filter((r) => r.uid === employeeFilter)
        const record = empRecords.find((r) => r.date === dateKey)
        let status = 'FUTURE'
        if (isFuture) status = 'FUTURE'
        else if (record) status = 'P'
        else if (isWeekend) status = 'WEEKEND'
        else status = 'A'

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
          duration,
          employeeName: employees.find((e) => e.uid === employeeFilter)?.name || 'Employee'
        })
      } else {
        // All employees workforce mode
        const dateRecords = records.filter((r) => r.date === dateKey)
        const presentCount = dateRecords.length
        const totalEmp = employees.length
        const percent = totalEmp > 0 ? Math.round((presentCount / totalEmp) * 100) : 0

        const roster = employees.map((emp, index) => {
          const rec = dateRecords.find((r) => r.uid === emp.uid)
          const initials = emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'E'
          const bgGradient = avatarGradients[index % avatarGradients.length]
          return {
            uid: emp.uid,
            name: emp.name,
            initials,
            bgGradient,
            status: rec ? 'P' : isWeekend ? 'WEEKEND' : isFuture ? 'FUTURE' : 'A',
            record: rec || null
          }
        })

        // Present employees with initials for stack
        const presentStack = dateRecords.map((r, i) => {
          const initials = r.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'E'
          return {
            id: r.id || r.uid,
            name: r.name,
            initials,
            bgGradient: avatarGradients[i % avatarGradients.length]
          }
        })

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
          presentCount,
          totalEmployees: totalEmp,
          percent,
          presentStack,
          dateRecords,
          roster
        })
      }
    }

    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        isPadding: true,
        dayNum: i,
        key: `next-${i}`
      })
    }

    return { days, year, month, totalDays }
  }, [selectedMonth, records, todayKey, employeeFilter, employees])

  // Filtered Roster inside Day Inspection Modal
  const modalRosterList = useMemo(() => {
    if (!selectedDayRoster || !selectedDayRoster.roster) return []
    let list = selectedDayRoster.roster
    if (rosterFilter === 'present') {
      list = list.filter((item) => item.status === 'P')
    } else if (rosterFilter === 'absent') {
      list = list.filter((item) => item.status === 'A')
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase()
      list = list.filter((item) => item.name.toLowerCase().includes(q))
    }
    return list
  }, [selectedDayRoster, rosterFilter, rosterSearch])

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
            <Link
              to="/admin/leaves"
              className="sw-toggle-btn"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 0.85rem',
                color: pendingLeavesCount > 0 ? '#fbbf24' : '#38bdf8',
                borderColor: pendingLeavesCount > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.3)',
                background: pendingLeavesCount > 0 ? 'rgba(245, 158, 11, 0.12)' : undefined
              }}
              title="Workforce Leave Approvals"
            >
              <span>🌴</span>
              <span>Leaves {pendingLeavesCount > 0 ? `(${pendingLeavesCount})` : ''}</span>
            </Link>
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
          {pendingLeavesCount > 0 && (
            <Link
              to="/admin/leaves"
              className="sw-live-stat"
              style={{
                textDecoration: 'none',
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '0.2rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 600
              }}
            >
              <span>⚠️ <strong>{pendingLeavesCount}</strong> Leave Request{pendingLeavesCount === 1 ? '' : 's'} Pending ➜</span>
            </Link>
          )}
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

        {/* Modern Interactive Team Filter Avatar Dock */}
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              ⚡ Quick Filter by Team Member:
            </span>
            {employeeFilter !== 'all' && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={() => setEmployeeFilter('all')}
              >
                Reset to All Employees
              </button>
            )}
          </div>

          <div className="sw-team-avatar-dock">
            {/* All Employees Pill */}
            <button
              type="button"
              className={`sw-team-chip-btn ${employeeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setEmployeeFilter('all')}
            >
              <span className="sw-team-chip-avatar all">👥</span>
              <span>All Workforce</span>
              <span className="sw-team-chip-rate">{employees.length}</span>
            </button>

            {/* Individual Employee Pills */}
            {employeeSummaries.map((emp) => {
              const isActive = employeeFilter === emp.uid
              const initial = emp.name.charAt(0).toUpperCase()
              return (
                <button
                  key={emp.uid}
                  type="button"
                  className={`sw-team-chip-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setEmployeeFilter(isActive ? 'all' : emp.uid)}
                  title={`View ${emp.name}'s attendance calendar`}
                >
                  <span className="sw-team-chip-avatar">
                    {initial}
                    <span className={`sw-team-chip-dot ${emp.punchedToday ? 'green' : 'slate'}`} />
                  </span>
                  <span>{emp.name.split(' ')[0]}</span>
                  <span className="sw-team-chip-rate">{emp.rate}%</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Attendance Records Section Header with Calendar View / Table View Toggle */}
        <div className="sw-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {employeeFilter === 'all'
                ? `Workforce Attendance Calendar (${formatMonthLabel(selectedMonth)})`
                : `Attendance Calendar: ${employees.find((e) => e.uid === employeeFilter)?.name || 'Employee'}`}
            </h3>
            {employeeFilter !== 'all' ? (
              <button
                className="btn-ghost btn-sm"
                onClick={() => setEmployeeFilter('all')}
                style={{ marginTop: '0.35rem', padding: '2px 8px' }}
              >
                ← Back to All Employees
              </button>
            ) : (
              <p className="subtle" style={{ margin: '0.2rem 0 0' }}>
                Tap any calendar day to inspect workforce check-ins, selfies &amp; GPS logs.
              </p>
            )}
          </div>

          <div className="sw-view-toggle-bar">
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              id="admin-toggle-calendar"
            >
              📅 Visual Calendar
            </button>
            <button
              type="button"
              className={`sw-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              id="admin-toggle-table"
            >
              📋 Detailed Table
            </button>
          </div>
        </div>

        {loading ? (
          <p className="subtle">Loading attendance records…</p>
        ) : viewMode === 'calendar' ? (
          /* ================= CREATIVE ADMIN MONTHLY CALENDAR VIEW ================= */
          <div className="sw-calendar-wrapper" style={{ border: '1px solid #cbd5e1', boxShadow: '0 8px 30px -4px rgba(0, 0, 0, 0.08)' }}>
            {/* Calendar Navigation & Month Title Bar */}
            <div className="sw-calendar-nav-bar" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
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
                  <span className="sw-legend-dot present" /> High Turnout
                </span>
                <span className="sw-legend-item">
                  <span className="sw-legend-dot absent" /> Low / Zero
                </span>
                <span className="sw-legend-item">
                  <span className="sw-legend-dot weekend" /> Weekend
                </span>
                <span className="sw-legend-item">
                  <span className="sw-legend-dot today" /> Today
                </span>
              </div>
            </div>

            {/* Calendar Container */}
            <div className="sw-calendar-container">
              {/* Weekday Column Headers */}
              <div className="sw-calendar-weekdays">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                  <div key={day} className={`sw-cal-weekday-head ${idx >= 5 ? 'weekend' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="sw-calendar-grid">
                {calendarData.days.map((cell) => {
                  if (cell.isPadding) {
                    return (
                      <div key={cell.key} className="sw-cal-cell empty-pad">
                        <span className="sw-cal-pad-number">{cell.dayNum}</span>
                      </div>
                    )
                  }

                  const isSingleEmp = employeeFilter !== 'all'
                  const isToday = cell.isToday
                  const isFuture = cell.isFuture
                  const isWeekend = cell.isWeekend

                  if (isSingleEmp) {
                    // Single Employee Calendar Cell
                    const isPresent = cell.status === 'P'
                    const isAbsent = cell.status === 'A'

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
                          if (!isFuture) setSelectedDayRoster({ ...cell, isSingle: true })
                        }}
                        title={isFuture ? 'Upcoming day' : 'Click to inspect/manage attendance punch'}
                      >
                        <div className="sw-cal-cell-header">
                          <span className={`sw-cal-day-num ${isToday ? 'today-active' : ''}`}>
                            {cell.dayNum}
                          </span>
                          {isToday && <span className="sw-cal-today-chip">TODAY</span>}
                        </div>

                        <div className="sw-cal-cell-content">
                          {isPresent && (
                            <div className="sw-cal-punch-info">
                              <span className="sw-cal-status-pill present">✓ Present</span>
                              <div className="sw-cal-times">
                                <span className="in">IN: {cell.record?.checkInTime ? formatTime(cell.record.checkInTime) : '—'}</span>
                                {cell.record?.checkOutTime ? (
                                  <span className="out">OUT: {formatTime(cell.record.checkOutTime)}</span>
                                ) : (
                                  <span className="in-progress">In Shift</span>
                                )}
                              </div>
                              {cell.duration && (
                                <span className="sw-cal-duration-chip">⏱️ {cell.duration}</span>
                              )}
                            </div>
                          )}

                          {isAbsent && (
                            <div className="sw-cal-absent-info">
                              <span className="sw-cal-status-pill absent">✕ Absent</span>
                              <span className="sw-cal-missed-label">Unrecorded</span>
                            </div>
                          )}

                          {isWeekend && !cell.record && (
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

                        {cell.record && (cell.record.checkInSelfieUrl || cell.record.checkOutSelfieUrl) && (
                          <div className="sw-cal-selfie-dots">
                            {cell.record.checkInSelfieUrl && (
                              <span
                                className="sw-cal-selfie-dot in"
                                title="Check-In Selfie"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSelfie({ url: cell.record.checkInSelfieUrl, title: `${cell.employeeName} — Check-In (${cell.dateKey})` })
                                }}
                              >
                                📸 IN
                              </span>
                            )}
                            {cell.record.checkOutSelfieUrl && (
                              <span
                                className="sw-cal-selfie-dot out"
                                title="Check-Out Selfie"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSelfie({ url: cell.record.checkOutSelfieUrl, title: `${cell.employeeName} — Check-Out (${cell.dateKey})` })
                                }}
                              >
                                OUT
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // All Employees Workforce Mode Day Cell
                  const hasPunches = (cell.presentCount || 0) > 0
                  const percent = cell.percent || 0
                  const turnoutClass = percent >= 80 ? 'optimal' : percent >= 40 ? 'partial' : percent > 0 ? 'low' : 'none'

                  return (
                    <div
                      key={cell.key}
                      className={`sw-cal-cell ${
                        hasPunches
                          ? 'cell-present'
                          : isWeekend
                          ? 'cell-weekend'
                          : isFuture
                          ? 'cell-future'
                          : 'cell-absent'
                      } ${isToday ? 'cell-today' : ''}`}
                      onClick={() => {
                        if (!isFuture) {
                          setRosterFilter('all')
                          setRosterSearch('')
                          setSelectedDayRoster({ ...cell, isSingle: false })
                        }
                      }}
                      title={isFuture ? 'Upcoming day' : 'Click to inspect workforce roster for this date'}
                    >
                      {/* Cell Header: Day Number + TODAY badge */}
                      <div className="sw-cal-cell-header">
                        <span className={`sw-cal-day-num ${isToday ? 'today-active' : ''}`}>
                          {cell.dayNum}
                        </span>
                        {isToday && <span className="sw-cal-today-chip">TODAY</span>}
                      </div>

                      {/* Cell Content: Turnout Bar, Pill & Stacked Avatars */}
                      <div className="sw-cal-cell-content">
                        {!isFuture && !isWeekend && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {/* Turnout Pill */}
                            <span className={`sw-cal-turnout-pill ${turnoutClass}`}>
                              {hasPunches ? `⚡ ${cell.presentCount}/${cell.totalEmployees} Present` : '✕ 0 Present'}
                            </span>

                            {/* Mini Turnout Progress Fill Bar */}
                            <div className="sw-cal-bar-track">
                              <div
                                className={`sw-cal-bar-fill ${percent < 40 ? 'danger' : percent < 80 ? 'warning' : ''}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            {/* Overlapping Avatars Stack */}
                            {cell.presentStack && cell.presentStack.length > 0 && (
                              <div className="sw-avatar-stack" title={`${cell.presentCount} employees punched in`}>
                                {cell.presentStack.slice(0, 3).map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="sw-avatar-bubble"
                                    style={{ background: emp.bgGradient }}
                                    title={emp.name}
                                  >
                                    {emp.initials}
                                  </div>
                                ))}
                                {cell.presentStack.length > 3 && (
                                  <div className="sw-avatar-bubble more" title={`${cell.presentStack.length - 3} more employees`}>
                                    +{cell.presentStack.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {isWeekend && (
                          hasPunches ? (
                            <div>
                              <span className="sw-cal-turnout-pill optimal">
                                🟢 {cell.presentCount} Overtime
                              </span>
                              <div className="sw-avatar-stack" style={{ marginTop: '4px' }}>
                                {cell.presentStack.slice(0, 3).map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="sw-avatar-bubble"
                                    style={{ background: emp.bgGradient }}
                                    title={emp.name}
                                  >
                                    {emp.initials}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="sw-cal-weekend-info">
                              <span className="sw-cal-weekend-pill">Weekend Off</span>
                            </div>
                          )
                        )}

                        {isFuture && (
                          <div className="sw-cal-future-info">
                            <span className="sw-cal-future-dash">—</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW 2: TABLE VIEW ================= */
          employeeFilter !== 'all' ? (
            /* Single Employee Detailed Schedule Table */
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
          )
        )}
      </div>

      {/* Modern Interactive Day Roster & Inspection Modal */}
      {selectedDayRoster && (
        <div className="modal-overlay" onClick={() => setSelectedDayRoster(null)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="sw-inspect-weekday">{selectedDayRoster.weekdayFull}</span>
                <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem' }}>{selectedDayRoster.dateKey}</h2>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedDayRoster(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {selectedDayRoster.isSingle ? (
                /* Single Employee Day Inspection */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span className={`sw-inspect-status-badge ${selectedDayRoster.status === 'P' ? 'present' : selectedDayRoster.status === 'A' ? 'absent' : 'weekend'}`}>
                      {selectedDayRoster.status === 'P' ? '✓ Verified Present' : selectedDayRoster.status === 'A' ? '✕ Absent (Unrecorded)' : '🏖️ Weekend'}
                    </span>
                    {selectedDayRoster.duration && (
                      <span className="sw-shift-hours-badge">⏱️ {selectedDayRoster.duration}</span>
                    )}
                  </div>

                  {selectedDayRoster.record ? (
                    <div className="sw-inspect-grid">
                      {/* In Punch */}
                      <div className="sw-inspect-punch-card in">
                        <div className="sw-inspect-card-top">
                          <span className="sw-punch-tag in">CHECK IN</span>
                          <strong className="sw-punch-time">
                            {formatTime(selectedDayRoster.record.checkInTime)}
                          </strong>
                        </div>
                        {selectedDayRoster.record.checkInSelfieUrl ? (
                          <div
                            className="sw-inspect-selfie-preview"
                            onClick={() => setSelectedSelfie({ url: selectedDayRoster.record.checkInSelfieUrl, title: `${selectedDayRoster.employeeName} — Check-In (${selectedDayRoster.dateKey})` })}
                          >
                            <img src={selectedDayRoster.record.checkInSelfieUrl} alt="In Selfie" />
                            <span className="sw-selfie-zoom-hint">🔍 Tap to Zoom</span>
                          </div>
                        ) : (
                          <div className="sw-inspect-no-selfie">No selfie image</div>
                        )}
                        <span className="sw-inspect-geo">📍 Biometric &amp; GPS Verified</span>
                      </div>

                      {/* Out Punch */}
                      <div className="sw-inspect-punch-card out">
                        <div className="sw-inspect-card-top">
                          <span className="sw-punch-tag out">CHECK OUT</span>
                          <strong className="sw-punch-time">
                            {selectedDayRoster.record.checkOutTime ? formatTime(selectedDayRoster.record.checkOutTime) : 'Pending Out Punch'}
                          </strong>
                        </div>
                        {selectedDayRoster.record.checkOutSelfieUrl ? (
                          <div
                            className="sw-inspect-selfie-preview"
                            onClick={() => setSelectedSelfie({ url: selectedDayRoster.record.checkOutSelfieUrl, title: `${selectedDayRoster.employeeName} — Check-Out (${selectedDayRoster.dateKey})` })}
                          >
                            <img src={selectedDayRoster.record.checkOutSelfieUrl} alt="Out Selfie" />
                            <span className="sw-selfie-zoom-hint">🔍 Tap to Zoom</span>
                          </div>
                        ) : (
                          <div className="sw-inspect-no-selfie">
                            {selectedDayRoster.record.checkOutTime ? 'No selfie image' : 'Shift still open'}
                          </div>
                        )}
                        <span className="sw-inspect-geo">
                          {selectedDayRoster.record.checkOutTime ? '📍 Biometric & GPS Verified' : '⏳ Awaiting checkout punch'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="sw-inspect-absent-card">
                      <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>✕</div>
                      <h4 style={{ margin: '0 0 0.35rem', color: '#991b1b' }}>Absent on this day</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#7f1d1d' }}>
                        No biometric punch recorded for {selectedDayRoster.employeeName}.
                      </p>
                    </div>
                  )}

                  {selectedDayRoster.record?.id && (
                    <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => handleDeleteAttendanceRecord({ id: selectedDayRoster.record.id, name: selectedDayRoster.employeeName, date: selectedDayRoster.dateKey })}
                      >
                        🗑️ Delete Attendance Punch
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* All Employees Daily Workforce Roster with Search and Filters */
                <div>
                  {/* Hero Stats Card */}
                  <div className="sw-admin-roster-hero">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 800 }}>
                          Workforce Attendance Turnout
                        </span>
                        <h3 style={{ margin: '0.2rem 0 0', color: '#ffffff', fontSize: '1.35rem' }}>
                          {selectedDayRoster.presentCount} / {selectedDayRoster.totalEmployees} Employees On-Duty
                        </h3>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.6rem', fontWeight: 900, color: selectedDayRoster.percent >= 80 ? '#34d399' : '#fbbf24' }}>
                          {selectedDayRoster.percent}%
                        </span>
                      </div>
                    </div>

                    <div className="sw-cal-bar-track" style={{ height: '6px', background: 'rgba(255,255,255,0.15)', marginTop: '8px' }}>
                      <div className="sw-cal-bar-fill" style={{ width: `${selectedDayRoster.percent}%` }} />
                    </div>
                  </div>

                  {/* Sub-filter tabs & Search input */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.85rem' }}>
                    <div className="sw-roster-filter-pills">
                      <button
                        type="button"
                        className={`sw-roster-sub-filter-btn ${rosterFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setRosterFilter('all')}
                      >
                        All Team ({selectedDayRoster.totalEmployees})
                      </button>
                      <button
                        type="button"
                        className={`sw-roster-sub-filter-btn ${rosterFilter === 'present' ? 'active' : ''}`}
                        onClick={() => setRosterFilter('present')}
                      >
                        ✓ Present ({selectedDayRoster.presentCount})
                      </button>
                      <button
                        type="button"
                        className={`sw-roster-sub-filter-btn ${rosterFilter === 'absent' ? 'active' : ''}`}
                        onClick={() => setRosterFilter('absent')}
                      >
                        ✕ Absent ({selectedDayRoster.totalEmployees - selectedDayRoster.presentCount})
                      </button>
                    </div>

                    <div style={{ width: '180px' }}>
                      <input
                        type="text"
                        placeholder="Search employee…"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        className="sw-input"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>

                  {/* Roster Cards List */}
                  <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                    {modalRosterList.length === 0 ? (
                      <p className="subtle" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                        No employees found matching filter.
                      </p>
                    ) : (
                      modalRosterList.map((item) => (
                        <div
                          key={item.uid}
                          className={`sw-roster-employee-card ${item.status === 'P' ? 'present' : 'absent'}`}
                        >
                          <div className="sw-roster-emp-left">
                            <div className="sw-roster-emp-avatar" style={{ background: item.bgGradient }}>
                              {item.initials}
                            </div>
                            <div className="sw-roster-emp-meta">
                              <span className="sw-roster-emp-name">{item.name}</span>
                              <span className={`sw-roster-emp-status ${item.status === 'P' ? 'present' : 'absent'}`}>
                                {item.status === 'P' ? '✓ Verified Present' : '✕ Absent (Unrecorded)'}
                              </span>
                            </div>
                          </div>

                          {item.status === 'P' && item.record ? (
                            <div className="sw-roster-punch-strip">
                              <div className="sw-roster-punch-chip">
                                <span>IN TIME</span>
                                <strong>{formatTime(item.record.checkInTime)}</strong>
                              </div>
                              <div className="sw-roster-punch-chip">
                                <span>OUT TIME</span>
                                <strong>{item.record.checkOutTime ? formatTime(item.record.checkOutTime) : 'In Shift'}</strong>
                              </div>

                              {/* Selfies Mini Circle */}
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                {item.record.checkInSelfieUrl && (
                                  <img
                                    src={item.record.checkInSelfieUrl}
                                    alt="In Selfie"
                                    className="selfie-thumb-circle"
                                    style={{ borderColor: '#10b981', cursor: 'pointer', width: '30px', height: '30px' }}
                                    onClick={() => setSelectedSelfie({ url: item.record.checkInSelfieUrl, title: `${item.name} — In (${selectedDayRoster.dateKey})` })}
                                    title="Click to zoom In Selfie"
                                  />
                                )}
                                {item.record.checkOutSelfieUrl && (
                                  <img
                                    src={item.record.checkOutSelfieUrl}
                                    alt="Out Selfie"
                                    className="selfie-thumb-circle"
                                    style={{ borderColor: '#f43f5e', cursor: 'pointer', width: '30px', height: '30px' }}
                                    onClick={() => setSelectedSelfie({ url: item.record.checkOutSelfieUrl, title: `${item.name} — Out (${selectedDayRoster.dateKey})` })}
                                    title="Click to zoom Out Selfie"
                                  />
                                )}
                              </div>

                              {/* Location map link */}
                              {item.record.checkInLocation && (
                                <a
                                  href={`https://maps.google.com/?q=${item.record.checkInLocation.lat},${item.record.checkInLocation.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="table-link map-link"
                                  title="View GPS Pin"
                                >
                                  📍 Map
                                </a>
                              )}

                              {/* Delete Action Button */}
                              <button
                                type="button"
                                className="sw-btn-action-delete-sm"
                                onClick={() => handleDeleteAttendanceRecord(item.record)}
                                title="Delete attendance punch"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              No Punch Logged
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedDayRoster(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
