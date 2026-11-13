/**
 * SWL Device Binding Service
 * Enforces 1 Employee = 1 Dedicated Personal Phone Policy using Phone Model Name & Hardware Model ID.
 * Even if Chrome data/cookies are cleared, the physical phone's Hardware Model ID
 * recognizes the same phone and prevents false-positive lockouts, while strictly blocking other devices.
 */

const STORAGE_DEVICE_ID = 'swl_device_id'
const STORAGE_BOUND_UID = 'swl_bound_user_uid'
const STORAGE_BOUND_EMAIL = 'swl_bound_user_email'
const STORAGE_BOUND_NAME = 'swl_bound_user_name'

/**
 * Extracts GPU WebGL Renderer hardware info
 */
function getGpuRenderer() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'generic_gpu'
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return 'no_webgl'
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'generic_gpu'
    }
  } catch {}
  return 'generic_gpu'
}

/**
 * Detects human-friendly Phone Model Name & Brand
 */
export function detectPhoneModel() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { modelName: 'Unknown Phone', brand: 'Unknown', modelCode: '' }
  }

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''

  let brand = 'Mobile'
  let modelCode = ''

  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    brand = 'Apple iPhone'
    const w = window.screen?.width || 0
    const h = window.screen?.height || 0
    const ratio = window.devicePixelRatio || 1
    modelCode = `${w}x${h}@${ratio}x`
  } else if (/Android/.test(ua)) {
    const match = ua.match(/;\s*([^;]+?)\s*(?:Build|\))/i)
    if (match && match[1]) {
      modelCode = match[1].trim()
    }

    if (/Samsung|SM-|GT-/i.test(ua) || /SM-/i.test(modelCode)) {
      brand = 'Samsung Galaxy'
    } else if (/Pixel/i.test(ua) || /Pixel/i.test(modelCode)) {
      brand = 'Google Pixel'
    } else if (/OnePlus/i.test(ua) || /ONEPLUS|CPH/i.test(modelCode)) {
      brand = 'OnePlus'
    } else if (/Redmi|POCO|Xiaomi|220|210/i.test(ua) || /Redmi|Xiaomi|POCO/i.test(modelCode)) {
      brand = 'Xiaomi/Redmi'
    } else if (/Vivo|V2/i.test(ua) || /V20/i.test(modelCode)) {
      brand = 'Vivo'
    } else if (/Oppo/i.test(ua)) {
      brand = 'Oppo'
    } else if (/Realme|RMX/i.test(ua) || /RMX/i.test(modelCode)) {
      brand = 'Realme'
    } else {
      brand = 'Android Phone'
    }
  } else if (/Windows/i.test(ua)) {
    brand = 'Windows PC'
    modelCode = 'Desktop'
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    brand = 'Apple Mac'
    modelCode = 'Desktop'
  } else {
    brand = 'Workstation'
    modelCode = 'Linux'
  }

  // Clean formatted name e.g. "Samsung Galaxy (SM-G991B)" or "Apple iPhone"
  const fullName = modelCode && modelCode !== 'Desktop' ? `${brand} (${modelCode})` : brand
  return { modelName: fullName, brand, modelCode }
}

/**
 * Backward compatibility alias for detectPhoneModel
 */
export function detectDeviceName() {
  return detectPhoneModel().modelName
}

/**
 * Generates physical Hardware Model ID that survives Chrome data clearing.
 * Uses immutable hardware signatures: Screen Resolution, Pixel Ratio, GPU Renderer, CPU Cores, Timezone.
 */
export function getHardwareModelId() {
  if (typeof window === 'undefined') return 'hw_server'

  const phone = detectPhoneModel()
  const gpu = getGpuRenderer()
  const screenSpec = `${window.screen?.width || 0}x${window.screen?.height || 0}@${window.devicePixelRatio || 1}`
  const cores = navigator.hardwareConcurrency || 1
  const tz = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || 'UTC'

  const raw = `${phone.modelName}|${gpu}|${screenSpec}|${cores}|${tz}`

  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'hw_' + Math.abs(hash).toString(36)
}

/**
 * Alias for backward compatibility
 */
export function getHardwareFingerprint() {
  return getHardwareModelId()
}

/**
 * Gets or creates local device UUID
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'unknown_device'

  let deviceId = localStorage.getItem(STORAGE_DEVICE_ID)
  if (!deviceId) {
    const randomHex = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)
    deviceId = `swl_dev_${randomHex}`
    try {
      localStorage.setItem(STORAGE_DEVICE_ID, deviceId)
    } catch {}
  }
  return deviceId
}

/**
 * Returns comprehensive device & hardware details
 */
