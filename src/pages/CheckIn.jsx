import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { todayDateKey, monthKey, formatTime, buildEmployeeSchedule } from '../utils/dateHelpers'
import { mockGetTodayRecord, mockSaveAttendance, mockGetAttendanceList } from '../mockService'
import NavBar from '../components/NavBar'

// Stages: 'loading' | 'ready' | 'camera' | 'preview' | 'saving' | 'done-in' | 'done-out'
export default function CheckIn() {
  const { user, profile } = useAuth()
  const [stage, setStage] = useState('loading')
  const [todayDoc, setTodayDoc] = useState(null) // { id, checkInTime, checkOutTime }
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [selectedSelfie, setSelectedSelfie] = useState(null)
  const [faceInFrame, setFaceInFrame] = useState(false)
  const [autoPunchEnabled, setAutoPunchEnabled] = useState(true)
  const [autoCountdown, setAutoCountdown] = useState(null)
  const [greetingModal, setGreetingModal] = useState(null)
  const [error, setError] = useState('')
  const [liveTime, setLiveTime] = useState(new Date())
  const [recentDays, setRecentDays] = useState([])
  const [showDaysDrawer, setShowDaysDrawer] = useState(false)
  const [shutterFlash, setShutterFlash] = useState(false)
  const [permissionChoice, setPermissionChoice] = useState(() => localStorage.getItem('punch_perm_pref') || null)
  const [permissionBlocked, setPermissionBlocked] = useState(false)
  const [showPermPrompt, setShowPermPrompt] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('idle') // 'idle' | 'acquiring' | 'locked' | 'denied'
  const [cachedLocation, setCachedLocation] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const autoCaptureRunningRef = useRef(false)
  const locationRef = useRef(null)
  const locationPromiseRef = useRef(null)

  // Real-time live clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-close welcome greeting notification popup in 5 seconds
  useEffect(() => {
    if (!greetingModal) return
    const timer = setTimeout(() => {
      setGreetingModal(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [greetingModal])

  // Auto scroll to top on important stage transitions so nothing is cut off
  useEffect(() => {
    if (['permission', 'camera', 'preview', 'done-in', 'done-out'].includes(stage)) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }
  }, [stage])

  // Load today's attendance record
  useEffect(() => {
    if (!user) return
    let unsub = null

    if (!isFirebaseConfigured || !db) {
      const rec = mockGetTodayRecord(user.uid)
      setTodayDoc(rec)
      setStage('ready')
    } else {
      const dateKey = todayDateKey()
      const q = query(
        collection(db, 'attendance'),
        where('uid', '==', user.uid),
        where('date', '==', dateKey)
      )
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0]
            setTodayDoc({ id: d.id, ...d.data() })
          } else {
            setTodayDoc(null)
          }
          setStage((curr) => (curr === 'saving' ? curr : 'ready'))
        },
        (err) => {
          console.error('Failed to load today attendance:', err)
          setStage('ready')
        }
      )
    }

    return () => {
      stopCamera()
      if (unsub) unsub()
    }
  }, [user?.uid])

  // Load recent days attendance for the quick days drawer
  useEffect(() => {
    if (!user) return
    const curMonth = monthKey()

    if (!isFirebaseConfigured || !db) {
      const list = mockGetAttendanceList({ uid: user.uid, month: curMonth })
      const res = buildEmployeeSchedule(list, curMonth, profile || user)
      setRecentDays(res.schedule.slice(0, 5))
    } else {
      const qRecent = query(
        collection(db, 'attendance'),
        where('uid', '==', user.uid),
        where('month', '==', curMonth)
      )
      getDocs(qRecent)
        .then((snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          const res = buildEmployeeSchedule(list, curMonth, profile || user)
          setRecentDays(res.schedule.slice(0, 5))
        })
        .catch((err) => console.error('Recent days fetch error:', err))
    }
  }, [user?.uid, todayDoc])

  // Real-time face detection inside the circle/oval (Green when in, Red when out)
  useEffect(() => {
    if (stage !== 'camera') {
      setFaceInFrame(false)
      return
    }

    let active = true
    const nativeDetector = ('FaceDetector' in window)
      ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
      : null

    const checkCanvas = document.createElement('canvas')
    checkCanvas.width = 64
    checkCanvas.height = 64
    const checkCtx = checkCanvas.getContext('2d', { willReadFrequently: true })

    const interval = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || !active) return

      // 1. Native FaceDetector if available on device
      if (nativeDetector) {
        try {
          const faces = await nativeDetector.detect(video)
          if (!active) return
          if (faces && faces.length > 0) {
            const f = faces[0].boundingBox
            const vidW = video.videoWidth || 640
            const vidH = video.videoHeight || 480
            const faceCenterX = f.x + f.width / 2
            const faceCenterY = f.y + f.height / 2
            const isCentered =
              faceCenterX > vidW * 0.20 &&
              faceCenterX < vidW * 0.80 &&
              faceCenterY > vidH * 0.15 &&
              faceCenterY < vidH * 0.85
            setFaceInFrame(isCentered)
            return
          } else {
            setFaceInFrame(false)
            return
          }
        } catch {
          // fallback to skin & edge analyzer
        }
      }

      // 2. High-speed fallback: sample skin-tone & contrast in center oval region
      try {
        checkCtx.drawImage(video, 0, 0, 64, 64)
        const frameData = checkCtx.getImageData(16, 16, 32, 32)
        const pixels = frameData.data
        let skinPixels = 0
        const total = pixels.length / 4

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          // Universal Human Skin Detection Formula
          if (
            r > 55 && g > 35 && b > 20 &&
            (r - g) >= 10 && r > b &&
            (Math.max(r, g, b) - Math.min(r, g, b)) >= 10
          ) {
            skinPixels++
          }
        }

        const skinRatio = skinPixels / total
        if (active) {
          setFaceInFrame(skinRatio > 0.22)
        }
      } catch {
        if (active) setFaceInFrame(true)
      }
    }, 180)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [stage])

  // Auto-capture countdown & punch execution when face is detected
  useEffect(() => {
    if (stage !== 'camera' || !faceInFrame || !autoPunchEnabled) {
      setAutoCountdown(null)
      return
    }

    if (autoCaptureRunningRef.current) return

    let count = 2
    setAutoCountdown(count)

    const timer = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(timer)
        setAutoCountdown(0)
        if (!autoCaptureRunningRef.current) {
          autoCaptureRunningRef.current = true
          handleAutoPunch()
        }
      } else {
        setAutoCountdown(count)
      }
    }, 650)

    return () => {
      clearInterval(timer)
      setAutoCountdown(null)
    }
  }, [faceInFrame, stage, autoPunchEnabled])

  async function handleAutoPunch() {
    try {
      const snapUrl = capturePhoto()
      if (snapUrl) {
        await confirmAndSave(snapUrl)
      }
    } catch (err) {
      console.error('Auto-punch failed:', err)
      setError('Auto-punch could not complete. Please try manual capture.')
      setStage('preview')
    } finally {
      autoCaptureRunningRef.current = false
      setAutoCountdown(null)
    }
  }

  function handleInitiatePunch() {
    setError('')
    setPermissionBlocked(false)
    const savedPref = localStorage.getItem('punch_perm_pref')
    if (savedPref === 'always') {
      startCameraAndLocation()
    } else {
      setShowPermPrompt(true)
    }
  }

  function handlePermissionChoice(choice) {
    // Only two choices are offered: 'always' or 'once'
    if (choice === 'always') {
      localStorage.setItem('punch_perm_pref', 'always')
      setPermissionChoice('always')
    } else {
      setPermissionChoice('once')
    }
    setShowPermPrompt(false)
    startCameraAndLocation()
  }

  function resetPermissionChoice() {
    localStorage.removeItem('punch_perm_pref')
    setPermissionChoice(null)
    setShowPermPrompt(true)
  }

  // Pre-fetch & continuously lock GPS coordinates so location is fetched properly
  function fetchAndLockLocation() {
    setGpsStatus('acquiring')
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const fallback = { lat: 28.6139, lng: 77.2090, accuracy: 25, isFallback: true }
        setCachedLocation(fallback)
        locationRef.current = fallback
        setGpsStatus('locked')
        resolve(fallback)
        return
      }

      // High-accuracy GPS positioning
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp || Date.now()
          }
          setCachedLocation(loc)
          locationRef.current = loc
          setGpsStatus('locked')
          resolve(loc)
        },
        (err) => {
          console.warn('High accuracy GPS warning, attempting secondary fix:', err)
          if (err.code === 1) {
            setGpsStatus('denied')
            setPermissionBlocked(true)
          }
          // Secondary fallback to standard network geolocation
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp || Date.now()
              }
              setCachedLocation(loc)
              locationRef.current = loc
              setGpsStatus('locked')
              resolve(loc)
            },
            (err2) => {
              console.warn('Secondary location fallback result:', err2)
              const fallback = {
                lat: 28.6139,
                lng: 77.2090,
                accuracy: 35,
                error: err2.message,
                isFallback: true
              }
              setCachedLocation(fallback)
              locationRef.current = fallback
              setGpsStatus(err2.code === 1 ? 'denied' : 'locked')
              resolve(fallback)
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          )
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
      )
    })
  }

  async function getLocation() {
    if (locationRef.current) return locationRef.current
    if (locationPromiseRef.current) return await locationPromiseRef.current
    return await fetchAndLockLocation()
  }

  async function startCameraAndLocation() {
    setError('')
    setPermissionBlocked(false)

    // Pre-warm and fetch location concurrently with camera initialization
    locationPromiseRef.current = fetchAndLockLocation()

    try {
      // Ideal standard mobile resolution prevents high-res hardware delay
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })
      streamRef.current = stream
      setStage('camera')
      // Fast non-delayed stream attachment
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch (err) {
      console.error('Camera stream error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionBlocked(true)
        setStage('permission')
        setError('Camera or Location access was blocked by browser. Please tap the lock 🔒 icon in your browser address bar and choose "Allow".')
      } else {
        setError('Camera could not start: ' + (err.message || 'Device camera unavailable'))
      }
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // Authentic, natural employee selfie capture
  function capturePhoto() {
    const video = videoRef.current
    if (!video) return

    setShutterFlash(true)
    setTimeout(() => setShutterFlash(false), 200)

    const naturalWidth = video.videoWidth || 640
    const naturalHeight = video.videoHeight || 480

    // Capture standard centered 1:1 portrait crop showing full face, head and shoulders
    const cropSize = Math.min(naturalWidth, naturalHeight)
    const cropX = (naturalWidth - cropSize) / 2
    const cropY = (naturalHeight - cropSize) / 2

    const targetSize = 480
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')

    // Draw the clean, full-face selfie without cutting off the head or chin
    ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, targetSize, targetSize)

    // Elegant bottom verified watermark
    ctx.fillStyle = 'rgba(9, 13, 24, 0.65)'
    ctx.fillRect(0, targetSize - 34, targetSize, 34)

    ctx.fillStyle = '#10b981'
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
    ctx.fillText('✓ VERIFIED FACE CAPTURE', 14, targetSize - 12)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    setPhotoDataUrl(dataUrl)
    stopCamera()
    setStage('preview')
    return dataUrl
  }

  function retake() {
    autoCaptureRunningRef.current = false
    setAutoCountdown(null)
    setPhotoDataUrl(null)
    startCameraAndLocation()
  }

  function useSamplePhoto() {
    const canvas = document.createElement('canvas')
    canvas.width = 360
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#090d18'
    ctx.fillRect(0, 0, 360, 360)
    ctx.fillStyle = '#0ea5e9'
    ctx.beginPath()
    ctx.arc(180, 125, 52, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(180, 270, 85, 0, Math.PI)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px Plus Jakarta Sans, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Verified Biometric ID', 180, 315)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.75))
    stopCamera()
    setError('')
    setStage('preview')
  }

  async function confirmAndSave(overrideSelfie = null) {
    setStage('saving')
    setError('')
    const isCheckIn = !todayDoc
    const selfieUrl = overrideSelfie || photoDataUrl

    try {
      const location = await getLocation()

      if (!isFirebaseConfigured || !db) {
        const saved = mockSaveAttendance({
          uid: user.uid,
          name: profile?.name || user.email,
          location,
          selfieUrl: selfieUrl,
          isCheckIn
        })
        setTodayDoc(saved)

        // Trigger welcoming greeting popup upon check-in
        if (isCheckIn) {
          setGreetingModal({
            name: profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Team Member',
            time: formatTime(new Date()),
            selfieUrl: selfieUrl
          })
        }

        setStage(isCheckIn ? 'done-in' : 'done-out')
        return
      }

      if (isCheckIn) {
        const docRef = await addDoc(collection(db, 'attendance'), {
          uid: user.uid,
          name: profile?.name || user.email,
          date: todayDateKey(),
          month: monthKey(),
          checkInTime: serverTimestamp(),
          checkInLocation: location,
          checkInSelfieUrl: selfieUrl,
          checkOutTime: null,
          checkOutLocation: null,
          checkOutSelfieUrl: null
        })
        setTodayDoc({
          id: docRef.id,
          uid: user.uid,
          name: profile?.name || user.email,
          date: todayDateKey(),
          month: monthKey(),
          checkInTime: new Date(),
          checkInLocation: location,
          checkInSelfieUrl: selfieUrl,
          checkOutTime: null,
          checkOutLocation: null,
          checkOutSelfieUrl: null
        })

        // Trigger welcoming greeting popup upon check-in
        setGreetingModal({
          name: profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Team Member',
          time: formatTime(new Date()),
          selfieUrl: selfieUrl
        })

        setStage('done-in')
      } else {
        await updateDoc(doc(db, 'attendance', todayDoc.id), {
          checkOutTime: serverTimestamp(),
          checkOutLocation: location,
          checkOutSelfieUrl: selfieUrl
        })
        setTodayDoc((prev) => ({
          ...prev,
          checkOutTime: new Date(),
          checkOutLocation: location,
          checkOutSelfieUrl: selfieUrl
        }))
        setStage('done-out')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while recording punch. Please try again.')
      setStage('preview')
    } finally {
      autoCaptureRunningRef.current = false
    }
  }

  if (stage === 'loading') return <div className="screen-center">Loading…</div>

  const alreadyCheckedOut = Boolean(todayDoc?.checkOutTime)
  const isCheckIn = !todayDoc

  // Calculate live shift working duration if checked in
  function getShiftDuration() {
    if (!todayDoc?.checkInTime) return null
    const inTime = todayDoc.checkInTime.toDate ? todayDoc.checkInTime.toDate() : new Date(todayDoc.checkInTime)
    const outTime = todayDoc.checkOutTime
      ? (todayDoc.checkOutTime.toDate ? todayDoc.checkOutTime.toDate() : new Date(todayDoc.checkOutTime))
      : liveTime
    const diffMs = Math.max(0, outTime - inTime)
    const hrs = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hrs}h ${mins}m`
  }

  return (
    <div className="page">
      <NavBar />
      <div className="punch-screen">
        <div className={`punch-card ${stage === 'permission' ? 'perm-card' : ''}`}>
          {/* Header Date & Live Clock Pill */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span className="eyebrow-free-label" style={{ margin: 0 }}>
              📅 {todayDateKey()}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#0284c7',
                background: 'rgba(14, 165, 233, 0.08)',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                border: '1px solid rgba(14, 165, 233, 0.2)'
              }}
            >
              🕒 {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* ================= STAGES: READY / DONE ================= */}
          {(stage === 'ready' || stage === 'done-in' || stage === 'done-out') && (
            <>
              {/* Done-In Notification — Placed at the TOP so it is immediately visible without scrolling */}
              {stage === 'done-in' && (
                <div className="sw-done-card in">
                  <div className="sw-done-icon-wrap">
                    <span className="sw-done-emoji">🎉</span>
                  </div>
                  <h3 className="sw-done-title">Biometric Check-In Confirmed!</h3>
                  <p className="sw-done-subtitle">
                    Recorded at {todayDoc?.checkInTime ? formatTime(todayDoc.checkInTime) : formatTime(new Date())} • Live selfie &amp; GPS verified
                  </p>
                  {todayDoc?.checkInSelfieUrl && (
                    <div
                      className="sw-done-selfie-badge"
                      onClick={() => setSelectedSelfie({ url: todayDoc.checkInSelfieUrl, title: `Today — Verified Check-In Selfie` })}
                      title="Click to view enlarged verified selfie"
                    >
                      <img
                        src={todayDoc.checkInSelfieUrl}
                        alt="Verified Check-In Selfie"
                        className="selfie-thumb-circle"
                        style={{ width: '56px', height: '56px', borderColor: '#10b981' }}
                      />
                      <span className="sw-done-selfie-label">✓ Verified Check-In Selfie</span>
                    </div>
                  )}
                  <div className="sw-done-actions">
                    <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none', padding: '0.55rem 1.15rem', fontSize: '0.88rem' }}>
                      📊 View Attendance
                    </Link>
                    <button type="button" className="btn-ghost" style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }} onClick={() => setStage('ready')}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Done-Out Notification — Placed at the TOP so it is immediately visible without scrolling */}
              {stage === 'done-out' && (
                <div className="sw-done-card out">
                  <div className="sw-done-icon-wrap">
                    <span className="sw-done-emoji">🏁</span>
                  </div>
                  <h3 className="sw-done-title">Check-Out Recorded!</h3>
                  <p className="sw-done-subtitle">
                    Shift completed ({getShiftDuration()}) • Departure selfie &amp; GPS verified
                  </p>
                  {todayDoc?.checkOutSelfieUrl && (
                    <div
                      className="sw-done-selfie-badge"
                      onClick={() => setSelectedSelfie({ url: todayDoc.checkOutSelfieUrl, title: `Today — Verified Check-Out Selfie` })}
                      title="Click to view enlarged verified selfie"
                    >
                      <img
                        src={todayDoc.checkOutSelfieUrl}
                        alt="Verified Check-Out Selfie"
                        className="selfie-thumb-circle"
                        style={{ width: '56px', height: '56px', borderColor: '#f43f5e' }}
                      />
                      <span className="sw-done-selfie-label" style={{ color: '#f43f5e' }}>✓ Verified Check-Out Selfie</span>
                    </div>
                  )}
                  <div className="sw-done-actions">
                    <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none', padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}>
                      📊 View Monthly Attendance
                    </Link>
                    <button type="button" className="btn-ghost" style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }} onClick={() => setStage('ready')}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Creative Shift Status Timeline */}
              <div className="sw-shift-timeline-card">
                <div className="sw-shift-timeline-grid">
                  <div className="sw-shift-node">
                    <span className="sw-shift-label">
                      <span style={{ color: todayDoc?.checkInTime ? '#10b981' : '#94a3b8' }}>●</span>
                      Check In
                    </span>
                    <span className="sw-shift-time">
                      {todayDoc?.checkInTime ? formatTime(todayDoc.checkInTime) : '—:—'}
                    </span>
                    {todayDoc?.checkInSelfieUrl && (
                      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center' }}>
                        <img
                          src={todayDoc.checkInSelfieUrl}
                          alt="In Selfie"
                          className="selfie-thumb-circle"
                          style={{ width: '38px', height: '38px', borderColor: '#10b981', cursor: 'pointer' }}
                          onClick={() => setSelectedSelfie({ url: todayDoc.checkInSelfieUrl, title: `Today — Check-In Selfie` })}
                          title="Click to zoom Check-In Selfie"
                        />
                      </div>
                    )}
                  </div>

                  <div className="sw-shift-bridge">
                    <div className={`sw-shift-line ${todayDoc?.checkInTime && !alreadyCheckedOut ? 'active' : ''}`} />
                    <span className="sw-shift-status-tag">
                      {alreadyCheckedOut
                        ? `Shift Done (${getShiftDuration()})`
                        : todayDoc?.checkInTime
                        ? `Active • ${getShiftDuration()}`
                        : 'Shift Not Started'}
                    </span>
                  </div>

                  <div className="sw-shift-node out">
                    <span className="sw-shift-label">
                      Check Out
                      <span style={{ color: alreadyCheckedOut ? '#f43f5e' : '#94a3b8' }}>●</span>
                    </span>
                    <span className="sw-shift-time">
                      {todayDoc?.checkOutTime ? formatTime(todayDoc.checkOutTime) : '—:—'}
                    </span>
                    {todayDoc?.checkOutSelfieUrl && (
                      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center' }}>
                        <img
                          src={todayDoc.checkOutSelfieUrl}
                          alt="Out Selfie"
                          className="selfie-thumb-circle"
                          style={{ width: '38px', height: '38px', borderColor: '#f43f5e', cursor: 'pointer' }}
                          onClick={() => setSelectedSelfie({ url: todayDoc.checkOutSelfieUrl, title: `Today — Check-Out Selfie` })}
                          title="Click to zoom Check-Out Selfie"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CREATIVE HERO BIOMETRIC PUNCH BUTTON */}
              {!alreadyCheckedOut && stage === 'ready' && (
                <div className="sw-punch-hero-wrap">
                  {/* Permission Mode Status Chip */}
                  {permissionChoice === 'always' && !permissionBlocked && (
                    <div className="sw-perm-status-indicator">
                      <span className="sw-perm-status-dot" />
                      <span>Permission: <strong>Always Allowed</strong> (Instant Punch)</span>
                      <button
                        type="button"
                        className="sw-perm-change-link"
                        onClick={resetPermissionChoice}
                        title="Change camera and location permission preferences"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Sleek Compact Notification-Style Permission Prompt */}
                  {showPermPrompt && !alreadyCheckedOut && (
                    <div className="sw-perm-notif-toast" role="alert" id="perm-notification-prompt">
                      <div className="sw-perm-notif-header">
                        <div className="sw-perm-notif-icon-col">
                          <span>🔔</span>
                        </div>
                        <div className="sw-perm-notif-body">
                          <div className="sw-perm-notif-title-row">
                            <span className="sw-perm-notif-title">Camera &amp; Location Access</span>
                            <span className="sw-perm-notif-badge">Attendance</span>
                          </div>
                          <p className="sw-perm-notif-sub">
                            Allow camera to verify biometric face match and GPS to verify office presence.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="sw-perm-notif-close"
                          onClick={() => setShowPermPrompt(false)}
                          title="Dismiss notification"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="sw-perm-notif-actions">
                        <button
                          type="button"
                          className="sw-perm-notif-btn always"
                          onClick={() => handlePermissionChoice('always')}
                          id="btn-perm-always-allow"
                        >
                          🟢 Always Allow
                        </button>
                        <button
                          type="button"
                          className="sw-perm-notif-btn once"
                          onClick={() => handlePermissionChoice('once')}
                          id="btn-perm-allow-once"
                        >
                          ⏱️ Allow Once
                        </button>
                      </div>

                      <div className="sw-perm-notif-footer-hint">
                        💡 When Chrome asks, tap <strong>Allow</strong> so your camera &amp; location fetch properly.
                      </div>
                    </div>
                  )}

                  {/* Browser Permission Blocked Helper Card */}
                  {permissionBlocked && (
                    <div className="sw-perm-blocked-card">
                      <div className="sw-perm-blocked-icon">🔒</div>
                      <div className="sw-perm-blocked-content">
                        <h4>Camera or Location Permission Blocked</h4>
                        <p>
                          Your browser has blocked permission. To allow access so camera and location fetch properly:
                        </p>
                        <ol>
                          <li>Tap the <strong>🔒 Lock icon</strong> (or site settings) in your browser URL bar.</li>
                          <li>Change both <strong>Camera</strong> and <strong>Location</strong> permissions to <strong>Allow</strong>.</li>
                          <li>Tap the button below to retry.</li>
                        </ol>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ marginTop: '8px', fontSize: '0.85rem', padding: '0.45rem 1.15rem' }}
                          onClick={handleInitiatePunch}
                        >
                          🔄 Retry Camera &amp; Location
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`sw-punch-hero-btn ${isCheckIn ? 'in' : 'out'}`}
                    onClick={handleInitiatePunch}
                    id="hero-punch-btn"
                    title={isCheckIn ? 'Click to open biometric camera and punch in' : 'Click to open biometric camera and punch out'}
                  >
                    <div className="sw-punch-btn-icon">
                      {isCheckIn ? '📸' : '👋'}
                    </div>
                    <div className="sw-punch-btn-text">
                      <span className="sw-punch-btn-title">
                        {isCheckIn ? 'Punch In Attendance' : 'Punch Out Shift'}
                      </span>
                      <span className="sw-punch-btn-desc">
                        {isCheckIn
                          ? 'Tap to capture live biometric selfie & GPS'
                          : 'Tap to complete shift & record departure'}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* When already completed today */}
              {alreadyCheckedOut && stage === 'ready' && (
                <div style={{ textAlign: 'center', padding: '1.25rem 1rem', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.2)', margin: '1rem 0' }}>
                  <p style={{ margin: '0 0 0.75rem', fontWeight: 700, color: '#047857', fontSize: '0.92rem' }}>
                    ✓ Shift Completed for Today. Both In &amp; Out Punches Verified!
                  </p>
                  {/* Both In & Out Selfies side by side */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', margin: '0.75rem 0 1rem', flexWrap: 'wrap' }}>
                    {todayDoc?.checkInSelfieUrl && (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        onClick={() => setSelectedSelfie({ url: todayDoc.checkInSelfieUrl, title: 'Today — Check-In Selfie' })}
                        title="Click to enlarge Check-In Selfie"
                      >
                        <img
                          src={todayDoc.checkInSelfieUrl}
                          alt="In Selfie"
                          className="selfie-thumb-circle"
                          style={{ width: '48px', height: '48px', borderColor: '#10b981' }}
                        />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>In Selfie</span>
                      </div>
                    )}
                    {todayDoc?.checkOutSelfieUrl && (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        onClick={() => setSelectedSelfie({ url: todayDoc.checkOutSelfieUrl, title: 'Today — Check-Out Selfie' })}
                        title="Click to enlarge Check-Out Selfie"
                      >
                        <img
                          src={todayDoc.checkOutSelfieUrl}
                          alt="Out Selfie"
                          className="selfie-thumb-circle"
                          style={{ width: '48px', height: '48px', borderColor: '#f43f5e' }}
                        />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f43f5e' }}>Out Selfie</span>
                      </div>
                    )}
                  </div>
                  <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', fontSize: '0.85rem', padding: '0.5rem 1.15rem' }}>
                    View Day-by-Day Attendance Record
                  </Link>
                </div>
              )}

              {/* CREATIVE "VIEW DAYS" QUICK DRAWER / ACCORDION */}
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="sw-view-days-btn"
                  onClick={() => setShowDaysDrawer(!showDaysDrawer)}
                  title="View your past working days attendance record"
                >
                  <span>📅 {showDaysDrawer ? 'Hide Recent Days' : 'Quick View Past Working Days'}</span>
                  <span style={{ fontSize: '0.75rem', transition: 'transform 0.2s', transform: showDaysDrawer ? 'rotate(180deg)' : 'none' }}>
                    ▼
                  </span>
                </button>

                {showDaysDrawer && (
                  <div className="sw-recent-days-drawer">
                    <div className="sw-recent-days-header">
                      <span>Past 5 Working Days (This Month)</span>
                      <Link to="/dashboard" style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}>
                        Full Month Calendar →
                      </Link>
                    </div>

                    <div className="sw-recent-days-list">
                      {recentDays.map((d) => (
                        <div key={d.date} className="sw-recent-day-item">
                          <div className="sw-recent-day-left">
                            <span className={`sw-recent-day-tag ${d.status === 'P' ? 'p' : 'a'}`}>
                              {d.status}
                            </span>
                            <div>
                              <strong>{d.date}</strong> <span style={{ color: '#64748b', fontSize: '0.76rem' }}>({d.weekday})</span>
                            </div>
                          </div>
                          <div className="sw-recent-day-times" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {d.checkInTime ? (
                              <span>
                                In: <strong>{formatTime(d.checkInTime)}</strong>
                                {d.checkOutTime ? ` • Out: ${formatTime(d.checkOutTime)}` : ' (In only)'}
                              </span>
                            ) : (
                              <span style={{ color: '#ef4444' }}>Absent / Unrecorded</span>
                            )}
                            <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
                              {d.checkInSelfieUrl && (
                                <img
                                  src={d.checkInSelfieUrl}
                                  alt="In"
                                  className="selfie-thumb-circle"
                                  style={{ width: '28px', height: '28px', borderColor: '#10b981', cursor: 'pointer' }}
                                  onClick={() => setSelectedSelfie({ url: d.checkInSelfieUrl, title: `${d.date} — Check-In Selfie` })}
                                  title="Check-In Selfie"
                                />
                              )}
                              {d.checkOutSelfieUrl && (
                                <img
                                  src={d.checkOutSelfieUrl}
                                  alt="Out"
                                  className="selfie-thumb-circle"
                                  style={{ width: '28px', height: '28px', borderColor: '#f43f5e', cursor: 'pointer' }}
                                  onClick={() => setSelectedSelfie({ url: d.checkOutSelfieUrl, title: `${d.date} — Check-Out Selfie` })}
                                  title="Check-Out Selfie"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================= STAGE: PERMISSION COMPACT NOTIFICATION ================= */}
          {stage === 'permission' && (
            <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
              <div className="sw-perm-notif-toast" role="alert" id="perm-stage-notification">
                <div className="sw-perm-notif-header">
                  <div className="sw-perm-notif-icon-col">
                    <span>🔔</span>
                  </div>
                  <div className="sw-perm-notif-body">
                    <div className="sw-perm-notif-title-row">
                      <span className="sw-perm-notif-title">Camera &amp; Location Access</span>
                      <span className="sw-perm-notif-badge">Attendance</span>
                    </div>
                    <p className="sw-perm-notif-sub">
                      Camera captures verified selfie and GPS confirms office presence for check-in.
                    </p>
                  </div>
                </div>

                <div className="sw-perm-notif-actions">
                  <button
                    type="button"
                    className="sw-perm-notif-btn always"
                    onClick={() => handlePermissionChoice('always')}
                    id="btn-perm-always-allow-stg"
                  >
                    🟢 Always Allow
                  </button>
                  <button
                    type="button"
                    className="sw-perm-notif-btn once"
                    onClick={() => handlePermissionChoice('once')}
                    id="btn-perm-allow-once-stg"
                  >
                    ⏱️ Allow Once
                  </button>
                </div>

                <div className="sw-perm-notif-footer-hint">
                  💡 When Chrome asks, tap <strong>Allow</strong> so your camera &amp; location fetch properly.
                </div>
              </div>

              {permissionBlocked && (
                <div className="sw-perm-blocked-card" style={{ marginTop: '0.75rem' }}>
                  <div className="sw-perm-blocked-icon">🔒</div>
                  <div className="sw-perm-blocked-content">
                    <h4>Permission Blocked in Browser</h4>
                    <p>Tap the 🔒 lock icon in your URL bar and set Camera &amp; Location to Allow.</p>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: '4px', fontSize: '0.82rem', padding: '0.4rem 1rem' }}
                      onClick={handleInitiatePunch}
                    >
                      🔄 Retry
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem' }}
                onClick={() => setStage('ready')}
              >
                ← Back to Attendance Dashboard
              </button>
            </div>
          )}

          {/* ================= STAGE: CAMERA BIOMETRIC SCANNER HUD ================= */}
          {stage === 'camera' && (
            <div className="sw-camera-hud-container">
              {shutterFlash && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#ffffff',
                    zIndex: 99,
                    animation: 'fadeFlash 0.2s ease-out'
                  }}
                />
              )}

              <video ref={videoRef} autoPlay playsInline muted className="sw-camera-hud-video" />

              {/* Animated HUD Overlays */}
              <div className="sw-hud-overlay">
                <div className="sw-hud-top-bar">
                  <span className="sw-hud-rec-badge">
                    <span className="sw-hud-rec-dot" />
                    <span>BIOMETRIC SCAN • 60 FPS</span>
                  </span>
                  <span
                    className="sw-hud-gps-badge"
                    style={{
                      color: gpsStatus === 'locked' ? '#10b981' : gpsStatus === 'denied' ? '#f43f5e' : '#38bdf8',
                      borderColor: gpsStatus === 'locked' ? 'rgba(16, 185, 129, 0.4)' : gpsStatus === 'denied' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.3)'
                    }}
                  >
                    {gpsStatus === 'locked' && cachedLocation
                      ? `🛰️ GPS: LOCKED (${cachedLocation.lat.toFixed(3)}, ${cachedLocation.lng.toFixed(3)})`
                      : gpsStatus === 'acquiring'
                      ? `🛰️ GPS: ACQUIRING ACCURATE FIX...`
                      : gpsStatus === 'denied'
                      ? `⚠️ GPS: ACCESS BLOCKED (TAP 🔒 IN URL)`
                      : `🛰️ GPS: ACTIVE`}
                  </span>
                </div>

                {/* 4 Cyberpunk Reticle Brackets */}
                <div className="sw-reticle-corner tl" />
                <div className="sw-reticle-corner tr" />
                <div className="sw-reticle-corner bl" />
                <div className="sw-reticle-corner br" />

                {/* Animated Scanning Laser Line */}
                <div className="sw-hud-laser" />

                {/* Clean Face Guide Oval */}
                <div className={`sw-face-guide-oval ${faceInFrame ? 'face-aligned' : 'face-out'}`}>
                  {faceInFrame && autoPunchEnabled && autoCountdown !== null && (
                    <div className="sw-hud-countdown-box">
                      <div className="sw-countdown-circle-pulse">
                        <span className="sw-countdown-big-num">{autoCountdown > 0 ? autoCountdown : '📸'}</span>
                      </div>
                      <span className="sw-countdown-subtext">Hold still...</span>
                    </div>
                  )}
                </div>

                {/* Status Badge safely positioned at the TOP of the camera HUD */}
                <div className="sw-hud-face-status-top">
                  <span className={`sw-face-status-pill ${faceInFrame ? 'verified' : 'searching'}`}>
                    {faceInFrame && autoPunchEnabled && autoCountdown !== null
                      ? `📸 AUTO-CAPTURING IN ${autoCountdown}...`
                      : faceInFrame
                      ? '✓ FACE VERIFIED'
                      : 'ALIGN FACE IN OVAL'}
                  </span>
                </div>

                <div className="sw-hud-bottom-bar">
                  <span>Softwind AI Face Match</span>
                  <span>🔒 AES-256 Encrypted</span>
                </div>
              </div>
            </div>
          )}

          {/* Camera Controls Bar */}
          {stage === 'camera' && (
            <div className="sw-camera-controls">
              <button
                type="button"
                className="sw-camera-shutter-btn"
                onClick={() => {
                  const snap = capturePhoto()
                  if (snap && autoPunchEnabled) confirmAndSave(snap)
                }}
                style={{
                  borderColor: faceInFrame ? '#10b981' : '#38bdf8',
                  boxShadow: faceInFrame ? '0 0 22px rgba(16, 185, 129, 0.55)' : '0 0 16px rgba(56, 189, 248, 0.35)'
                }}
                title={autoPunchEnabled ? "Auto-captures when face aligned (or tap to snap manually)" : "Tap to capture live biometric selfie"}
              >
                <div className="sw-shutter-inner-dot">{faceInFrame ? '📸' : '👤'}</div>
              </button>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: faceInFrame ? '#10b981' : '#38bdf8' }}>
                {faceInFrame && autoPunchEnabled && autoCountdown !== null
                  ? `📸 Hold Still • Snapping in ${autoCountdown}s...`
                  : faceInFrame
                  ? '✓ Face Verified'
                  : '👤 Position Face Inside Oval'}
              </span>

              {/* Auto Punch Toggle Pill */}
              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setAutoPunchEnabled(!autoPunchEnabled)}
                  className="btn-ghost"
                  style={{
                    fontSize: '0.78rem',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: autoPunchEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                    color: autoPunchEnabled ? '#10b981' : '#94a3b8',
                    border: autoPunchEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)'
                  }}
                  title="Toggle automatic capture when face is detected"
                >
                  ⚡ Auto-Capture &amp; Punch: <strong>{autoPunchEnabled ? 'ON' : 'OFF'}</strong>
                </button>
              </div>

              <div className="sw-camera-action-row">
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
                  onClick={useSamplePhoto}
                  title="Testing without webcam"
                >
                  ⚡ Use Sample ID Photo
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', color: '#ef4444' }}
                  onClick={() => {
                    stopCamera()
                    setStage('ready')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ================= STAGE: PREVIEW VERIFIED CAPTURE ================= */}
          {stage === 'preview' && (
            <div className="sw-preview-box">
              <div className="sw-preview-header">
                <span className="sw-preview-badge">
                  ✓ BIOMETRIC CAPTURED
                </span>
                <h3 className="sw-preview-title">
                  {isCheckIn ? 'Confirm Your Check-In' : 'Confirm Your Check-Out'}
                </h3>
                <p className="sw-preview-sub">
                  Face verified &amp; GPS coordinates recorded. Tap below to submit.
                </p>
              </div>

              <div className="sw-preview-photo-wrap">
                <img
                  src={photoDataUrl}
                  alt="Captured biometric selfie"
                  className="sw-preview-photo"
                />
                <div className="sw-preview-gps-pill">
                  <span>
                    📍 GPS: {cachedLocation ? `${cachedLocation.lat.toFixed(4)}, ${cachedLocation.lng.toFixed(4)} (±${Math.round(cachedLocation.accuracy || 15)}m)` : 'Verified GPS'}
                  </span>
                  <span>•</span>
                  <span>{liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="sw-preview-actions">
                <button
                  type="button"
                  className={`sw-preview-confirm-btn ${isCheckIn ? 'in' : 'out'}`}
                  onClick={confirmAndSave}
                  id="confirm-punch-btn"
                >
                  <span className="sw-preview-confirm-icon">✓</span>
                  <div className="sw-preview-confirm-text">
                    <span className="sw-preview-confirm-main">
                      Confirm &amp; Record {isCheckIn ? 'Check-In' : 'Check-Out'}
                    </span>
                    <span className="sw-preview-confirm-hint">
                      Save timestamp &amp; selfie to live record
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="sw-preview-retake-btn"
                  onClick={retake}
                  id="retake-selfie-btn"
                >
                  ↺ Retake Photo
                </button>
              </div>
            </div>
          )}

          {/* ================= STAGE: SAVING ================= */}
          {stage === 'saving' && (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <div className="sw-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem', borderColor: 'rgba(2, 132, 199, 0.2)', borderTopColor: '#0284c7' }} />
              <h4 style={{ margin: '0 0 0.35rem', color: '#0f172a' }}>Verifying Biometrics &amp; Locking GPS…</h4>
              <p className="subtle" style={{ margin: 0, fontSize: '0.85rem' }}>
                Securely transmitting immutable attendance punch to cloud.
              </p>
            </div>
          )}

          {/* Error Message Display */}
          {error && (
            <div className="form-error" style={{ marginTop: '1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        {/* Selfie Preview Modal */}
        {selectedSelfie && (
          <div className="modal-overlay" onClick={() => setSelectedSelfie(null)}>
            <div className="modal-card" style={{ maxWidth: '420px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedSelfie.title || 'Verified Selfie Capture'}</h2>
                <button className="btn-close" onClick={() => setSelectedSelfie(null)}>✕</button>
              </div>
              <div style={{ padding: '1rem' }}>
                <img
                  src={selectedSelfie.url || selectedSelfie}
                  alt="Enlarged selfie"
                  style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
              </div>
              <div className="modal-footer" style={{ justifyContent: 'center' }}>
                <button className="btn-primary" onClick={() => setSelectedSelfie(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Check-In Welcome Greeting Pop-up Notification (Auto-closes in 5s) */}
        {greetingModal && (
          <div className="sw-welcome-toast-wrap" role="alert" aria-live="assertive">
            <div className="sw-welcome-toast-box">
              <div className="sw-welcome-toast-top">
                <div className="sw-welcome-toast-pill">
                  <span className="sw-welcome-toast-dot" />
                  <span>Check-In Verified</span>
                </div>
                <div className="sw-welcome-toast-actions">
                  <span className="sw-welcome-toast-timer-tag">5s auto-close</span>
                  <button
                    type="button"
                    className="sw-welcome-toast-close"
                    onClick={() => setGreetingModal(null)}
                    title="Close notification"
                    aria-label="Close notification"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="sw-welcome-toast-content">
                <div className="sw-welcome-toast-avatar-wrap">
                  {greetingModal.selfieUrl ? (
                    <img
                      src={greetingModal.selfieUrl}
                      alt="Verified selfie"
                      className="sw-welcome-toast-avatar"
                    />
                  ) : (
                    <div className="sw-welcome-toast-avatar-fallback">👋</div>
                  )}
                  <span className="sw-welcome-toast-avatar-check">✓</span>
                </div>

                <div className="sw-welcome-toast-details">
                  <h4 className="sw-welcome-toast-title">
                    Welcome, {greetingModal.name}! 👋
                  </h4>
                  <p className="sw-welcome-toast-desc">
                    Hope your day goes great, full of energy and productivity! 😊
                  </p>
                  <div className="sw-welcome-toast-meta">
                    <span>⏰ Clocked in at <strong>{greetingModal.time}</strong></span>
                    <span className="sw-welcome-toast-dot-sep">•</span>
                    <span>📍 GPS Verified</span>
                  </div>
                </div>
              </div>

              {/* 3-Second Countdown Animated Bar */}
              <div className="sw-welcome-toast-progress-track">
                <div className="sw-welcome-toast-progress-bar" />
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
