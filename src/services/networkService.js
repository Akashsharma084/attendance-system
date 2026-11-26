import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'

export const STORAGE_KEY_OFFICE_GEOFENCE = 'punch_office_geofence_settings'

export const DEFAULT_OFFICE_GEOFENCE = {
  latitude: null,
  longitude: null,
  radiusMeters: 100, // 100 meter allowed office radius
  officeAddress: '',
  updatedAt: null,
  updatedBy: null
}

/**
 * Calculate distance between two GPS coordinates in meters using the Haversine formula
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const numLat1 = Number(lat1)
  const numLon1 = Number(lon1)
  const numLat2 = Number(lat2)
  const numLon2 = Number(lon2)

  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) return null

  const R = 6371e3 // Earth mean radius in meters
  const toRad = Math.PI / 180
  const dLat = (numLat2 - numLat1) * toRad
  const dLon = (numLon2 - numLon1) * toRad

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(numLat1 * toRad) * Math.cos(numLat2 * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Get current browser GPS location with Promise and multi-tier iOS/Android fallback:
 * Tier 1: Try high accuracy (satellite GPS) with an 7-second timeout.
 * Tier 2: If Tier 1 fails (very common indoors on iPhone/iOS Safari or when Precise Location is off),
 *         immediately fall back to standard accuracy with longer timeout (15s) and cached position tolerance.
 */
export function getCurrentGpsCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'))
    }

    const tier1Options = {
      enableHighAccuracy: true,
      timeout: options.timeout || 7000,
      maximumAge: options.maximumAge !== undefined ? options.maximumAge : 10000
    }

    const tier2Options = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000 // Accept recent cached coordinates if indoors on iPhone/Android
    }

    // Try Tier 1: High accuracy (GPS)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isHighAccuracy: true
        })
      },
      (errTier1) => {
        console.warn('GPS High Accuracy Tier 1 failed or timed out, trying fallback Tier 2:', errTier1?.message || errTier1)
        // If user explicitly denied permission (code 1: PERMISSION_DENIED), do not re-request immediately
        if (errTier1?.code === 1) {
          return reject(errTier1)
        }

        // Try Tier 2: Standard accuracy (cellular / Wi-Fi triangulation for iOS Safari/PWAs)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              isHighAccuracy: false
            })
          },
          (errTier2) => {
            console.error('GPS Tier 2 failed as well:', errTier2)
            reject(errTier2 || errTier1)
          },
          tier2Options
        )
      },
      tier1Options
    )
  })
}

/**
 * Watch browser GPS location continuously with dual-tier fallback and clean error handling.
 * Returns unsubscribe function.
 */
export function watchGpsCoordinates(onSuccess, onError) {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    if (onError) onError(new Error('Geolocation is not supported'))
    return () => {}
  }

  let watchId = null
  let isWatchingHighAccuracy = true

  const handleSuccess = (pos) => {
    if (onSuccess) {
      onSuccess({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      })
    }
  }

  const handleError = (err) => {
    console.warn('watchGpsCoordinates error:', err?.message || err)
    if (isWatchingHighAccuracy && err?.code !== 1) {
      // Switch watchPosition to standard accuracy
      isWatchingHighAccuracy = false
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId)
        } catch {}
      }
      try {
        watchId = navigator.geolocation.watchPosition(
          handleSuccess,
          (err2) => {
            if (onError) onError(err2)
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        )
      } catch (e) {
        if (onError) onError(e)
      }
    } else {
      if (onError) onError(err)
    }
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  } catch (e) {
    console.warn('Failed to start watchPosition:', e)
  }

  return () => {
    if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchId)
      } catch {}
    }
  }
}

/**
 * Read cached or fallback office geofence settings from localStorage
 */
export function getLocalOfficeNetwork() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_GEOFENCE)
    if (raw) {
      const parsed = JSON.parse(raw)
      const isConfigured = parsed.latitude != null && parsed.longitude != null
      return {
        latitude: parsed.latitude != null ? Number(parsed.latitude) : null,
        longitude: parsed.longitude != null ? Number(parsed.longitude) : null,
        radiusMeters: parsed.radiusMeters ? Number(parsed.radiusMeters) : 100,
        officeAddress: parsed.officeAddress || '',
        isConfigured,
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_OFFICE_GEOFENCE, isConfigured: false }
}

/**
 * Subscribe to office geofence settings in Firestore (with localStorage fallback)
 */
