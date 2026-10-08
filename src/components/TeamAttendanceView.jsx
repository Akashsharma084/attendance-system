import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { formatTime, todayDateKey } from '../utils/dateHelpers'
import { mockGetAttendanceList } from '../mockService'

export default function TeamAttendanceView({ onSelectSelfie }) {
  const [selectedDate, setSelectedDate] = useState(todayDateKey())
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'working' | 'completed' | 'not-arrived'
  const [sortBy, setSortBy] = useState('time-asc') // 'time-asc' | 'time-desc' | 'name'
  const [displayLayout, setDisplayLayout] = useState('table') // 'table' | 'cards'

  const todayKey = todayDateKey()
  const isTodaySelected = selectedDate === todayKey

  // Fetch Attendance & Users in Real-Time
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    if (!isFirebaseConfigured || !db) {
      const allAtt = mockGetAttendanceList({})
      const filtered = allAtt.filter((r) => r.date === selectedDate)
      setAttendanceRecords(filtered)
      setUsersList([
        { uid: 'demo-emp-1', name: 'Alex Chen', email: 'alex@company.com' },
        { uid: 'demo-emp-2', name: 'Maria Santos', email: 'maria@company.com' },
        { uid: 'demo-emp-3', name: 'Liam Patel', email: 'liam@company.com' }
      ])
      setLoading(false)
      return
    }

    // 1. Live attendance listener for the selected date
    const attQ = query(
      collection(db, 'attendance'),
      where('date', '==', selectedDate)
    )

    const unsubAtt = onSnapshot(
      attQ,
      (snap) => {
        if (cancelled) return
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setAttendanceRecords(docs)
        setLoading(false)
      },
      (err) => {
        console.error('Failed to load team attendance stream:', err)
        setLoading(false)
      }
    )

    // 2. Fetch users list so we can see all registered employees
    const usersQ = query(collection(db, 'users'))
    const unsubUsers = onSnapshot(
      usersQ,
      (snap) => {
        if (cancelled) return
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => (u.role || '').toLowerCase() !== 'admin')
        setUsersList(list)
      },
      (err) => {
        console.warn('Could not load users directory:', err)
      }
    )

    return () => {
      cancelled = true
      unsubAtt()
      unsubUsers()
    }
  }, [selectedDate])

  // Helper to calculate duration
  function calcDuration(inTime, outTime) {
    if (!inTime) return '—'
    const dIn = inTime.toDate ? inTime.toDate() : new Date(inTime)
    const dOut = outTime
      ? (outTime.toDate ? outTime.toDate() : new Date(outTime))
      : (isTodaySelected ? new Date() : null)
    if (!dOut) return 'Shift Active'
    const diffMs = Math.max(0, dOut - dIn)
    const hrs = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hrs}h ${mins}m`
  }

  // Helper to extract timestamp ms for sorting
  function getTimestampMs(timeVal) {
    if (!timeVal) return 0
    const d = timeVal.toDate ? timeVal.toDate() : new Date(timeVal)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  // Combine attendance with employee user directory
  const teamItems = useMemo(() => {
    const recordMap = new Map()
    attendanceRecords.forEach((r) => {
      if (r.uid) recordMap.set(r.uid, r)
    })

    const items = []
    const processedUids = new Set()

    // First add everyone who has an attendance record
    attendanceRecords.forEach((rec) => {
      processedUids.add(rec.uid)
      const userMeta = usersList.find((u) => u.uid === rec.uid)
      const empName = rec.name || userMeta?.name || rec.email || userMeta?.email?.split('@')[0] || 'Employee'
      const empEmail = userMeta?.email || rec.email || ''
      const photo = userMeta?.photoURL || rec.checkInSelfieUrl || null

      let status = 'working'
      if (rec.checkOutTime) {
        status = 'completed'
      }

      items.push({
        id: rec.id,
        uid: rec.uid,
        name: empName,
        email: empEmail,
        photo,
        record: rec,
        status, // 'working' | 'completed'
        checkInTime: rec.checkInTime,
        checkOutTime: rec.checkOutTime,
        checkInSelfieUrl: rec.checkInSelfieUrl,
        checkOutSelfieUrl: rec.checkOutSelfieUrl
      })
    })

    // Also include registered users who haven't punched yet
    usersList.forEach((u) => {
      if (!processedUids.has(u.uid)) {
        items.push({
          id: `unpunched-${u.uid}`,
          uid: u.uid,
          name: u.name || u.email?.split('@')[0] || 'Employee',
          email: u.email || '',
          photo: u.photoURL || null,
          record: null,
          status: 'not-arrived',
          checkInTime: null,
          checkOutTime: null,
          checkInSelfieUrl: null,
          checkOutSelfieUrl: null
        })
      }
    })

    return items
  }, [attendanceRecords, usersList])

  // Aggregate high-level metrics
  const stats = useMemo(() => {
    let presentCount = 0
    let workingCount = 0
    let completedCount = 0
    let notArrivedCount = 0
    let earliestRecord = null

    teamItems.forEach((item) => {
      if (item.record) {
        presentCount++
        if (item.status === 'working') workingCount++
        if (item.status === 'completed') completedCount++

        if (item.checkInTime) {
          const ms = getTimestampMs(item.checkInTime)
          if (!earliestRecord || ms < earliestRecord.ms) {
            earliestRecord = { name: item.name, timeStr: formatTime(item.checkInTime), ms }
          }
        }
      } else {
        notArrivedCount++
      }
    })

    return {
      presentCount,
      workingCount,
      completedCount,
      notArrivedCount,
      earliest: earliestRecord
    }
  }, [teamItems])

  // Filter & Search
  const filteredItems = useMemo(() => {
    let list = teamItems

    // 1. Status Filter
    if (statusFilter === 'working') {
      list = list.filter((i) => i.status === 'working')
    } else if (statusFilter === 'completed') {
      list = list.filter((i) => i.status === 'completed')
    } else if (statusFilter === 'not-arrived') {
      list = list.filter((i) => i.status === 'not-arrived')
    }

    // 2. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q)
      )
    }

    // 3. Sorting
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      // Put punched employees before unpunched
      if (a.record && !b.record) return -1
      if (!a.record && b.record) return 1

      const timeA = getTimestampMs(a.checkInTime)
      const timeB = getTimestampMs(b.checkInTime)

      if (sortBy === 'time-asc') {
        return timeA - timeB
      } else {
        return timeB - timeA
      }
    })

    return sorted
  }, [teamItems, statusFilter, searchQuery, sortBy])

  // Quick Date Shortcut Handlers
  function setDateToday() {
    setSelectedDate(todayDateKey())
  }

  function setDateYesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    setSelectedDate(todayDateKey(d))
  }

  return (
    <div className="sw-team-attendance-wrapper">
      {/* Top Header & Date Selection Banner */}
      <div className="sw-team-header-card">
        <div className="sw-team-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 className="sw-team-title">👥 Team Attendance &amp; Arrivals</h2>
            <span className="sw-live-beacon" title="Real-time employee punch sync">
              <span className="sw-beacon-dot" /> Live
            </span>
          </div>
          <p className="sw-team-subtitle">
            Track arrival times of all colleagues. Know exactly who has checked in and when.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div className="sw-team-date-controls">
          <button
            type="button"
            className={`sw-date-quick-btn ${isTodaySelected ? 'active' : ''}`}
            onClick={setDateToday}
          >
            Today
          </button>
          <button
            type="button"
            className="sw-date-quick-btn"
            onClick={setDateYesterday}
          >
            Yesterday
          </button>
          <div className="sw-date-picker-wrap">
            <span className="sw-date-picker-icon">📅</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="sw-team-date-input"
              title="Pick specific date"
            />
          </div>
        </div>
      </div>

      {/* Live Metric Stats Bar */}
      <div className="sw-team-stats-grid">
        <div className="sw-team-stat-card blue">
          <div className="sw-stat-head">
            <span className="sw-stat-label">Present Today</span>
            <span className="sw-stat-icon">👥</span>
          </div>
          <div className="sw-stat-val">{stats.presentCount}</div>
          <div className="sw-stat-foot">Staff checked in</div>
        </div>

        <div className="sw-team-stat-card green">
          <div className="sw-stat-head">
            <span className="sw-stat-label">In Office Now</span>
            <span className="sw-stat-icon">🟢</span>
          </div>
          <div className="sw-stat-val">{stats.workingCount}</div>
          <div className="sw-stat-foot">Currently active</div>
        </div>

        <div className="sw-team-stat-card purple">
          <div className="sw-stat-head">
            <span className="sw-stat-label">Completed Shift</span>
            <span className="sw-stat-icon">🏁</span>
          </div>
          <div className="sw-stat-val">{stats.completedCount}</div>
          <div className="sw-stat-foot">Checked out</div>
        </div>

        <div className="sw-team-stat-card amber">
          <div className="sw-stat-head">
            <span className="sw-stat-label">Earliest Arrival</span>
            <span className="sw-stat-icon">🏆</span>
          </div>
          <div className="sw-stat-val" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.earliest ? stats.earliest.timeStr : '—'}
          </div>
          <div className="sw-stat-foot" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.earliest ? stats.earliest.name : 'Awaiting punches'}
          </div>
        </div>
      </div>

      {/* Filter, Search & Layout Bar */}
      <div className="sw-team-toolbar">
        {/* Search */}
        <div className="sw-team-search-box">
          <span className="sw-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search employee by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sw-team-search-input"
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

        {/* Filter Pills */}
        <div className="sw-team-filter-pills">
          <button
            type="button"
            className={`sw-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Staff ({teamItems.length})
          </button>
          <button
            type="button"
            className={`sw-filter-pill ${statusFilter === 'working' ? 'active' : ''}`}
            onClick={() => setStatusFilter('working')}
          >
            🟢 In Office ({stats.workingCount})
          </button>
          <button
            type="button"
            className={`sw-filter-pill ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            🏁 Completed ({stats.completedCount})
          </button>
          <button
            type="button"
            className={`sw-filter-pill ${statusFilter === 'not-arrived' ? 'active' : ''}`}
            onClick={() => setStatusFilter('not-arrived')}
          >
            ⏳ Not In Yet ({stats.notArrivedCount})
          </button>
        </div>

        {/* Sort & Layout Toggle */}
        <div className="sw-team-view-options">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sw-team-sort-select"
            title="Sort records"
          >
            <option value="time-asc">⏰ Arrival: Earliest First</option>
            <option value="time-desc">⏰ Arrival: Latest First</option>
            <option value="name">🔤 Name: A to Z</option>
          </select>

          <div className="sw-team-layout-toggle">
            <button
              type="button"
              className={`sw-layout-btn ${displayLayout === 'table' ? 'active' : ''}`}
              onClick={() => setDisplayLayout('table')}
              title="Table view"
            >
              📋 Table
            </button>
            <button
              type="button"
              className={`sw-layout-btn ${displayLayout === 'cards' ? 'active' : ''}`}
              onClick={() => setDisplayLayout('cards')}
              title="Cards view"
            >
              🗂️ Cards
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="sw-loading-box">
          <span className="sw-spinner" />
          <p>Loading live team arrival records…</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="sw-team-empty-card">
          <div className="sw-team-empty-emoji">🏢</div>
          <h3>No records match your filter</h3>
          <p className="subtle">
            Try choosing a different date or clearing the search query.
          </p>
          {(statusFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '0.85rem' }}
              onClick={() => {
                setStatusFilter('all')
                setSearchQuery('')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : displayLayout === 'table' ? (
        /* TABLE LAYOUT */
        <div className="table-wrap sw-team-table-wrap">
          <table className="sw-team-table">
            <thead>
              <tr>
                <th style={{ minWidth: '180px' }}>Employee</th>
                <th style={{ minWidth: '110px' }}>Status</th>
                <th style={{ minWidth: '130px' }}>Arrival (Check In)</th>
                <th style={{ minWidth: '130px' }}>Departure (Check Out)</th>
                <th style={{ minWidth: '110px' }}>Duration</th>
                <th style={{ minWidth: '120px' }}>Selfies</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const hasIn = Boolean(item.checkInTime)
                const hasOut = Boolean(item.checkOutTime)
                const isFirst = idx === 0 && sortBy === 'time-asc' && hasIn

                return (
                  <tr key={item.id} className={item.status === 'not-arrived' ? 'row-muted' : ''}>
                    {/* Employee Identity */}
                    <td>
                      <div className="sw-team-user-cell">
                        <div className="sw-team-avatar-box">
                          {item.photo ? (
                            <img src={item.photo} alt={item.name} className="sw-avatar-img" />
                          ) : (
                            <span className="sw-team-avatar-fallback">
                              {item.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                          <span
                            className={`sw-team-user-pip ${
                              item.status === 'working'
                                ? 'active'
                                : item.status === 'completed'
                                ? 'done'
                                : 'idle'
                            }`}
                          />
                        </div>
                        <div className="sw-team-user-info">
                          <div className="sw-team-user-name">
                            {item.name}
                            {isFirst && (
                              <span className="sw-first-badge" title="First to arrive today!">
                                🏆 Earliest
                              </span>
                            )}
                          </div>
                          <span className="sw-team-user-email">{item.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      {item.status === 'working' ? (
                        <span className="sw-team-pill working">
                          <span className="sw-pill-dot green" /> In Office
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="sw-team-pill completed">
                          <span className="sw-pill-dot purple" /> Shift Done
                        </span>
                      ) : (
                        <span className="sw-team-pill not-in">
                          <span className="sw-pill-dot gray" /> Not In Yet
                        </span>
                      )}
                    </td>

                    {/* Arrival Check-In Time */}
                    <td>
                      {hasIn ? (
                        <div className="sw-team-time-box in">
                          <span className="sw-time-lead">🟢</span>
                          <span className="sw-time-val">{formatTime(item.checkInTime)}</span>
                        </div>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>

                    {/* Departure Check-Out Time */}
                    <td>
                      {hasOut ? (
                        <div className="sw-team-time-box out">
                          <span className="sw-time-lead">🏁</span>
                          <span className="sw-time-val">{formatTime(item.checkOutTime)}</span>
                        </div>
                      ) : hasIn ? (
                        <span className="sw-active-working-tag">
                          Working Now
                        </span>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>

                    {/* Working Duration */}
                    <td>
                      <span className="sw-duration-text">
                        {calcDuration(item.checkInTime, item.checkOutTime)}
                      </span>
                    </td>

                    {/* Selfies */}
                    <td>
                      <div className="sw-team-selfies-cell">
                        {item.checkInSelfieUrl && (
                          <div
                            className="sw-team-selfie-thumb"
                            onClick={() =>
                              onSelectSelfie({
                                url: item.checkInSelfieUrl,
                                title: `${item.name} — Check-In Selfie (${formatTime(item.checkInTime)})`
                              })
                            }
                            title="Click to view Check-In Selfie"
                          >
                            <img src={item.checkInSelfieUrl} alt="In Selfie" />
                            <span className="sw-selfie-tag in">IN</span>
                          </div>
                        )}
                        {item.checkOutSelfieUrl && (
                          <div
                            className="sw-team-selfie-thumb"
                            onClick={() =>
                              onSelectSelfie({
                                url: item.checkOutSelfieUrl,
                                title: `${item.name} — Check-Out Selfie (${formatTime(item.checkOutTime)})`
                              })
                            }
                            title="Click to view Check-Out Selfie"
                          >
                            <img src={item.checkOutSelfieUrl} alt="Out Selfie" />
                            <span className="sw-selfie-tag out">OUT</span>
                          </div>
                        )}
                        {!item.checkInSelfieUrl && !item.checkOutSelfieUrl && (
                          <span className="subtle">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARDS LAYOUT */
        <div className="sw-team-cards-grid">
          {filteredItems.map((item, idx) => {
            const hasIn = Boolean(item.checkInTime)
            const hasOut = Boolean(item.checkOutTime)
            const isFirst = idx === 0 && sortBy === 'time-asc' && hasIn

            return (
              <div
                key={item.id}
                className={`sw-team-card ${
                  item.status === 'working'
                    ? 'card-working'
                    : item.status === 'completed'
                    ? 'card-done'
                    : 'card-idle'
                }`}
              >
                <div className="sw-team-card-top">
                  <div className="sw-team-card-user">
                    <div className="sw-team-avatar-box large">
                      {item.photo ? (
                        <img src={item.photo} alt={item.name} className="sw-avatar-img" />
                      ) : (
                        <span className="sw-team-avatar-fallback">
                          {item.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                      <span
                        className={`sw-team-user-pip ${
                          item.status === 'working'
                            ? 'active'
                            : item.status === 'completed'
                            ? 'done'
                            : 'idle'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="sw-team-user-name">
                        {item.name}
                        {isFirst && <span className="sw-first-badge">🏆 Earliest</span>}
                      </div>
                      <span className="sw-team-user-email">{item.email}</span>
                    </div>
                  </div>

                  {item.status === 'working' ? (
                    <span className="sw-team-pill working">In Office</span>
                  ) : item.status === 'completed' ? (
                    <span className="sw-team-pill completed">Shift Done</span>
                  ) : (
                    <span className="sw-team-pill not-in">Not In</span>
                  )}
                </div>

                {hasIn ? (
                  <div className="sw-team-card-times">
                    <div className="sw-team-card-time-item">
                      <span className="sw-card-label">Arrival:</span>
                      <strong className="sw-card-val in">🟢 {formatTime(item.checkInTime)}</strong>
                    </div>
                    <div className="sw-team-card-time-item">
                      <span className="sw-card-label">Departure:</span>
                      <strong className="sw-card-val out">
                        {hasOut ? `🏁 ${formatTime(item.checkOutTime)}` : '🟢 Still in Office'}
                      </strong>
                    </div>
                    <div className="sw-team-card-time-item">
                      <span className="sw-card-label">Duration:</span>
                      <strong className="sw-card-val">
                        ⏱️ {calcDuration(item.checkInTime, item.checkOutTime)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="sw-team-card-not-in">
                    ⏳ Has not logged a biometric punch for this date.
                  </div>
                )}

                {(item.checkInSelfieUrl || item.checkOutSelfieUrl) && (
                  <div className="sw-team-card-selfies">
                    <span className="sw-card-label">Selfies:</span>
                    <div className="sw-team-selfies-cell">
                      {item.checkInSelfieUrl && (
                        <div
                          className="sw-team-selfie-thumb"
                          onClick={() =>
                            onSelectSelfie({
                              url: item.checkInSelfieUrl,
                              title: `${item.name} — Check-In Selfie`
                            })
                          }
                        >
                          <img src={item.checkInSelfieUrl} alt="In Selfie" />
                          <span className="sw-selfie-tag in">IN</span>
                        </div>
                      )}
                      {item.checkOutSelfieUrl && (
                        <div
                          className="sw-team-selfie-thumb"
                          onClick={() =>
                            onSelectSelfie({
                              url: item.checkOutSelfieUrl,
                              title: `${item.name} — Check-Out Selfie`
                            })
                          }
                        >
                          <img src={item.checkOutSelfieUrl} alt="Out Selfie" />
                          <span className="sw-selfie-tag out">OUT</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