export function getDeviceDetails() {
  const deviceId = getOrCreateDeviceId()
  const hardwareModelId = getHardwareModelId()
  const phone = detectPhoneModel()

  return {
    deviceId,
    hardwareModelId,
    deviceFingerprint: hardwareModelId,
    deviceName: phone.modelName,
    phoneModel: phone.modelName,
    modelCode: phone.modelCode,
    isMobile: typeof navigator !== 'undefined' ? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) : false
  }
}

/**
 * Validates device binding against user profile & local phone records.
 * 
 * Auto-recovery on Chrome Data Clear:
 * If Chrome localStorage was cleared, deviceId changes, but hardwareModelId + phoneModelName
 * prove it is the EXACT SAME physical phone. The system smoothly restores binding without blocking!
 * If both deviceId and hardwareModelId mismatch -> Different phone/laptop -> STRICTLY BLOCKED!
 */
export function validateAndBindEmployeeDevice(user, profileDoc, isAdmin = false) {
  // Admins can log in from any authorized terminal/computer
  if (isAdmin) {
    return { isAllowed: true, deviceData: getDeviceDetails(), isAdmin: true }
  }

  const currentDevice = getDeviceDetails()
  const currentUid = user.uid
  const currentEmail = user.email || ''

  // RULE 1: Check if this physical phone is locally locked to ANOTHER employee
  const localBoundUid = localStorage.getItem(STORAGE_BOUND_UID)
  const localBoundEmail = localStorage.getItem(STORAGE_BOUND_EMAIL)
  const localBoundName = localStorage.getItem(STORAGE_BOUND_NAME)

  if (localBoundUid && localBoundUid !== currentUid) {
    const owner = localBoundName || localBoundEmail || 'dusre employee'
    throw new Error(
      `❌ Shared Device Blocked: Yeh phone pehle se "${owner}" ke account se linked hai. Ek hi phone se 2 ya 3 logo ka login allow nahi hai.`
    )
  }

  // RULE 2: Check database binding
  const existingDeviceId = profileDoc?.boundDeviceId
  const existingHardwareId = profileDoc?.boundHardwareModelId || profileDoc?.boundDeviceFingerprint
  const existingDeviceName = profileDoc?.boundDeviceName || 'Registered Phone'

  if (existingDeviceId || existingHardwareId) {
    const isSameUuid = Boolean(existingDeviceId && existingDeviceId === currentDevice.deviceId)
    const isSameHardware = Boolean(existingHardwareId && existingHardwareId === currentDevice.hardwareModelId)

    // If both UUID and Hardware ID mismatch -> COMPLETELY DIFFERENT DEVICE!
    if (!isSameUuid && !isSameHardware) {
      throw new Error(
        `❌ Device Mismatch: Aapka account [${existingDeviceName}] ke saath locked hai. Kisi doosre phone ya laptop se attendance allow nahi hai. Agar phone change hua hai toh Admin ko request karein.`
      )
    }

    // If Hardware matches but local UUID was wiped -> User cleared Chrome data!
    // Auto-heal and restore binding smoothly without bothering Admin!
    const isRestoredAfterClear = !isSameUuid && isSameHardware

    try {
      localStorage.setItem(STORAGE_BOUND_UID, currentUid)
      localStorage.setItem(STORAGE_BOUND_EMAIL, currentEmail)
      localStorage.setItem(STORAGE_BOUND_NAME, profileDoc?.name || user.displayName || currentEmail.split('@')[0])
    } catch {}

    return {
      isAllowed: true,
      isNewBinding: isRestoredAfterClear,
      deviceData: currentDevice,
      recoveredFromDataClear: isRestoredAfterClear
    }
  }

  // First time registration on this phone: Lock device
  try {
    localStorage.setItem(STORAGE_BOUND_UID, currentUid)
    localStorage.setItem(STORAGE_BOUND_EMAIL, currentEmail)
    localStorage.setItem(STORAGE_BOUND_NAME, profileDoc?.name || user.displayName || currentEmail.split('@')[0])
  } catch {}

  return {
    isAllowed: true,
    isNewBinding: true,
    deviceData: currentDevice
  }
}

/**
 * Clears local binding for current device (e.g. after authorized admin reset)
 */
export function clearLocalDeviceBinding() {
  try {
    localStorage.removeItem(STORAGE_BOUND_UID)
    localStorage.removeItem(STORAGE_BOUND_EMAIL)
    localStorage.removeItem(STORAGE_BOUND_NAME)
  } catch {}
}