export function subscribeOfficeNetworkConfig(callback) {
  // Emit local cache immediately
  callback(getLocalOfficeNetwork())

  if (!isFirebaseConfigured || !db) {
    return () => {}
  }

  const docRef = doc(db, 'settings', 'officeGeofence')
  const unsubscribe = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const isConfigured = data.latitude != null && data.longitude != null
        const config = {
          latitude: data.latitude != null ? Number(data.latitude) : null,
          longitude: data.longitude != null ? Number(data.longitude) : null,
          radiusMeters: data.radiusMeters ? Number(data.radiusMeters) : 100,
          officeAddress: data.officeAddress || '',
          isConfigured,
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null
        }
        try {
          localStorage.setItem(STORAGE_KEY_OFFICE_GEOFENCE, JSON.stringify(config))
        } catch {
          // ignore
        }
        callback(config)
      } else {
        callback(getLocalOfficeNetwork())
      }
    },
    (err) => {
      console.warn('Geofence settings snapshot warning:', err)
      callback(getLocalOfficeNetwork())
    }
  )

  return unsubscribe
}

/**
 * Save office geofence configuration (Admin only)
 */
export async function saveOfficeNetworkConfig({ latitude, longitude, radiusMeters, officeAddress, updatedBy }) {
  const isConfigured = latitude != null && longitude != null
  const payload = {
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    radiusMeters: radiusMeters ? Number(radiusMeters) : 100,
    officeAddress: (officeAddress || '').trim(),
    isConfigured,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || 'Admin'
  }

  // Update local cache
  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_GEOFENCE, JSON.stringify(payload))
  } catch {
    // ignore
  }

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'settings', 'officeGeofence')
    await setDoc(
      docRef,
      {
        ...payload,
        serverUpdatedAt: serverTimestamp()
      },
      { merge: true }
    )
  }

  return payload
}

/**
 * Check if a location is strictly within the allowed office geofence radius
 * @returns {object} { isAllowed: boolean, isConfigured: boolean, distanceMeters: number|null, allowedRadius: number, reason: string|null }
 */
export function checkGeofence(userLocation, officeConfig) {
  const cfg = officeConfig || getLocalOfficeNetwork()
  const userLat = userLocation?.lat ?? userLocation?.latitude
  const userLng = userLocation?.lng ?? userLocation?.longitude

  // If Admin has not configured Office GPS yet
  if (cfg.latitude == null || cfg.longitude == null) {
    return {
      isAllowed: true,
      isConfigured: false,
      distanceMeters: null,
      allowedRadius: cfg.radiusMeters || 100,
      reason: null
    }
  }

  // If user location is missing
  if (userLat == null || userLng == null) {
    return {
      isAllowed: false,
      isConfigured: true,
      distanceMeters: null,
      allowedRadius: cfg.radiusMeters || 100,
      reason: 'Location coordinate missing. Please enable device GPS.'
    }
  }

  const distance = calculateDistanceMeters(userLat, userLng, cfg.latitude, cfg.longitude)
  const allowedRadius = cfg.radiusMeters || 100

  if (distance <= allowedRadius) {
    return {
      isAllowed: true,
      isConfigured: true,
      distanceMeters: distance,
      allowedRadius,
      reason: null
    }
  }

  return {
    isAllowed: false,
    isConfigured: true,
    distanceMeters: distance,
    allowedRadius,
    reason: `You are ${distance}m away from the office. Punch is only permitted within ${allowedRadius}m.`
  }
}

/* =========================================================================
   OFFICE TIMINGS & SHIFT CONFIGURATION SERVICE
   ========================================================================= */

export const STORAGE_KEY_OFFICE_TIMING = 'punch_office_timing_settings'

export const DEFAULT_OFFICE_TIMING = {
  startTime: '09:00', // 24-hr format (09:00 AM)
  endTime: '18:00',   // 24-hr format (06:00 PM) - Office shift end & auto punchout time
  graceMinutes: 30,   // Grace period in minutes (e.g. up to 09:30 AM before marked late)
  workDays: 'Mon – Sat', // 'Mon – Sat', 'Mon – Fri', 'All 7 Days'
  autoCheckout: true, // Auto punch out at 6:00 PM
  updatedAt: null,
  updatedBy: null
}

/**
 * Formats 'HH:mm' 24-hour string to 'hh:mm AM/PM'
 */
export function formatTime24to12(time24) {
  if (!time24) return '09:00 AM'
  const parts = String(time24).split(':')
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1] || '00'
  if (isNaN(hours)) return '09:00 AM'
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12 // 0 becomes 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
}

/**
 * Read cached or fallback office timing settings from localStorage
 */
export function getLocalOfficeTiming() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_TIMING)
    if (raw) {
      const parsed = JSON.parse(raw)
      const endTime = parsed.endTime === '17:30' ? DEFAULT_OFFICE_TIMING.endTime : (parsed.endTime || DEFAULT_OFFICE_TIMING.endTime)
      return {
        startTime: parsed.startTime || DEFAULT_OFFICE_TIMING.startTime,
        endTime: endTime,
        graceMinutes: parsed.graceMinutes != null ? Number(parsed.graceMinutes) : DEFAULT_OFFICE_TIMING.graceMinutes,
        workDays: parsed.workDays || DEFAULT_OFFICE_TIMING.workDays,
        autoCheckout: parsed.autoCheckout != null ? Boolean(parsed.autoCheckout) : true,
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_OFFICE_TIMING }
}

