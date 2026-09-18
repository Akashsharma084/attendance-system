// All helpers work off local time so a "day" matches what the employee sees on their clock.

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
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

export function lastNMonthKeys(n = 6) {
  const out = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(monthKey(d))
  }
  return out
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
    // Last day of that specific month
    lastDay = new Date(yearNum, monthNum, 0).getDate()
  } else {
    // Future month
    lastDay = 0
  }

  const days = []
  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(yearNum, monthNum - 1, d)
    const dayOfWeek = dateObj.getDay()
    // Monday = 1, Friday = 5. Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = `${yearNum}-${pad(monthNum)}-${pad(d)}`
      days.push({
        date: dateStr,
        weekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        weekdayFull: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        dayNumber: d
      })
    }
  }

  // Sort descending by date so most recent days show at top
  return days.reverse()
}

/**
 * Merges punch records with working calendar days for an employee.
 * Marks present days as 'P' and absent working days as 'A'.
 */
export function buildEmployeeSchedule(records = [], targetMonthKey, employeeInfo = {}) {
  const workingDays = getMonthWorkingDays(targetMonthKey)
  const recordMap = new Map()

  records.forEach((r) => {
    recordMap.set(r.date, r)
  })

  let presentCount = 0
  let absentCount = 0
  let fullDaysCount = 0

  const schedule = workingDays.map((day) => {
    const existing = recordMap.get(day.date)

    if (existing) {
      presentCount++
      if (existing.checkOutTime) fullDaysCount++
      return {
        id: existing.id || `rec-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'P',
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
    } else {
      absentCount++
      return {
        id: `absent-${day.date}`,
        date: day.date,
        weekday: day.weekday,
        weekdayFull: day.weekdayFull,
        status: 'A',
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

  return {
    schedule,
    presentCount,
    absentCount,
    totalWorkingDays: workingDays.length,
    fullDaysCount
  }
}
