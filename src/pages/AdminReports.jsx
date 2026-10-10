import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import {
  todayDateKey,
  monthKey,
  formatMonthLabel,
  formatTime,
  getAvailableMonthKeys,
  getAvailableYearKeys,
  getAvailableWeeks,
  calcWorkDurationMinutes,
  formatDurationMinutes,
  checkPunctuality,
  getWeekday,
  getHoliday,
  COMPANY_START_DATE,
  COMPANY_START_MONTH
} from '../utils/dateHelpers'
import { mockGetAttendanceList, getStoredUsers } from '../mockService'
import { seedDemoDataToFirestore } from '../services/seedService'
import NavBar from '../components/NavBar'

export default function AdminReports() {
  // Timeframe state: 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [timeframe, setTimeframe] = useState('weekly')

  // Available options
  const weekOptions = useMemo(() => getAvailableWeeks(12), [])
  const monthOptions = useMemo(() => getAvailableMonthKeys(), [])
  const yearOptions = useMemo(() => getAvailableYearKeys(), [])

  // Selected period values
  const [selectedWeekKey, setSelectedWeekKey] = useState(weekOptions[0]?.key || '')
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [selectedYear, setSelectedYear] = useState(yearOptions[0] || '2026')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return todayDateKey(d)
  })
  const [customEnd, setCustomEnd] = useState(todayDateKey())

  // Data state
  const [allAttendance, setAllAttendance] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [seedingStatus, setSeedingStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [seedingMsg, setSeedingMsg] = useState('')

  // View state
  const [activeReportTab, setActiveReportTab] = useState('members') // 'members' | 'punches'
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPunctuality, setFilterPunctuality] = useState('all') // 'all' | 'ontime' | 'late' | 'active'
  const [sortBy, setSortBy] = useState('hours-desc') // 'hours-desc' | 'hours-asc' | 'name' | 'rate'
  const [selectedMemberModal, setSelectedMemberModal] = useState(null)
  const [selectedSelfiePreview, setSelectedSelfiePreview] = useState(null)

  // Standard workday baseline in minutes (8 hours)
  const STANDARD_WORKDAY_MINUTES = 8 * 60

  // Determine current active date range [startDate, endDate]
  const dateRange = useMemo(() => {
    if (timeframe === 'weekly') {
      const w = weekOptions.find((item) => item.key === selectedWeekKey) || weekOptions[0]
      return {
        startDate: w?.start || todayDateKey(),
        endDate: w?.end || todayDateKey(),
        label: w?.label || 'Selected Week'
      }
    }
    if (timeframe === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const pad = (n) => String(n).padStart(2, '0')
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay)}`,
        label: formatMonthLabel(selectedMonth)
      }
    }
    if (timeframe === 'yearly') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        label: `Year ${selectedYear}`
      }
    }
    // Custom range
    return {
      startDate: customStart || '2026-08-07',
      endDate: customEnd || todayDateKey(),
      label: `${customStart} to ${customEnd}`
    }
  }, [timeframe, selectedWeekKey, selectedMonth, selectedYear, customStart, customEnd, weekOptions])

  // Real-time synchronization
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    if (!isFirebaseConfigured || !db) {
      // Demo / Mock Mode
      const stored = mockGetAttendanceList({})
      setAllAttendance(stored)
      const rawUsers = getStoredUsers().filter((u) => u.role !== 'admin')
      setUsersList(rawUsers)
      setLoading(false)
      return
    }

    // Live Firebase Listener
    const qAtt = query(collection(db, 'attendance'))
    const unsubAtt = onSnapshot(
      qAtt,
      (snap) => {
        if (cancelled) return
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (docs.length === 0) {
          // If Firestore attendance has no documents yet, load realistic demo records!
          const stored = mockGetAttendanceList({})
          setAllAttendance(stored)
        } else {
          setAllAttendance(docs)
        }
        setLoading(false)
      },
      (err) => {
        console.warn('Live attendance note, using sample demo records:', err)
        const stored = mockGetAttendanceList({})
        setAllAttendance(stored)
        setLoading(false)
      }
    )

    const qUsers = query(collection(db, 'users'))
    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        if (cancelled) return
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => (u.role || '').toLowerCase() !== 'admin')
        if (list.length === 0) {
          // If users list is empty in Firestore, use demo team members
          setUsersList(getStoredUsers().filter((u) => u.role !== 'admin'))
        } else {
          setUsersList(list)
        }
      },
      (err) => {
        console.warn('Users sync note, using demo users:', err)
        setUsersList(getStoredUsers().filter((u) => u.role !== 'admin'))
      }
    )

    return () => {
      cancelled = true
      unsubAtt()
      unsubUsers()
    }
  }, [])

  // Filter attendance records falling within the selected dateRange
  const periodRecords = useMemo(() => {
    const { startDate, endDate } = dateRange
    return allAttendance.filter((r) => {
      const d = r.date || ''
      return d >= startDate && d <= endDate
    })
  }, [allAttendance, dateRange])

  // Distinct employees directory
  const employees = useMemo(() => {
    const map = new Map()
    usersList.forEach((u) => {
      map.set(u.uid, {
        uid: u.uid,
        name: u.name || u.displayName || u.email?.split('@')[0] || 'Employee',
        email: u.email || '—',
        phone: u.phone || u.phoneNumber || '—',
        role: u.role || 'employee',
        photoURL: u.photoURL || null,
        department: u.department || 'Operations & Engineering',
        joinDate: u.joinDate || u.startDate || COMPANY_START_DATE,
        status: u.status || 'active'
      })
    })
    periodRecords.forEach((r) => {
      if (r.uid && !map.has(r.uid)) {
        map.set(r.uid, {
          uid: r.uid,
          name: r.name || r.userName || 'Employee',
          email: r.email || r.userEmail || '—',
          phone: '—',
          role: 'employee',
          photoURL: r.checkInSelfieUrl || null,
          department: 'General Staff',
          joinDate: COMPANY_START_DATE,
          status: 'active'
        })
      }
    })
    return Array.from(map.values())
  }, [usersList, periodRecords])

  // Per-employee analytics in current timeframe
  const memberReportSummaries = useMemo(() => {
    const today = todayDateKey()

    return employees.map((emp) => {
      const empRecords = periodRecords.filter((r) => r.uid === emp.uid)
      let totalMinutes = 0
      let fullDaysCount = 0
      let onTimePunchesCount = 0
      let latePunchesCount = 0
      let overtimeMinutes = 0
      let deficitMinutes = 0

      // Sort records ascending by date
      empRecords.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

      empRecords.forEach((r) => {
        const isToday = r.date === today
        const durationMin = calcWorkDurationMinutes(r.checkInTime, r.checkOutTime, isToday)
        totalMinutes += durationMin

        if (r.checkOutTime) {
          fullDaysCount++
          if (durationMin > STANDARD_WORKDAY_MINUTES) {
            overtimeMinutes += (durationMin - STANDARD_WORKDAY_MINUTES)
          } else if (durationMin < STANDARD_WORKDAY_MINUTES) {
            deficitMinutes += (STANDARD_WORKDAY_MINUTES - durationMin)
          }
        }

        if (r.checkInTime) {
          const p = checkPunctuality(r.checkInTime, 10, 0)
          if (p.isLate) latePunchesCount++
          else onTimePunchesCount++
        }
      })

      const presentCount = empRecords.length
      const avgMinutesPerDay = presentCount > 0 ? Math.round(totalMinutes / presentCount) : 0
      const totalPunches = onTimePunchesCount + latePunchesCount
      const punctualityRate = totalPunches > 0 ? Math.round((onTimePunchesCount / totalPunches) * 100) : 100

      // Net overtime/deficit:
      const netOtMinutes = overtimeMinutes - deficitMinutes

      // Latest record
      const latestRecord = empRecords[empRecords.length - 1] || null

      return {
        ...emp,
        records: empRecords,
        presentCount,
        fullDaysCount,
        totalMinutes,
        totalHoursFormatted: formatDurationMinutes(totalMinutes),
        avgMinutesPerDay,
        avgHoursFormatted: formatDurationMinutes(avgMinutesPerDay),
        onTimePunchesCount,
        latePunchesCount,
        punctualityRate,
        overtimeMinutes,
        deficitMinutes,
        netOtMinutes,
        latestRecord
      }
    })
  }, [employees, periodRecords, STANDARD_WORKDAY_MINUTES])

  // Filter and sort members list
  const filteredMemberSummaries = useMemo(() => {
    let list = memberReportSummaries

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.department && m.department.toLowerCase().includes(q))
      )
    }

    if (filterPunctuality === 'ontime') {
      list = list.filter((m) => m.punctualityRate >= 90)
    } else if (filterPunctuality === 'late') {
      list = list.filter((m) => m.latePunchesCount > 0)
    } else if (filterPunctuality === 'active') {
      list = list.filter((m) => m.latestRecord && !m.latestRecord.checkOutTime)
    }

    list = [...list].sort((a, b) => {
      if (sortBy === 'hours-desc') return b.totalMinutes - a.totalMinutes
      if (sortBy === 'hours-asc') return a.totalMinutes - b.totalMinutes
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'rate') return b.punctualityRate - a.punctualityRate
      return 0
    })

    return list
  }, [memberReportSummaries, searchQuery, filterPunctuality, sortBy])

  // Chronological punch records with enriched details ("Kaun Kab Aaya")
  const enrichedPunchFeed = useMemo(() => {
    const today = todayDateKey()

    const list = periodRecords.map((r) => {
      const selfie = r.checkInSelfieUrl || r.checkInPhotoUrl || r.photoUrl || null
      const emp = employees.find((e) => e.uid === r.uid) || {
        name: r.name || 'Employee',
        email: r.email || '—',
        photoURL: selfie
      }
      const isToday = r.date === today
      const durationMin = calcWorkDurationMinutes(r.checkInTime, r.checkOutTime, isToday)
      const punctuality = checkPunctuality(r.checkInTime, 10, 0)
      const isOvertime = durationMin > STANDARD_WORKDAY_MINUTES
      const diffOtMin = durationMin - STANDARD_WORKDAY_MINUTES

      return {
        ...r,
        employeeName: emp.name,
        employeeEmail: emp.email,
        employeePhoto: emp.photoURL || r.checkInSelfieUrl,
        durationMin,
        durationFormatted: formatDurationMinutes(durationMin),
        punctuality,
        isOvertime,
        diffOtFormatted: diffOtMin > 0 ? `+${formatDurationMinutes(diffOtMin)}` : `-${formatDurationMinutes(Math.abs(diffOtMin))}`,
        isCompleted: Boolean(r.checkOutTime),
        isActiveShift: Boolean(!r.checkOutTime && isToday)
      }
    })

    // Sort by date desc, then by check-in time desc
    list.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '')
      if (cmpDate !== 0) return cmpDate
      const tA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0
      const tB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0
      return tB - tA
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return list.filter((r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeEmail.toLowerCase().includes(q) ||
        (r.date && r.date.includes(q))
      )
    }

    if (filterPunctuality === 'ontime') {
      return list.filter((r) => !r.punctuality.isLate)
    } else if (filterPunctuality === 'late') {
      return list.filter((r) => r.punctuality.isLate)
    } else if (filterPunctuality === 'active') {
      return list.filter((r) => r.isActiveShift)
    }

    return list
  }, [periodRecords, employees, searchQuery, filterPunctuality, STANDARD_WORKDAY_MINUTES])

  // Overall Period Aggregates for Executive KPI Cards
  const totalPeriodMinutes = useMemo(() => {
    return memberReportSummaries.reduce((acc, m) => acc + m.totalMinutes, 0)
  }, [memberReportSummaries])

  const totalPeriodPunches = useMemo(() => {
    return periodRecords.length
  }, [periodRecords])

  const avgPeriodPunctuality = useMemo(() => {
    if (memberReportSummaries.length === 0) return 0
    const sum = memberReportSummaries.reduce((acc, m) => acc + m.punctualityRate, 0)
    return Math.round(sum / memberReportSummaries.length)
  }, [memberReportSummaries])

  const totalPeriodOvertimeMinutes = useMemo(() => {
    return memberReportSummaries.reduce((acc, m) => acc + Math.max(0, m.overtimeMinutes), 0)
  }, [memberReportSummaries])

  // Export Full Workforce Report as CSV
  function handleExportCSV() {
    if (memberReportSummaries.length === 0) {
      alert('No attendance data available to export for this period.')
      return
    }

    const headers = [
      'Employee Name',
      'Work Email',
      'Period',
      'Days Present',
      'Total Work Hours Logged',
      'Average Daily Hours',
      'Punctuality On-Time Rate',
      'Late Check-in Count',
      'Department'
    ]

    const rows = memberReportSummaries.map((m) => [
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.email}"`,
      `"${dateRange.label}"`,
      m.presentCount,
      `"${m.totalHoursFormatted}"`,
      `"${m.avgHoursFormatted}"`,
      `"${m.punctualityRate}%"`,
      m.latePunchesCount,
      `"${m.department || 'Operations'}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Workforce_Report_${timeframe}_${dateRange.startDate}_to_${dateRange.endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Single Member Report as CSV
  function handleExportMemberCSV(member) {
    if (!member || !member.records || member.records.length === 0) {
      alert('No logs recorded for this member in this period.')
      return
    }

    const headers = ['Date', 'Weekday', 'Check-In Time', 'Punctuality Status', 'Check-Out Time', 'Hours Worked', 'Overtime vs 8h']
    const rows = member.records.map((r) => {
      const dMin = calcWorkDurationMinutes(r.checkInTime, r.checkOutTime)
      const p = checkPunctuality(r.checkInTime)
      const diff = dMin - STANDARD_WORKDAY_MINUTES
      const otText = diff > 0 ? `+${formatDurationMinutes(diff)} OT` : (diff < 0 ? `-${formatDurationMinutes(Math.abs(diff))}` : 'Standard')
      return [
        r.date,
        getWeekday(r.date, 'long'),
        r.checkInTime ? formatTime(r.checkInTime) : '—',
        p.isLate ? `Late (+${p.diffMinutes}m)` : 'On Time',
        r.checkOutTime ? formatTime(r.checkOutTime) : 'Shift Active',
        formatDurationMinutes(dMin),
        otText
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${member.name.replace(/\s+/g, '_')}_Attendance_Report_${dateRange.startDate}_to_${dateRange.endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Trigger Print / PDF Dialog
  function handlePrintReport() {
    window.print()
  }

  // Seed / Sync Demo Data to Live Database
  async function handleSeedDemoData() {
    setSeedingStatus('loading')
    setSeedingMsg('Populating 8 team members & 350+ realistic attendance records...')
    try {
      const res = await seedDemoDataToFirestore()
      setSeedingStatus('success')
      setSeedingMsg(res.message || 'Demo data loaded successfully!')
      setTimeout(() => {
        setSeedingStatus(null)
      }, 4000)
    } catch (err) {
      setSeedingStatus('error')
      setSeedingMsg('Notice: ' + (err.message || 'Could not write to live database'))
      setTimeout(() => {
        setSeedingStatus(null)
      }, 4000)
    }
  }

  return (
    <div className="page sw-reports-page">
      <NavBar />

      <div className="page-body">
        {/* Top Header & Executive Action Hub */}
        <div className="sw-reports-hero-card">
          <div className="sw-reports-hero-content">
            <div className="sw-hero-tag">
              <span className="sw-hero-tag-icon">📊</span>
              <span>Workforce Analytics &amp; Hours Audit</span>
            </div>
            <h1 className="sw-reports-title">Attendance &amp; Work Hours Reports</h1>
            <p className="sw-reports-subtitle">
              Detailed tracking of arrival times, total hours worked, overtime logs, and comprehensive member profiles.
            </p>
          </div>

          <div className="sw-reports-action-strip">
            <button
              type="button"
              className="sw-rep-action-btn secondary"
              style={{
                background: 'rgba(99, 102, 241, 0.18)',
                borderColor: 'rgba(99, 102, 241, 0.45)',
                color: '#c7d2fe'
              }}
              onClick={handleSeedDemoData}
              disabled={seedingStatus === 'loading'}
              title="Populate or sync realistic sample records (Aug - Oct 2026) for testing"
            >
              <span>{seedingStatus === 'loading' ? '⏳ Syncing…' : '✨ Load Demo Data'}</span>
            </button>

            <button
              type="button"
              className="sw-rep-action-btn primary"
              onClick={handleExportCSV}
              title="Download entire workforce report as CSV"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="sw-rep-action-btn secondary"
              onClick={handlePrintReport}
              title="Print report or save to PDF"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
              <span>Print / PDF</span>
            </button>

            <Link to="/admin" className="sw-rep-action-btn ghost" title="Return to Live Attendance Dashboard">
              <span>← Live View</span>
            </Link>
          </div>
        </div>

        {/* Seeding Feedback Notification Toast */}
        {seedingStatus && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: seedingStatus === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: seedingStatus === 'error' ? '#ef4444' : '#10b981',
              border: `1px solid ${seedingStatus === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
            }}
          >
            <span>{seedingStatus === 'error' ? '⚠️' : '✅'}</span>
            <span>{seedingMsg}</span>
          </div>
        )}

        {/* ================= TIMEFRAME SELECTOR CONTROL PANEL ================= */}
        <div className="sw-period-control-panel">
          <div className="sw-period-tabs">
            <button
              type="button"
              className={`sw-period-tab-btn ${timeframe === 'weekly' ? 'active' : ''}`}
              onClick={() => setTimeframe('weekly')}
            >
              <span>🗓️ Weekly</span>
            </button>
            <button
              type="button"
              className={`sw-period-tab-btn ${timeframe === 'monthly' ? 'active' : ''}`}
              onClick={() => setTimeframe('monthly')}
            >
              <span>📅 Monthly</span>
            </button>
            <button
              type="button"
              className={`sw-period-tab-btn ${timeframe === 'yearly' ? 'active' : ''}`}
              onClick={() => setTimeframe('yearly')}
            >
              <span>📈 Yearly</span>
            </button>
            <button
              type="button"
              className={`sw-period-tab-btn ${timeframe === 'custom' ? 'active' : ''}`}
              onClick={() => setTimeframe('custom')}
            >
              <span>⏱️ Custom Range</span>
            </button>
          </div>

          <div className="sw-period-selector-box">
            {timeframe === 'weekly' && (
              <div className="sw-period-selector-row">
                <label className="sw-period-label">Select Week:</label>
                <select
                  value={selectedWeekKey}
                  onChange={(e) => setSelectedWeekKey(e.target.value)}
                  className="sw-period-select"
                >
                  {weekOptions.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <span className="sw-range-badge">
                  {dateRange.startDate} ➜ {dateRange.endDate}
                </span>
              </div>
            )}

            {timeframe === 'monthly' && (
              <div className="sw-period-selector-row">
                <label className="sw-period-label">Select Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="sw-period-select"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
                <span className="sw-range-badge">
                  {dateRange.startDate} ➜ {dateRange.endDate}
                </span>
              </div>
            )}

            {timeframe === 'yearly' && (
              <div className="sw-period-selector-row">
                <label className="sw-period-label">Select Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="sw-period-select"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      Calendar Year {y}
                    </option>
                  ))}
                </select>
                <span className="sw-range-badge">Jan 1, {selectedYear} - Dec 31, {selectedYear}</span>
              </div>
            )}

            {timeframe === 'custom' && (
              <div className="sw-period-selector-row wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="sw-period-label">From:</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="sw-date-input"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="sw-period-label">To:</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="sw-date-input"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() - 7)
                      setCustomStart(todayDateKey(d))
                      setCustomEnd(todayDateKey())
                    }}
                  >
                    Last 7D
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() - 30)
                      setCustomStart(todayDateKey(d))
                      setCustomEnd(todayDateKey())
                    }}
                  >
                    Last 30D
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= EXECUTIVE KPI SUMMARY CARDS ================= */}
        <div className="sw-reports-kpi-grid">
          {/* Total Workforce Hours Card */}
          <div className="sw-kpi-card purple">
            <div className="sw-kpi-top">
              <span className="sw-kpi-icon-wrap purple">⏱️</span>
              <span className="sw-kpi-pill purple">{dateRange.label}</span>
            </div>
            <div className="sw-kpi-value">{formatDurationMinutes(totalPeriodMinutes)}</div>
            <div className="sw-kpi-label">Total Work Hours Logged</div>
            <div className="sw-kpi-sub">
              Accumulated work time across {employees.length} monitored staff
            </div>
          </div>

          {/* Average Daily Work Hours Card */}
          <div className="sw-kpi-card blue">
            <div className="sw-kpi-top">
              <span className="sw-kpi-icon-wrap blue">⚡</span>
              <span className="sw-kpi-pill blue">Benchmark: 8h</span>
            </div>
            <div className="sw-kpi-value">
              {totalPeriodPunches > 0
                ? formatDurationMinutes(Math.round(totalPeriodMinutes / totalPeriodPunches))
                : '0h 0m'}
            </div>
            <div className="sw-kpi-label">Avg Daily Work Duration</div>
            <div className="sw-kpi-sub">
              Per present shift ({totalPeriodPunches} total shift logs)
            </div>
          </div>

          {/* Punctuality / On-Time Rate Card */}
          <div className="sw-kpi-card green">
            <div className="sw-kpi-top">
              <span className="sw-kpi-icon-wrap green">🎯</span>
              <span className="sw-kpi-pill green">Before 10:00 AM</span>
            </div>
            <div className="sw-kpi-value">{avgPeriodPunctuality}%</div>
            <div className="sw-kpi-label">On-Time Arrival Rate</div>
            <div className="sw-kpi-sub">
              Workforce punctuality across selected timeframe
            </div>
          </div>

          {/* Overtime Accrued Card */}
          <div className="sw-kpi-card amber">
            <div className="sw-kpi-top">
              <span className="sw-kpi-icon-wrap amber">🚀</span>
              <span className="sw-kpi-pill amber">&gt; 8h Standard</span>
            </div>
            <div className="sw-kpi-value">+{formatDurationMinutes(totalPeriodOvertimeMinutes)}</div>
            <div className="sw-kpi-label">Total Overtime Logged</div>
            <div className="sw-kpi-sub">Additional hours beyond 8-hour workday</div>
          </div>
        </div>

        {/* ================= REPORT SUB-VIEWS & SEARCH BAR ================= */}
        <div className="sw-reports-view-header">
          <div className="sw-reports-subtab-group">
            <button
              type="button"
              className={`sw-subtab-btn ${activeReportTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveReportTab('members')}
            >
              <span>👥 Member Summary &amp; Profiles</span>
              <span className="sw-subtab-count">{filteredMemberSummaries.length}</span>
            </button>
            <button
              type="button"
              className={`sw-subtab-btn ${activeReportTab === 'punches' ? 'active' : ''}`}
              onClick={() => setActiveReportTab('punches')}
            >
              <span>🕒 Kaun Kab Aaya (Daily Punch Feed)</span>
              <span className="sw-subtab-count">{enrichedPunchFeed.length}</span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="sw-reports-toolbar">
            <div className="sw-search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search member name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sw-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sw-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterPunctuality}
              onChange={(e) => setFilterPunctuality(e.target.value)}
              className="sw-filter-select"
            >
              <option value="all">Filter: All Statuses</option>
              <option value="ontime">🟢 High Punctuality (≥90%)</option>
              <option value="late">🟡 Has Late Arrivals</option>
              <option value="active">⚡ Currently In-Shift</option>
            </select>

            {activeReportTab === 'members' && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sw-filter-select"
              >
                <option value="hours-desc">Sort: Highest Work Hours</option>
                <option value="hours-asc">Sort: Lowest Work Hours</option>
                <option value="rate">Sort: Highest Punctuality</option>
                <option value="name">Sort: Name (A-Z)</option>
              </select>
            )}
          </div>
        </div>

        {/* ================= TAB 1: MEMBER SUMMARIES & DETAILED PROFILE DIRECTORY ================= */}
        {activeReportTab === 'members' && (
          <div className="sw-table-card">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <span className="spinner" /> Loading workforce reports…
              </div>
            ) : filteredMemberSummaries.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No team members match your criteria</h3>
                <p style={{ margin: 0, fontSize: '0.92rem' }}>Try clearing the search query or adjusting your timeframe.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="sw-reports-table">
                  <thead>
                    <tr>
                      <th>Team Member</th>
                      <th>Department / Role</th>
                      <th style={{ textAlign: 'center' }}>Present Shifts</th>
                      <th style={{ textAlign: 'center' }}>Total Hours Worked</th>
                      <th style={{ textAlign: 'center' }}>Avg Hours / Day</th>
                      <th style={{ textAlign: 'center' }}>Punctuality Score</th>
                      <th style={{ textAlign: 'center' }}>Overtime / Deficit</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemberSummaries.map((member) => {
                      const initial = member.name.charAt(0).toUpperCase()
                      const isShiftActive = member.latestRecord && !member.latestRecord.checkOutTime && member.latestRecord.date === todayDateKey()

                      return (
                        <tr key={member.uid} className="sw-report-row">
                          <td data-label="Team Member">
                            <div className="sw-member-cell">
                              <div className="sw-member-avatar-wrap">
                                {member.photoURL ? (
                                  <img src={member.photoURL} alt={member.name} className="sw-member-avatar" />
                                ) : (
                                  <div className="sw-member-avatar-fallback">{initial}</div>
                                )}
                                <span className={`sw-avatar-status-dot ${isShiftActive ? 'active' : 'offline'}`} />
                              </div>
                              <div className="sw-member-meta">
                                <div className="sw-member-name-row">
                                  <strong>{member.name}</strong>
                                  {isShiftActive && (
                                    <span className="sw-shift-active-tag">In-Shift Now</span>
                                  )}
                                </div>
                                <span className="sw-member-email">{member.email}</span>
                              </div>
                            </div>
                          </td>

                          <td data-label="Role">
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                              {member.department}
                            </div>
                            <span className="badge badge-employee" style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                              {member.role === 'admin' ? '🛡️ Admin' : '👤 Employee'}
                            </span>
                          </td>

                          <td data-label="Present Shifts" style={{ textAlign: 'center' }}>
                            <div className="sw-shifts-stat">
                              <span className="sw-present-badge">{member.presentCount} Days</span>
                              <span className="sw-shifts-sub">{member.fullDaysCount} completed</span>
                            </div>
                          </td>

                          <td data-label="Total Hours Worked" style={{ textAlign: 'center' }}>
                            <div className="sw-hours-pill">
                              <span className="sw-hours-val">{member.totalHoursFormatted}</span>
                            </div>
                          </td>

                          <td data-label="Avg Hours / Day" style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0284c7', fontSize: '0.92rem' }}>
                              {member.avgHoursFormatted}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>per logged shift</span>
                          </td>

                          <td data-label="Punctuality Score" style={{ textAlign: 'center' }}>
                            <div className="sw-punctuality-wrap">
                              <span
                                className="sw-punctuality-rate"
                                style={{
                                  color: member.punctualityRate >= 85 ? '#10b981' : member.punctualityRate >= 70 ? '#f59e0b' : '#ef4444'
                                }}
                              >
                                {member.punctualityRate}%
                              </span>
                              <span className="sw-punctuality-sub">
                                {member.latePunchesCount === 0 ? 'Always On-Time' : `${member.latePunchesCount} late`}
                              </span>
                            </div>
                          </td>

                          <td data-label="Overtime / Deficit" style={{ textAlign: 'center' }}>
                            {member.overtimeMinutes > 0 ? (
                              <span className="sw-ot-badge positive">
                                +{formatDurationMinutes(member.overtimeMinutes)} OT
                              </span>
                            ) : member.deficitMinutes > 0 ? (
                              <span className="sw-ot-badge negative">
                                -{formatDurationMinutes(member.deficitMinutes)}
                              </span>
                            ) : (
                              <span className="sw-ot-badge neutral">Balanced</span>
                            )}
                          </td>

                          <td data-label="Actions" style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="sw-view-profile-btn"
                                onClick={() => setSelectedMemberModal(member)}
                                title={`Open detailed profile report for ${member.name}`}
                              >
                                <span>Detail Profile ➜</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: KAUN KAB AAYA & KITNE HOUR WORK KARE (PUNCH FEED) ================= */}
        {activeReportTab === 'punches' && (
          <div className="sw-table-card">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <span className="spinner" /> Loading punch timeline…
              </div>
            ) : enrichedPunchFeed.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No punch records found for this period</h3>
                <p style={{ margin: 0, fontSize: '0.92rem' }}>Adjust your timeframe or clear search filters.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="sw-reports-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Weekday</th>
                      <th>Team Member</th>
                      <th>Check-In (Kaun Kab Aaya)</th>
                      <th style={{ textAlign: 'center' }}>Arrival Selfie</th>
                      <th>Check-Out (Departure)</th>
                      <th style={{ textAlign: 'center' }}>Exit Selfie</th>
                      <th style={{ textAlign: 'center' }}>Work Hours</th>
                      <th>GPS &amp; Geofence</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedPunchFeed.map((record) => {
                      const initial = record.employeeName.charAt(0).toUpperCase()

                      return (
                        <tr key={record.id || `${record.uid}-${record.date}`} className="sw-report-row">
                          <td data-label="Date">
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {record.date}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {getWeekday(record.date, 'long')}
                            </span>
                          </td>

                          <td data-label="Member">
                            <div className="sw-member-cell">
                              <div className="sw-member-avatar-wrap sm">
                                {record.employeePhoto ? (
                                  <img src={record.employeePhoto} alt={record.employeeName} className="sw-member-avatar sm" />
                                ) : (
                                  <div className="sw-member-avatar-fallback sm">{initial}</div>
                                )}
                              </div>
                              <div className="sw-member-meta">
                                <strong style={{ fontSize: '0.88rem' }}>{record.employeeName}</strong>
                                <span className="sw-member-email" style={{ fontSize: '0.75rem' }}>{record.employeeEmail}</span>
                              </div>
                            </div>
                          </td>

                          {/* Check-In Column (Kaun Kab Aaya) */}
                          <td data-label="Check-In Time">
                            <div className="sw-punch-time-wrap">
                              <span className="sw-punch-time">
                                {formatTime(record.checkInTime)}
                              </span>
                              {record.punctuality.isLate ? (
                                <span className="sw-late-badge">
                                  ⚠️ {record.punctuality.label}
                                </span>
                              ) : (
                                <span className="sw-ontime-badge">
                                  ✓ On Time
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Check-In Selfie Thumbnail */}
                          <td data-label="Arrival Selfie" style={{ textAlign: 'center' }}>
                            {(record.checkInSelfieUrl || record.checkInPhotoUrl) ? (
                              <button
                                type="button"
                                className="sw-selfie-thumb-btn"
                                onClick={() =>
                                  setSelectedSelfiePreview({
                                    url: record.checkInSelfieUrl || record.checkInPhotoUrl,
                                    title: `Check-In Selfie: ${record.employeeName}`,
                                    sub: `${record.date} at ${formatTime(record.checkInTime)}`
                                  })
                                }
                                title="Click to view arrival photo"
                              >
                                <img src={record.checkInSelfieUrl || record.checkInPhotoUrl} alt="In Selfie" className="sw-selfie-thumb" />
                                <span className="sw-selfie-zoom-icon">🔍</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No photo</span>
                            )}
                          </td>

                          {/* Check-Out Column */}
                          <td data-label="Check-Out Time">
                            {record.checkOutTime ? (
                              <div className="sw-punch-time-wrap">
                                <span className="sw-punch-time">
                                  {formatTime(record.checkOutTime)}
                                </span>
                                <span className="sw-completed-badge">
                                  ✓ Shift Done
                                </span>
                              </div>
                            ) : record.isActiveShift ? (
                              <div className="sw-punch-time-wrap">
                                <span className="sw-shift-active-tag">
                                  ⚡ Active In-Shift
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>— No check-out</span>
                            )}
                          </td>

                          {/* Check-Out Selfie Thumbnail */}
                          <td data-label="Exit Selfie" style={{ textAlign: 'center' }}>
                            {(record.checkOutSelfieUrl || record.checkOutPhotoUrl) ? (
                              <button
                                type="button"
                                className="sw-selfie-thumb-btn"
                                onClick={() =>
                                  setSelectedSelfiePreview({
                                    url: record.checkOutSelfieUrl || record.checkOutPhotoUrl,
                                    title: `Check-Out Selfie: ${record.employeeName}`,
                                    sub: `${record.date} at ${formatTime(record.checkOutTime)}`
                                  })
                                }
                                title="Click to view departure photo"
                              >
                                <img src={record.checkOutSelfieUrl || record.checkOutPhotoUrl} alt="Out Selfie" className="sw-selfie-thumb" />
                                <span className="sw-selfie-zoom-icon">🔍</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Work Hours Column */}
                          <td data-label="Work Hours" style={{ textAlign: 'center' }}>
                            <div className="sw-hours-pill">
                              <span className="sw-hours-val">{record.durationFormatted}</span>
                            </div>
                            {record.isCompleted && (
                              <div style={{ fontSize: '0.72rem', marginTop: '2px', color: record.isOvertime ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                                {record.diffOtFormatted}
                              </div>
                            )}
                          </td>

                          {/* GPS / Geofence Column with Map Check Button */}
                          <td data-label="GPS & Geofence">
                            {record.checkInLocation ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
                                <div className="sw-gps-badge" title={`Coordinates: ${(record.checkInLocation.lat || record.checkInLocation.latitude)?.toFixed?.(4)}, ${(record.checkInLocation.lng || record.checkInLocation.longitude)?.toFixed?.(4)}`}>
                                  <span>📍 Inside Office</span>
                                  <span className="sw-gps-acc">({Math.round(record.checkInLocation.accuracy || 10)}m)</span>
                                </div>
                                <a
                                  href={`https://www.google.com/maps?q=${record.checkInLocation.lat || record.checkInLocation.latitude || 28.6129},${record.checkInLocation.lng || record.checkInLocation.longitude || 77.2090}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-map-check"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.74rem',
                                    color: '#1E5AE6',
                                    background: '#EEF4FF',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontWeight: '700',
                                    textDecoration: 'none',
                                    border: '1px solid rgba(30, 90, 230, 0.2)'
                                  }}
                                  title="Open exact GPS pin in Google Maps"
                                >
                                  <span>🗺️</span>
                                  <span>Check Location</span>
                                </a>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td data-label="Action" style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => {
                                const found = memberReportSummaries.find((m) => m.uid === record.uid)
                                if (found) setSelectedMemberModal(found)
                              }}
                            >
                              Profile
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= MODAL: DETAILED PROFILE REPORT FOR EACH MEMBER ================= */}
        {selectedMemberModal && (
          <div className="modal-overlay" onClick={() => setSelectedMemberModal(null)}>
            <div
              className="modal-content sw-member-profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sw-member-modal-header">
                <div className="sw-profile-header-main">
                  <div className="sw-profile-avatar-large-wrap">
                    {selectedMemberModal.photoURL ? (
                      <img
                        src={selectedMemberModal.photoURL}
                        alt={selectedMemberModal.name}
                        className="sw-profile-avatar-large"
                      />
                    ) : (
                      <div className="sw-profile-avatar-large-fallback">
                        {selectedMemberModal.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`sw-profile-status-badge ${selectedMemberModal.status === 'disabled' ? 'disabled' : 'active'}`}>
                      {selectedMemberModal.status === 'disabled' ? 'Inactive' : 'Active'}
                    </span>
                  </div>

                  <div className="sw-profile-title-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#0f172a' }}>
                        {selectedMemberModal.name}
                      </h2>
                      <span className="badge badge-employee">
                        {selectedMemberModal.role === 'admin' ? '🛡️ Admin' : '👤 Employee'}
                      </span>
                    </div>

                    <div className="sw-profile-contact-row">
                      <span>📧 {selectedMemberModal.email}</span>
                      {selectedMemberModal.phone && selectedMemberModal.phone !== '—' && (
                        <span>📞 {selectedMemberModal.phone}</span>
                      )}
                      <span>🏢 {selectedMemberModal.department}</span>
                      <span>📅 Joined: {selectedMemberModal.joinDate || COMPANY_START_DATE}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedMemberModal(null)}
                  title="Close profile report"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="sw-member-modal-body">
                {/* Period KPI Stat Banner */}
                <div className="sw-profile-kpi-banner">
                  <div className="sw-prof-kpi-item">
                    <span className="sw-prof-kpi-label">Present Days</span>
                    <strong className="sw-prof-kpi-val green">{selectedMemberModal.presentCount}</strong>
                    <span className="sw-prof-kpi-sub">{selectedMemberModal.fullDaysCount} completed</span>
                  </div>

                  <div className="sw-prof-kpi-item">
                    <span className="sw-prof-kpi-label">Total Work Hours</span>
                    <strong className="sw-prof-kpi-val blue">{selectedMemberModal.totalHoursFormatted}</strong>
                    <span className="sw-prof-kpi-sub">in {dateRange.label}</span>
                  </div>

                  <div className="sw-prof-kpi-item">
                    <span className="sw-prof-kpi-label">Avg Hours / Day</span>
                    <strong className="sw-prof-kpi-val cyan">{selectedMemberModal.avgHoursFormatted}</strong>
                    <span className="sw-prof-kpi-sub">standard shift: 8h</span>
                  </div>

                  <div className="sw-prof-kpi-item">
                    <span className="sw-prof-kpi-label">Punctuality Score</span>
                    <strong className="sw-prof-kpi-val purple">{selectedMemberModal.punctualityRate}%</strong>
                    <span className="sw-prof-kpi-sub">
                      {selectedMemberModal.latePunchesCount === 0 ? 'Zero late marks' : `${selectedMemberModal.latePunchesCount} late marks`}
                    </span>
                  </div>

                  <div className="sw-prof-kpi-item">
                    <span className="sw-prof-kpi-label">Overtime Logged</span>
                    <strong className="sw-prof-kpi-val amber">
                      +{formatDurationMinutes(selectedMemberModal.overtimeMinutes)}
                    </strong>
                    <span className="sw-prof-kpi-sub">cumulative OT</span>
                  </div>
                </div>

                {/* Section Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.25rem 0 0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📜</span>
                    <span>Daily Attendance Timeline &amp; Hours Log ({dateRange.label})</span>
                  </h4>

                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => handleExportMemberCSV(selectedMemberModal)}
                  >
                    📥 Export Member CSV
                  </button>
                </div>

                {/* Member Daily Breakdown Table */}
                {selectedMemberModal.records.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
                    No check-ins recorded for this employee in {dateRange.label}.
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    <table className="sw-reports-table sub-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check-In</th>
                          <th>In Photo</th>
                          <th>Check-Out</th>
                          <th>Out Photo</th>
                          <th style={{ textAlign: 'center' }}>Hours Worked</th>
                          <th>Punctuality</th>
                          <th>Overtime vs 8h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMemberModal.records.map((r) => {
                          const dMin = calcWorkDurationMinutes(r.checkInTime, r.checkOutTime)
                          const p = checkPunctuality(r.checkInTime)
                          const diff = dMin - STANDARD_WORKDAY_MINUTES

                          return (
                            <tr key={r.id || r.date}>
                              <td>
                                <strong>{r.date}</strong>
                                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                                  {getWeekday(r.date, 'short')}
                                </span>
                              </td>

                              <td>
                                <strong style={{ color: '#0f172a' }}>{formatTime(r.checkInTime)}</strong>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                {(r.checkInSelfieUrl || r.checkInPhotoUrl) ? (
                                  <button
                                    type="button"
                                    className="sw-selfie-thumb-btn mini"
                                    onClick={() =>
                                      setSelectedSelfiePreview({
                                        url: r.checkInSelfieUrl || r.checkInPhotoUrl,
                                        title: `Arrival Selfie: ${selectedMemberModal.name}`,
                                        sub: `${r.date} at ${formatTime(r.checkInTime)}`
                                      })
                                    }
                                  >
                                    <img src={r.checkInSelfieUrl || r.checkInPhotoUrl} alt="In Selfie" className="sw-selfie-thumb mini" />
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>—</span>
                                )}
                              </td>

                              <td>
                                {r.checkOutTime ? (
                                  <strong style={{ color: '#0f172a' }}>{formatTime(r.checkOutTime)}</strong>
                                ) : (
                                  <span className="sw-shift-active-tag">Active In-Shift</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                {(r.checkOutSelfieUrl || r.checkOutPhotoUrl) ? (
                                  <button
                                    type="button"
                                    className="sw-selfie-thumb-btn mini"
                                    onClick={() =>
                                      setSelectedSelfiePreview({
                                        url: r.checkOutSelfieUrl || r.checkOutPhotoUrl,
                                        title: `Departure Selfie: ${selectedMemberModal.name}`,
                                        sub: `${r.date} at ${formatTime(r.checkOutTime)}`
                                      })
                                    }
                                  >
                                    <img src={r.checkOutSelfieUrl || r.checkOutPhotoUrl} alt="Out Selfie" className="sw-selfie-thumb mini" />
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>—</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <span className="sw-hours-val bold" style={{ fontSize: '0.85rem' }}>
                                  {formatDurationMinutes(dMin)}
                                </span>
                              </td>

                              <td>
                                {p.isLate ? (
                                  <span className="sw-late-badge mini">Late (+{p.diffMinutes}m)</span>
                                ) : (
                                  <span className="sw-ontime-badge mini">On Time</span>
                                )}
                              </td>

                              <td>
                                {diff > 0 ? (
                                  <span className="sw-ot-badge positive mini">+{formatDurationMinutes(diff)} OT</span>
                                ) : diff < 0 && r.checkOutTime ? (
                                  <span className="sw-ot-badge negative mini">-{formatDurationMinutes(Math.abs(diff))}</span>
                                ) : (
                                  <span className="sw-ot-badge neutral mini">Standard</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sw-member-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedMemberModal(null)}
                >
                  Close Profile
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleExportMemberCSV(selectedMemberModal)}
                >
                  📥 Download Member Report CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: SELFIE ZOOM PREVIEW ================= */}
        {selectedSelfiePreview && (
          <div className="modal-overlay" onClick={() => setSelectedSelfiePreview(null)}>
            <div className="modal-content sw-selfie-zoom-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>{selectedSelfiePreview.title}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    {selectedSelfiePreview.sub}
                  </p>
                </div>
                <button className="btn-close" onClick={() => setSelectedSelfiePreview(null)}>
                  ✕
                </button>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#090d18', borderRadius: '12px', marginTop: '0.75rem' }}>
                <img
                  src={selectedSelfiePreview.url}
                  alt="Biometric Selfie"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '65vh',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