let liveOfficeTiming = getLocalOfficeTiming()

/**
 * Subscribe to office timing settings in Firestore (with localStorage fallback)
 */
export function subscribeOfficeTimingConfig(callback) {
  // Emit local cache immediately
  const cached = getLocalOfficeTiming()
  liveOfficeTiming = cached
  callback(cached)

  if (!isFirebaseConfigured || !db) {
    return () => {}
  }

  const docRef = doc(db, 'settings', 'officeTiming')
  const unsubscribe = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        // If snapshot contains stale 17:30 from earlier session, fallback to default 18:00
        const rawEndTime = data.endTime === '17:30' ? DEFAULT_OFFICE_TIMING.endTime : (data.endTime || DEFAULT_OFFICE_TIMING.endTime)
        const config = {
          startTime: data.startTime || DEFAULT_OFFICE_TIMING.startTime,
          endTime: rawEndTime,
          graceMinutes: data.graceMinutes != null ? Number(data.graceMinutes) : DEFAULT_OFFICE_TIMING.graceMinutes,
          workDays: data.workDays || DEFAULT_OFFICE_TIMING.workDays,
          autoCheckout: data.autoCheckout != null ? Boolean(data.autoCheckout) : true,
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null
        }
        liveOfficeTiming = config
        try {
          localStorage.setItem(STORAGE_KEY_OFFICE_TIMING, JSON.stringify(config))
        } catch {}
        callback(config)
      } else {
        callback(getLocalOfficeTiming())
      }
    },
    (err) => {
      console.warn('Office timing settings snapshot warning:', err)
      callback(getLocalOfficeTiming())
    }
  )

  return unsubscribe
}

/**
 * Save office timing configuration to Firestore and localStorage (Admin only)
 */
export async function saveOfficeTimingConfig({ startTime, endTime, graceMinutes, workDays, autoCheckout = true, updatedBy }) {
  const payload = {
    startTime: startTime || '09:00',
    endTime: endTime || '18:00',
    graceMinutes: graceMinutes != null ? Number(graceMinutes) : 30,
    workDays: workDays || 'Mon – Sat',
    autoCheckout: Boolean(autoCheckout),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || 'Admin'
  }

  liveOfficeTiming = payload

  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_TIMING, JSON.stringify(payload))
  } catch {}

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'settings', 'officeTiming')
      await setDoc(
        docRef,
        {
          ...payload,
          serverUpdatedAt: serverTimestamp()
        },
        { merge: true }
      )
    } catch (err) {
      console.warn('Office timing settings save to Firestore warning:', err)
    }
  }
  return payload
}

/**
 * Auto Punch-Out Resolver (6:00 PM cutoff):
 * If an employee checked in but forgot to punch out:
 * - On any past day (e.g. yesterday or earlier), OR
 * - Today once the clock reaches 6:00 PM (or configured shift endTime),
 * automatically marks checkOutTime at 6:00 PM with completed/late status.
 *
 * Per user instruction: No tags, no badges - just plain, standard checkout identical to a manual punchout!
 */
export async function autoResolveRecordIfPastShiftEnd(record, officeTiming) {
  if (!record || !record.id || !record.checkInTime || record.checkOutTime) {
    return false
  }
  if (!isFirebaseConfigured || !db) return false

  const timing = officeTiming || liveOfficeTiming || getLocalOfficeTiming() || DEFAULT_OFFICE_TIMING
  const endTimeStr = timing?.endTime || '18:00' // 6:00 PM default
  const parts = String(endTimeStr).split(':')
  const endH = parseInt(parts[0], 10)
  const endM = parseInt(parts[1], 10)
  const cutoffH = isNaN(endH) ? 18 : endH
  const cutoffM = isNaN(endM) ? 0 : endM
  const cutoffTotalMinutes = cutoffH * 60 + cutoffM

  const now = new Date()
  const todayKeyStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()

  const isPastDay = Boolean(record.date && record.date < todayKeyStr)
  const isTodayPastCutoff = Boolean(record.date === todayKeyStr && currentTotalMinutes >= cutoffTotalMinutes)

  if (isPastDay || isTodayPastCutoff) {
    try {
      const dateParts = String(record.date || todayKeyStr).split('-').map(Number)
      const year = dateParts[0]
      const month = dateParts[1]
      const day = dateParts[2]
      const outDate = new Date(year, month - 1, day, cutoffH, cutoffM, 0)
      const outTimestamp = Timestamp.fromDate(outDate)

      const docRef = doc(db, 'attendance', record.id)
      await updateDoc(docRef, {
        checkOutTime: outTimestamp,
        checkOutPhotoUrl: record.checkOutPhotoUrl || record.checkInSelfieUrl || record.selfieUrl || null,
        checkOutSelfieUrl: record.checkOutSelfieUrl || record.checkInSelfieUrl || record.selfieUrl || null,
        checkOutLocation: record.checkOutLocation || record.checkInLocation || null,
        status: (record.isLate || record.status === 'late') ? 'late' : 'completed',
        updatedAt: serverTimestamp()
      })
      return true
    } catch (err) {
      console.warn('Auto punch-out update warning:', err)
      return false
    }
  }
  return false
}

