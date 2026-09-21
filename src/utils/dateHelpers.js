import { getHoliday, isHoliday } from './holidays.js'

// Re-export for convenience across pages
export { getHoliday, isHoliday }

// Company inception date: August 7, 2026 (7/8/26)
export const COMPANY_START_DATE = '2026-08-07'
export const COMPANY_START_MONTH = '2026-08'

export function todayDateKey(d = new Date()) {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD, respects local timezone
}

export function monthKey(d = new Date()) {
  return todayDateKey(d).slice(0, 7) // YYYY-MM
}

export function formatTime(timestamp) {
  if (!timestamp) return '—'
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatMonthLabel(key) {
  if (!key) return ''
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

/**
 * Returns available month keys starting strictly from company inception: 2026-08 (August 2026)
 * up to the current month. Does not allow picking pre-company months.
 */
export function getAvailableMonthKeys() {
  const [startYear, startMonth] = COMPANY_START_MONTH.split('-').map(Number)
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1 // 1-indexed

  const keys = []
  let y = curYear
  let m = curMonth

  while (y > startYear || (y === startYear && m >= startMonth)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m--
    if (m < 1) {
      m = 12
      y--
    }
  }

  // Fallback if system date is behind company launch
  if (keys.length === 0) {
    keys.push(COMPANY_START_MONTH)
  }
  return keys
}

// Backward compatibility alias for any existing imports
export function lastNMonthKeys(n = 6) {
  return getAvailableMonthKeys()
}

export function getWeekday(dateStr, format = 'short') {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: format }) // 'short' -> 'Mon', 'long' -> 'Monday'
}

/**
 * Returns all working days (Mon-Fri) for a given monthKey (YYYY-MM).
 * For current month, goes up to today.
 * For past months, goes up to end of the month.
 * Days prior to company inception (2026-08-07) are excluded.
 */
export function getMonthWorkingDays(targetMonthKey) {
  const [yearNum, monthNum] = targetMonthKey.split('-').map(Number)
  const today = new Date()
  const currentMonthKey = monthKey(today)
  const pad = (n) => String(n).padStart(2, '0')

  let lastDay = 31
  if (targetMonthKey === currentMonthKey) {
    lastDay = today.getDate()
  } else if (targetMonthKey < currentMonthKey) {
    lastDay = new Date(yearNum, monthNum, 0).getDate()
  } else {
    lastDay = 0
  }

  const days = []
  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(yearNum, monthNum - 1, d)
    const dayOfWeek = dateObj.getDay()
    // Monday to Saturday = 1 to 6. Skip Sunday = 0 (Sunday is the only off day)
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      const dateStr = `${yearNum}-${pad(monthNum)}-${pad(d)}`
      // Exclude days before company inception (2026-08-07)
      if (dateStr >= COMPANY_START_DATE) {
        const holiday = getHoliday(dateStr)
        days.push({
          date: dateStr,
          weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
          weekdayFull: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          dayNumber: d,
          holiday
        })
      }
    }
  }

  return days.reverse()
}

/**
 * Determines employee's first day of work/check-in or explicit join date.
 * If employee has never checked in and has no join date, returns null.
 */
export function getEmployeeStartDate(records = [], employeeInfo = {}) {
  if (employeeInfo?.joinDate) return employeeInfo.joinDate
  if (employeeInfo?.startDate) return employeeInfo.startDate
  if (employeeInfo?.createdAt) {
    const cDate = typeof employeeInfo.createdAt === 'string'
      ? employeeInfo.createdAt.slice(0, 10)
      : employeeInfo.createdAt.toDate
      ? todayDateKey(employeeInfo.createdAt.toDate())
      : null
    if (cDate && cDate >= COMPANY_START_DATE) return cDate
  }

  let earliest = null
  for (const r of records) {
    if (r.date && (r.checkInTime || r.status === 'P')) {
      if (!earliest || r.date < earliest) {
        earliest = r.date
      }
    }
  }
  return earliest
}

/**
 * Merges punch records with working calendar days for an employee.
 * Marks present days as 'P', holidays as 'H', days before joining as 'NOT_JOINED' (not absent!),
 * and unrecorded working days after joining as 'A'.
 */
export function buildEmployeeSchedule(records = [], targetMonthKey, employeeInfo = {}) {
  const workingDays = getMonthWorkingDays(targetMonthKey)
  const recordMap = new Map()

  records.forEach((r) => {
    if (r.date) recordMap.set(r.date, r)
  })

  // Determine starting date of employee (first check-in date or joinDate)
  const empStartDate = getEmployeeStartDate(records, employeeInfo)

  let presentCount = 0
  let absentCount = 0
  let holidayCount = 0
  let notJoinedCount = 0
  let fullDaysCount = 0

  const schedule = workingDays.map((day) => {
    const existing = recordMap.get(day.date)
    const holiday = day.holiday || getHoliday(day.date)

    if (existing) {
      presentCount++
      if (existing.checkOutTime) fullDaysCount++
      return {
        id: existing.id || `rec-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'P',
        holiday,
        name: existing.name || employeeInfo.name || 'Employee',
        uid: existing.uid || employeeInfo.uid,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
        checkInSelfieUrl: existing.checkInSelfieUrl || null,
        checkInLocation: existing.checkInLocation || null,
        checkOutSelfieUrl: existing.checkOutSelfieUrl || null,
        checkOutLocation: existing.checkOutLocation || null,
        isComplete: Boolean(existing.checkOutTime)
      }
    } else if (holiday) {
      holidayCount++
      return {
        id: `holiday-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'H',
        holiday,
        name: employeeInfo.name || 'Employee',
        uid: employeeInfo.uid,
        checkInTime: null,
        checkOutTime: null,
        checkInSelfieUrl: null,
        checkInLocation: null,
        checkOutSelfieUrl: null,
        checkOutLocation: null,
        isComplete: false
      }
    } else if (!empStartDate || day.date < empStartDate) {
      // Days prior to employee joining/first check-in are NOT absent!
      notJoinedCount++
      return {
        id: `not-joined-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'NOT_JOINED',
        statusLabel: 'Not Joined Yet',
        holiday: null,
        name: employeeInfo.name || 'Employee',
        uid: employeeInfo.uid,
        checkInTime: null,
        checkOutTime: null,
        checkInSelfieUrl: null,
        checkInLocation: null,
        checkOutSelfieUrl: null,
        checkOutLocation: null,
        isComplete: false
      }
    } else {
      absentCount++
      return {
        id: `absent-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'A',
        statusLabel: 'Absent',
        holiday: null,
        name: employeeInfo.name || 'Employee',
        uid: employeeInfo.uid,
        checkInTime: null,
        checkOutTime: null,
        checkInSelfieUrl: null,
        checkInLocation: null,
        checkOutSelfieUrl: null,
        checkOutLocation: null,
        isComplete: false
      }
    }
  })

  // Effective working days for this employee exclude holidays and days before their joining
  const activeWorkingDays = Math.max(0, workingDays.length - notJoinedCount)
  const effectiveWorkingDays = Math.max(0, activeWorkingDays - holidayCount)

  return {
    schedule,
    presentCount,
    absentCount,
    holidayCount,
    notJoinedCount,
    empStartDate,
    totalWorkingDays: workingDays.length,
    effectiveWorkingDays,
    fullDaysCount
  }
}
