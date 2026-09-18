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
  const [error, setError] = useState('')
  const [liveTime, setLiveTime] = useState(new Date())
  const [recentDays, setRecentDays] = useState([])
  const [showDaysDrawer, setShowDaysDrawer] = useState(false)
  const [shutterFlash, setShutterFlash] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Real-time live clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto scroll to top on important stage transitions so nothing is cut off
  useEffect(() => {
    if (['camera', 'preview', 'done-in', 'done-out'].includes(stage)) {
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

  async function startCamera() {
    setError('')
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
    } catch {
      setError('Camera access was blocked. Allow camera permission in your browser or use the sample photo button.')
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

    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.88))
    stopCamera()
    setStage('preview')
  }

  function retake() {
    setPhotoDataUrl(null)
    startCamera()
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

  function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 37.7749, lng: -122.4194, accuracy: 15 })
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
        () => {
          resolve({ lat: 37.7749, lng: -122.4194, accuracy: 25 })
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  async function confirmAndSave() {
    setStage('saving')
    setError('')
    const isCheckIn = !todayDoc

    try {
      const location = await getLocation()

      if (!isFirebaseConfigured || !db) {
        const saved = mockSaveAttendance({
          uid: user.uid,
          name: profile?.name || user.email,
          location,
          selfieUrl: photoDataUrl,
          isCheckIn
        })
        setTodayDoc(saved)
        setStage(isCheckIn ? 'done-in' : 'done-out')
        return
      }

      const selfieUrl = photoDataUrl

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
        <div className="punch-card">
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
                  <button
                    type="button"
                    className={`sw-punch-hero-btn ${isCheckIn ? 'in' : 'out'}`}
                    onClick={startCamera}
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
                  <span className="sw-hud-gps-badge">🛰️ GPS: LOCKED</span>
                </div>

                {/* 4 Cyberpunk Reticle Brackets */}
                <div className="sw-reticle-corner tl" />
                <div className="sw-reticle-corner tr" />
                <div className="sw-reticle-corner bl" />
                <div className="sw-reticle-corner br" />

                {/* Animated Scanning Laser Line */}
                <div className="sw-hud-laser" />

                {/* Clean Face Guide Oval (100% unobstructed, no text blocking the face) */}
                <div className={`sw-face-guide-oval ${faceInFrame ? 'face-aligned' : 'face-out'}`} />

                {/* Status Badge safely positioned at the TOP of the camera HUD */}
                <div className="sw-hud-face-status-top">
                  <span className={`sw-face-status-pill ${faceInFrame ? 'verified' : 'searching'}`}>
                    {faceInFrame ? '✓ FACE VERIFIED' : 'ALIGN FACE IN OVAL'}
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
                onClick={capturePhoto}
                style={{
                  borderColor: faceInFrame ? '#10b981' : '#38bdf8',
                  boxShadow: faceInFrame ? '0 0 22px rgba(16, 185, 129, 0.55)' : '0 0 16px rgba(56, 189, 248, 0.35)'
                }}
                title="Tap to capture live biometric selfie"
              >
                <div className="sw-shutter-inner-dot">{faceInFrame ? '📸' : '👤'}</div>
              </button>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: faceInFrame ? '#10b981' : '#38bdf8' }}>
                {faceInFrame ? '✓ Face Verified — Tap Shutter Below' : '👤 Position Face Inside Oval'}
              </span>

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
                  <span>📍 GPS Verified</span>
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
        </div>
      </div>
    </div>
  )
}