/**
 * Auto-resolve an array of attendance records in bulk
 */
export async function autoResolveMissingPunchOuts(records = [], officeTiming) {
  if (!Array.isArray(records) || records.length === 0) return 0
  let resolvedCount = 0
  for (const r of records) {
    if (r?.checkInTime && !r?.checkOutTime) {
      const didResolve = await autoResolveRecordIfPastShiftEnd(r, officeTiming)
      if (didResolve) resolvedCount++
    }
  }
  return resolvedCount
}

/**
 * Calculate if a check-in time is late strictly based on the Admin-configured office timing (startTime + graceMinutes)
 * @param {Date|string|number|object} checkInTime - JS Date, ISO string, or Firestore Timestamp
 * @param {object} [officeTiming] - { startTime, graceMinutes } set by Admin
 * @returns {{ isLate: boolean, lateMinutes: number, lateText: string }}
 */
export function checkIsPunchLate(checkInTime, officeTiming) {
  if (!checkInTime) return { isLate: false, lateMinutes: 0, lateText: '' }

  let inDate = null
  if (typeof checkInTime?.toDate === 'function') {
    inDate = checkInTime.toDate()
  } else if (checkInTime instanceof Date) {
    inDate = checkInTime
  } else if (typeof checkInTime === 'string' || typeof checkInTime === 'number') {
    inDate = new Date(checkInTime)
  } else if (checkInTime && typeof checkInTime.seconds === 'number') {
    inDate = new Date(checkInTime.seconds * 1000)
  }

  if (!inDate || isNaN(inDate.getTime())) return { isLate: false, lateMinutes: 0, lateText: '' }

  // Use Admin's configured timing (passed prop, live cache, localStorage, or fallback)
  const timing = officeTiming || liveOfficeTiming || getLocalOfficeTiming() || DEFAULT_OFFICE_TIMING
  const startTimeStr = timing?.startTime || DEFAULT_OFFICE_TIMING.startTime || '09:00'
  const parts = String(startTimeStr).split(':')
  const startH = parseInt(parts[0], 10)
  const startM = parseInt(parts[1], 10)
  const grace = Number(timing?.graceMinutes != null ? timing.graceMinutes : DEFAULT_OFFICE_TIMING.graceMinutes) || 0

  const cutoffTotalMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM) + grace
  const punchTotalMinutes = inDate.getHours() * 60 + inDate.getMinutes()

  if (punchTotalMinutes > cutoffTotalMinutes) {
    const lateMinutes = punchTotalMinutes - cutoffTotalMinutes
    const hours = Math.floor(lateMinutes / 60)
    const mins = lateMinutes % 60
    const lateText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    return { isLate: true, lateMinutes, lateText }
  }

  return { isLate: false, lateMinutes: 0, lateText: '' }
}

/**
 * Evaluates whether an attendance record is marked Late strictly according to the Admin's configured office timings.
 * Whenever checkInTime is present, it ALWAYS calculates dynamically against Admin's timing (startTime + graceMinutes),
 * so that any shift timing changes made by Admin immediately update all statuses across the app.
 * @param {object} rec - Attendance record document
 * @param {object} [officeTiming] - Admin's office timing settings
 * @returns {{ isLate: boolean, lateMinutes: number, lateText: string }}
 */
export function getAttendanceLateInfo(rec, officeTiming) {
  if (!rec) return { isLate: false, lateMinutes: 0, lateText: '' }

  const timing = officeTiming || liveOfficeTiming || getLocalOfficeTiming() || DEFAULT_OFFICE_TIMING

  // 1. Primary: If checkInTime is available, evaluate strictly against Admin's configured timing!
  if (rec.checkInTime) {
    return checkIsPunchLate(rec.checkInTime, timing)
  }

  // 2. Fallback if checkInTime is missing but explicit late info was stored
  if (rec.isLate === true || rec.status === 'late') {
    const mins = Number(rec.lateMinutes) || 0
    if (mins > 0) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return { isLate: true, lateMinutes: mins, lateText: h > 0 ? `${h}h ${m}m` : `${m}m` }
    }
    return { isLate: true, lateMinutes: 0, lateText: 'Late' }
  }

  return { isLate: false, lateMinutes: 0, lateText: '' }
}
