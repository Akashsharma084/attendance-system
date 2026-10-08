import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
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
 * Get current browser GPS location with Promise
 */
export function getCurrentGpsCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'))
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        })
      },
      (err) => {
        reject(err)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}

/**
 * Read cached or fallback office geofence settings from localStorage
 */
export function getLocalOfficeNetwork() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_GEOFENCE)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        latitude: parsed.latitude != null ? Number(parsed.latitude) : null,
        longitude: parsed.longitude != null ? Number(parsed.longitude) : null,
        radiusMeters: parsed.radiusMeters ? Number(parsed.radiusMeters) : 100,
        officeAddress: parsed.officeAddress || '',
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_OFFICE_GEOFENCE }
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
        const config = {
          latitude: data.latitude != null ? Number(data.latitude) : null,
          longitude: data.longitude != null ? Number(data.longitude) : null,
          radiusMeters: data.radiusMeters ? Number(data.radiusMeters) : 100,
          officeAddress: data.officeAddress || '',
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
  const payload = {
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    radiusMeters: radiusMeters ? Number(radiusMeters) : 100,
    officeAddress: (officeAddress || '').trim(),
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
