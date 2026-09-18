/**
 * Official Company & Gazetted Public Holidays for 2026
 * (Easily extendable and customizable per company policy)
 */

export const DEFAULT_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day", icon: '🎉', type: 'company' },
  { date: '2026-01-26', name: 'Republic Day', icon: '🇮🇳', type: 'national' },
  { date: '2026-03-03', name: 'Holi (Festival of Colors)', icon: '🎨', type: 'festival' },
  { date: '2026-03-20', name: 'Eid-ul-Fitr', icon: '🌙', type: 'festival' },
  { date: '2026-04-03', name: 'Good Friday', icon: '🕊️', type: 'gazetted' },
  { date: '2026-05-01', name: 'Labour Day', icon: '🛠️', type: 'gazetted' },
  { date: '2026-05-27', name: 'Eid-ul-Adha (Bakrid)', icon: '🕌', type: 'festival' },
  { date: '2026-08-15', name: 'Independence Day', icon: '🇮🇳', type: 'national' },
  { date: '2026-08-28', name: 'Raksha Bandhan', icon: '🧵', type: 'festival' },
  { date: '2026-09-04', name: 'Janmashtami', icon: '🦚', type: 'festival' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', icon: '🕊️', type: 'national' },
  { date: '2026-10-20', name: 'Dussehra / Vijayadashami', icon: '🏹', type: 'festival' },
  { date: '2026-11-08', name: 'Diwali (Deepawali)', icon: '🪔', type: 'festival' },
  { date: '2026-11-09', name: 'Govardhan Puja', icon: '✨', type: 'festival' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', icon: '🌸', type: 'festival' },
  { date: '2026-12-25', name: 'Christmas Day', icon: '🎄', type: 'festival' }
]

/**
 * Returns stored custom holidays from localStorage merged with defaults
 */
export function getCompanyHolidays() {
  try {
    const custom = JSON.parse(localStorage.getItem('sw_company_holidays') || '[]')
    const map = new Map()
    DEFAULT_HOLIDAYS_2026.forEach((h) => map.set(h.date, h))
    custom.forEach((h) => map.set(h.date, h))
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return DEFAULT_HOLIDAYS_2026
  }
}

/**
 * Checks if a specific dateKey (YYYY-MM-DD) is a company holiday
 */
export function getHoliday(dateKey) {
  if (!dateKey) return null
  const list = getCompanyHolidays()
  return list.find((h) => h.date === dateKey) || null
}

/**
 * Helper to check boolean
 */
export function isHoliday(dateKey) {
  return Boolean(getHoliday(dateKey))
}

/**
 * Gets all holidays in a given monthKey (YYYY-MM)
 */
export function getHolidaysInMonth(monthKey) {
  if (!monthKey) return []
  const list = getCompanyHolidays()
  return list.filter((h) => h.date.startsWith(monthKey))
}

/**
 * Gets next upcoming holiday from today
 */
export function getUpcomingHoliday(fromDateKey = new Date().toISOString().slice(0, 10)) {
  const list = getCompanyHolidays()
  return list.find((h) => h.date >= fromDateKey) || null
}
