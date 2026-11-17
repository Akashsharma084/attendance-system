import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as secondarySignOut,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail
} from 'firebase/auth'
import { db, auth, isFirebaseConfigured, firebaseConfig } from '../firebase'
import { useAuth, checkIsAdminEmail } from '../context/AuthContext'
import { getOrCreateDeviceId, detectDeviceName, getDeviceDetails, getHardwareModelId, detectPhoneModel } from '../services/deviceService'
import { useNotifications } from '../context/NotificationContext'
import InAppArrivalToast from './InAppArrivalToast'
import { Icons as BaseIcons } from './SWLDesignShowcase'
import './SWLDesignShowcase.css'

export function isUserAdmin(u) {
  if (!u) return false
  const email = (u.email || '').toLowerCase().trim()

  // Compare by Email:
  // Employee Jai: jai@softwindlabs.com -> Employee
  if (email === 'jai@softwindlabs.com') return false

  // Admin Jai Chaturvedi: admin@softwindlabs.com / jai.chaturvedi@softwindlabs.com -> Admin
  return (
    email === 'admin@softwindlabs.com' ||
    email === 'jai.chaturvedi@softwindlabs.com' ||
    email.startsWith('admin@') ||
    checkIsAdminEmail(email) ||
    (u.role || '').toLowerCase().trim() === 'admin' ||
    u.isAdmin === true
  )
}

const Icons = {
  ...BaseIcons,
  Eye: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Mail: BaseIcons.Mail || (() => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )),
  Document: BaseIcons.Document || (() => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ))
}
import { todayDateKey, monthKey, formatTime, buildEmployeeSchedule } from '../utils/dateHelpers'
import {
  subscribeLeaves,
  submitLeaveRequest,
  reviewLeaveRequest,
  cancelLeaveRequest,
  deleteLeaveRequest,
  clearLeaveRecords
} from '../services/leaveService'
import {
  subscribeOfficeNetworkConfig,
  checkGeofence,
  saveOfficeNetworkConfig,
  getCurrentGpsCoordinates,
  watchGpsCoordinates,
  subscribeOfficeTimingConfig,
  saveOfficeTimingConfig,
  formatTime24to12,
  DEFAULT_OFFICE_TIMING,
  checkIsPunchLate,
  getAttendanceLateInfo,
  getLocalOfficeTiming
} from '../services/networkService'

const DEFAULT_AVATARS = {
  rahul: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&h=400&q=80',
  amit: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
  neha: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80',
  rohit: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&h=400&q=80',
  pooja: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80',
  sahil: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400&q=80',
  anjali: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80'
}

/**
 * Optimizes an image file (camera or gallery) to a clean, fast-loading base64 data URL.
 */
function processImageFile(file, maxWidth = 350, maxHeight = 350, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'))
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (JPG, PNG, WebP).'))
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Failed to parse image file.'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Triggers an immediate purge of Service Worker caches and reloads the app.
 */
export async function triggerAppUpdateReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) {
        await r.update().catch(() => {})
        if (r.waiting) {
          r.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      }
    }
    setTimeout(() => {
      window.location.reload(true)
    }, 200)
  } catch (_) {
    window.location.reload()
  }
}

function AppUpdateSyncButton({ label = 'Check for Updates & Reload App', style = {} }) {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    await triggerAppUpdateReload()
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      style={{
        background: '#EEF4FF',
        color: '#1E5AE6',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: syncing ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all 0.15s ease',
        ...style
      }}
      title="Check for newest server updates, clear cache and reload application"
    >
      <span>{syncing ? '⏳' : '🔄'}</span>
      <span>{syncing ? 'Updating App...' : label}</span>
    </button>
  )
}

/* Reusable Universal User Avatar (Shows Photo if uploaded, otherwise First Letter of Name) */
function UserAvatar({
  name = 'User',
  photoURL = null,
  size = 40,
  fontSize,
  style = {},
  onClick,
  title,
  border = 'none'
}) {
  const safeName = (typeof name === 'string' && name.trim()) ? name.trim() : 'User'
  const letter = safeName.charAt(0).toUpperCase()

  // Elegant distinct gradients based on the character code
  const colorGradients = [
    'linear-gradient(135deg, #2563EB, #1D4ED8)', // Deep Blue (A, I, Q, Y)
    'linear-gradient(135deg, #059669, #047857)', // Emerald Green (B, J, R, Z)
    'linear-gradient(135deg, #7C3AED, #5B21B6)', // Purple (C, K, S)
    'linear-gradient(135deg, #D97706, #B45309)', // Amber/Gold (D, L, T)
    'linear-gradient(135deg, #DB2777, #9D174D)', // Rose (E, M, U)
    'linear-gradient(135deg, #0891B2, #0E7490)', // Teal/Cyan (F, N, V)
    'linear-gradient(135deg, #EA580C, #C2410C)', // Orange (G, O, W)
    'linear-gradient(135deg, #4F46E5, #3730A3)'  // Indigo (H, P, X)
  ]
  const charCode = (letter.charCodeAt(0) || 0)
  const bg = colorGradients[charCode % colorGradients.length]

  if (photoURL && typeof photoURL === 'string' && (photoURL.startsWith('http') || photoURL.startsWith('data:image'))) {
    return (
      <img
        src={photoURL}
        alt={safeName}
        title={title || safeName}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: border,
          cursor: onClick ? 'pointer' : 'default',
          display: 'block',
          flexShrink: 0,
          ...style
        }}
      />
    )
  }

  const calcFontSize = fontSize || `${Math.max(12, Math.round(size * 0.44))}px`

  return (
    <div
      title={title || safeName}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: calcFontSize,
        fontWeight: 800,
        textTransform: 'uppercase',
        userSelect: 'none',
        border: border,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
        letterSpacing: '-0.02em',
        ...style
      }}
    >
      {letter}
    </div>
  )
}

/* Reusable Selfie Thumbnail with Click-to-Zoom */
function SelfieThumb({ url, onClick, title, size = 36 }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt={title || 'Selfie'}
      title={title || 'Click to view full photo'}
      className="swl-selfie-thumb"
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #10B981', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        onClick && onClick()
      }}
    />
  )
}

/* Reusable Pair of Check-In & Check-Out Selfie Thumbnails */
function SelfiePairThumbs({
  inUrl,
  outUrl,
  onViewSelfie,
  date,
  name,
  inLoc,
  outLoc,
  inTime,
  outTime,
  size = 32
}) {
  if (!inUrl && !outUrl) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {inUrl && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={inUrl}
            alt="Check-In Selfie"
            title={`${name || 'Employee'} — Check-In Selfie (Click to Zoom)`}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #10B981',
              cursor: 'pointer',
              display: 'block'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onViewSelfie &&
                onViewSelfie({
                  photoUrl: inUrl,
                  name: `${name || 'Employee'} (Check-In)`,
                  date,
                  time: inTime,
                  location: inLoc
                })
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              background: '#10B981',
              color: '#FFFFFF',
              fontSize: '0.48rem',
              fontWeight: 800,
              padding: '1px 3px',
              borderRadius: 3,
              lineHeight: 1
            }}
          >
            IN
          </span>
        </div>
      )}
      {outUrl && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={outUrl}
            alt="Check-Out Selfie"
            title={`${name || 'Employee'} — Check-Out Selfie (Click to Zoom)`}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #F59E0B',
              cursor: 'pointer',
              display: 'block'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onViewSelfie &&
                onViewSelfie({
                  photoUrl: outUrl,
                  name: `${name || 'Employee'} (Check-Out)`,
                  date,
                  time: outTime,
                  location: outLoc
                })
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              background: '#F59E0B',
              color: '#FFFFFF',
              fontSize: '0.48rem',
              fontWeight: 800,
              padding: '1px 3px',
              borderRadius: 3,
              lineHeight: 1
            }}
          >
            OUT
          </span>
        </div>
      )}
    </div>
  )
}

/* Reusable Check Location Link Button (Hidden per user request across all profiles) */
function LocationBtn() {
  return null
}

/* Live Team Arrivals Modal (Bell Notification Feed) */
function LiveArrivalsModal({ onClose, onViewSelfie }) {
  const { user, profile } = useAuth()
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearAllNotifications,
    pushPermission,
    requestPushPermission,
    triggerArrivalAlert
  } = useNotifications()

  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead()
    }
  }, [unreadCount, markAllAsRead])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 99990,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: 16,
          maxWidth: 420,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          marginTop: '36px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img
              src="/softwind-logo.png"
              alt="Softwind Labs Logo"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                objectFit: 'contain',
                background: '#FFFFFF',
                padding: '2px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}
            />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Softwind Labs • Live Activity Feed
              </h4>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748B' }}>
                {notifications.length} live update{notifications.length === 1 ? '' : 's'} recorded today
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                border: 'none',
                width: 28,
                height: 28,
                borderRadius: '50%',
                fontSize: '0.85rem',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Pop-up Alert Action */}
        {pushPermission !== 'granted' && typeof window !== 'undefined' && 'Notification' in window && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={requestPushPermission}
              style={{
                flex: 1,
                background: '#1E5AE6',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              🔔 Allow Pop-up Alerts
            </button>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94A3B8' }}>
              <div style={{ fontSize: '2rem', marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>No Arrival Alerts Yet</div>
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>
                You will be notified in real-time as colleagues punch in or out!
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: n.read ? '#FFFFFF' : '#F0FDF4',
                  border: `1px solid ${n.read ? '#E2E8F0' : '#BBF7D0'}`,
                  borderRadius: 12,
                  padding: '9px 11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {n.photoUrl ? (
                    <SelfieThumb
                      url={n.photoUrl}
                      title={`${n.name}'s arrival selfie`}
                      onClick={() =>
                        onViewSelfie &&
                        onViewSelfie({
                          photoUrl: n.photoUrl,
                          name: n.name,
                          date: todayDateKey(),
                          time: n.time
                        })
                      }
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#EEF4FF',
                        color: '#1E5AE6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 800
                      }}
                    >
                      {n.name?.[0] || 'U'}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                      {n.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      {n.message || (n.type === 'out' ? `Check-out ${n.time}` : `Check-in ${n.time}`)}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background: n.type === 'out' ? '#FEF3C7' : '#DCFCE7',
                    color: n.type === 'out' ? '#B45309' : '#15803D',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 999
                  }}
                >
                  {n.type === 'out' ? 'Departure' : 'Arrival'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* Global Selfie Zoom Modal with Location & Employee Metadata */
function LiveSelfieZoomModal({ selfie, onClose }) {
  if (!selfie) return null
  const lat = selfie.location?.latitude ?? selfie.location?.lat
  const lng = selfie.location?.longitude ?? selfie.location?.lng
  const hasCoords = lat != null && lng != null
  const gmapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: 18,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
              {selfie.name || 'Punch Selfie Preview'}
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748B' }}>
              {selfie.date || ''} {selfie.time ? `• ${selfie.time}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F1F5F9',
              width: 28,
              height: 28,
              borderRadius: '50%',
              fontSize: '0.9rem',
              cursor: 'pointer',
              color: '#64748B'
            }}
          >
            ✕
          </button>
        </div>

        <img
          src={selfie.photoUrl}
          alt="Punch Selfie Zoom"
          style={{
            width: '100%',
            maxHeight: '340px',
            borderRadius: 14,
            objectFit: 'cover',
            border: '1px solid #E2E8F0'
          }}
        />

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              color: '#475569',
              border: 'none',
              borderRadius: 10,
              padding: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}


function playPunchChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.22)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.12)
    gain2.gain.setValueAtTime(0.18, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.45)
  } catch (e) {
    // Audio autoplay restrictions
  }
}

export default function SWLLiveMasterApp() {
  const { user, profile, isAdmin, login, loginWithGoogle, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Active screen state matching showcase names:
  // Employee: 'emp_home' | 'emp_checkin' | 'emp_history' | 'emp_leave' | 'emp_profile'
  // Admin: 'adm_dashboard' | 'adm_employees' | 'adm_details' | 'adm_approvals' | 'adm_reports' | 'adm_profile'
  const [activeScreen, setActiveScreen] = useState(() => {
    if (!user) return 'login'
    if (isAdmin) return 'adm_dashboard'
    return 'emp_home'
  })

  // Selected employee for admin details drill-down
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [empDetailOrigin, setEmpDetailOrigin] = useState('adm_employees')

  // Top-level Selfie Zoom Preview Modal
  const [selectedSelfieModal, setSelectedSelfieModal] = useState(null)

  // Office Geofence & Timing Configuration
  const [officeConfig, setOfficeConfig] = useState(null)
  const [officeTiming, setOfficeTiming] = useState(() => getLocalOfficeTiming())
  const [showGeofenceModal, setShowGeofenceModal] = useState(false)
  const [showTimingModal, setShowTimingModal] = useState(false)
  const [adminAttendanceModal, setAdminAttendanceModal] = useState(null)

  // Real-time listener for office geofence & timing settings
  useEffect(() => {
    const unsubGeo = subscribeOfficeNetworkConfig((cfg) => {
      setOfficeConfig(cfg)
    })
    const unsubTiming = subscribeOfficeTimingConfig((t) => {
      setOfficeTiming(t)
    })
    return () => {
      if (unsubGeo) unsubGeo()
      if (unsubTiming) unsubTiming()
    }
  }, [])

  const SCREEN_PATH_MAP = {
    emp_home: '/',
    emp_checkin: '/checkin',
    emp_history: '/history',
    emp_leave: '/leaves',
    emp_profile: '/profile',
    adm_dashboard: '/admin',
    adm_employees: '/admin/employees',
    adm_details: '/admin/employees',
    adm_approvals: '/admin/leaves',
    adm_reports: '/admin/reports',
    adm_profile: '/admin/profile'
  }

  // Punch mode state for guarded check-in vs check-out navigation: 'auto' | 'checkin' | 'checkout' | 'status'
  const [punchMode, setPunchMode] = useState('auto')

  // Strictly role-isolated navigation handler with browser history tracking
  const handleNavigate = (targetScreen, pushHistory = true, options = {}) => {
    if (!user) {
      setActiveScreen('login')
      return
    }
    let validScreen = targetScreen
    if (isAdmin) {
      // Administrator is strictly restricted to administrator screens
      if (targetScreen.startsWith('emp_')) {
        console.warn('Admin account cannot access employee screens:', targetScreen)
        validScreen = 'adm_dashboard'
      }
    } else {
      // Employee is strictly restricted to employee screens
      if (targetScreen.startsWith('adm_')) {
        console.warn('Employee account cannot access admin screens:', targetScreen)
        validScreen = 'emp_home'
      }
    }

    if (options && options.punchMode) {
      setPunchMode(options.punchMode)
    } else {
      setPunchMode('auto')
    }

    setActiveScreen(validScreen)

    if (pushHistory && typeof window !== 'undefined') {
      try {
        const path = SCREEN_PATH_MAP[validScreen] || '/'
        window.history.pushState({ app: 'swl', screen: validScreen, time: Date.now() }, '', path)
      } catch (_) {}
    }
  }

  // Intercept Browser & Hardware Back Button so the app NEVER disappears or exits
  useEffect(() => {
    if (authLoading || !user) return

    // 1. Ensure initial history state is anchored to SWL App
    try {
      if (!window.history.state || window.history.state?.app !== 'swl') {
        const curPath = SCREEN_PATH_MAP[activeScreen] || location.pathname || '/'
        window.history.replaceState({ app: 'swl', screen: activeScreen, root: true }, '', curPath)
      }
    } catch (_) {}

    const onPopState = (event) => {
      // Priority 1: If any full-screen Modal is open, close the modal and stay on screen!
      if (selectedSelfieModal) {
        setSelectedSelfieModal(null)
        try {
          window.history.pushState({ app: 'swl', screen: activeScreen }, '', SCREEN_PATH_MAP[activeScreen] || '/')
        } catch (_) {}
        return
      }
      if (showGeofenceModal) {
        setShowGeofenceModal(false)
        try {
          window.history.pushState({ app: 'swl', screen: activeScreen }, '', SCREEN_PATH_MAP[activeScreen] || '/')
        } catch (_) {}
        return
      }
      if (showTimingModal) {
        setShowTimingModal(false)
        try {
          window.history.pushState({ app: 'swl', screen: activeScreen }, '', SCREEN_PATH_MAP[activeScreen] || '/')
        } catch (_) {}
        return
      }

      // Priority 2: If on Admin Employee Details view, go back to Employees list
      if (activeScreen === 'adm_details') {
        const backTarget = empDetailOrigin || 'adm_employees'
        setActiveScreen(backTarget)
        setSelectedEmp(null)
        try {
          window.history.pushState({ app: 'swl', screen: backTarget }, '', SCREEN_PATH_MAP[backTarget] || '/admin/employees')
        } catch (_) {}
        return
      }

      // Priority 3: If on any sub-screen (Check-In, Leave, History, Profile, Reports), go back to Home / Dashboard
      const homeScreen = isAdmin ? 'adm_dashboard' : 'emp_home'
      const homePath = isAdmin ? '/admin' : '/'

      if (activeScreen !== homeScreen) {
        setActiveScreen(homeScreen)
        try {
          window.history.pushState({ app: 'swl', screen: homeScreen }, '', homePath)
        } catch (_) {}
        return
      }

      // Priority 4: If ALREADY on Home / Dashboard, prevent exiting the app!
      // Trap the back button gracefully so the app stays open and mounted.
      try {
        window.history.pushState({ app: 'swl', screen: homeScreen, root: true }, '', homePath)
      } catch (_) {}
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [
    authLoading,
    user,
    isAdmin,
    activeScreen,
    selectedSelfieModal,
    showGeofenceModal,
    showTimingModal,
    empDetailOrigin,
    location.pathname
  ])

  // Sync screen with URL and enforce strict role boundaries
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setActiveScreen('login')
      return
    }

    const p = location.pathname

    if (isAdmin) {
      // Administrator: can ONLY view admin routes and screens
      if (p === '/admin/reports') setActiveScreen('adm_reports')
      else if (p === '/admin/users' || p === '/admin/employees') setActiveScreen('adm_employees')
      else if (p === '/admin/profile') setActiveScreen('adm_profile')
      else if (p === '/leaves' || p === '/admin/leaves') setActiveScreen('adm_approvals')
      else if (activeScreen.startsWith('emp_')) setActiveScreen('adm_dashboard')
      else if (!activeScreen.startsWith('adm_')) setActiveScreen('adm_dashboard')
    } else {
      // Employee: can ONLY view employee routes and screens
      if (p === '/checkin') setActiveScreen('emp_checkin')
      else if (p === '/leaves') setActiveScreen('emp_leave')
      else if (p === '/history') setActiveScreen('emp_history')
      else if (p === '/profile') setActiveScreen('emp_profile')
      else if (activeScreen.startsWith('adm_')) setActiveScreen('emp_home')
      else if (!activeScreen.startsWith('emp_')) setActiveScreen('emp_home')
    }
  }, [user, isAdmin, authLoading, location.pathname])

  if (authLoading) {
    return (
      <div className={`swl-live-chassis-wrap ${isAdmin ? 'admin-mode' : 'employee-mode'}`}>
        <div className="swl-phone-chassis">
          <div className="swl-splash-screen">
            <div className="swl-splash-logo-circle">
              <Icons.LogoWave />
            </div>
            <div className="swl-splash-title">SWL Attend</div>
            <div className="swl-splash-spinner" />
            <div className="swl-splash-loading-text">Connecting to workspace…</div>
          </div>
        </div>
      </div>
    )
  }

  // Not logged in -> Render pristine showcase Login Screen
  if (!user || activeScreen === 'login') {
    return (
      <div className={`swl-live-chassis-wrap ${isAdmin ? 'admin-mode' : 'employee-mode'}`}>
        <div className="swl-phone-chassis">
          <div
            className="swl-phone-viewport"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
          <InAppArrivalToast />
            <LiveLoginScreen
              onSuccess={(role) => {
                setActiveScreen(role === 'admin' ? 'adm_dashboard' : 'emp_home')
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Logged In Shell: Renders active screen within the clean app container
  return (
    <div className={`swl-live-chassis-wrap ${isAdmin ? 'admin-mode' : 'employee-mode'}`}>
      <div className="swl-phone-chassis">
        <div
          className="swl-phone-viewport"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          <InAppArrivalToast />
          {/* Employee Screens (Only rendered when user is Employee) */}
          {!isAdmin && activeScreen === 'emp_home' && (
            <LiveHomeScreen
              onNavigate={handleNavigate}
              officeConfig={officeConfig}
              officeTiming={officeTiming}
              onViewSelfie={setSelectedSelfieModal}
            />
          )}

          {!isAdmin && activeScreen === 'emp_checkin' && (
            <LiveCheckInScreen
              onNavigate={handleNavigate}
              officeConfig={officeConfig}
              officeTiming={officeTiming}
              punchMode={punchMode}
            />
          )}

          {!isAdmin && activeScreen === 'emp_history' && (
            <LiveAttendanceHistoryScreen
              onNavigate={handleNavigate}
              onViewSelfie={setSelectedSelfieModal}
              officeTiming={officeTiming}
            />
          )}

          {!isAdmin && activeScreen === 'emp_leave' && (
            <LiveLeaveAppScreen
              onNavigate={handleNavigate}
            />
          )}

          {!isAdmin && activeScreen === 'emp_profile' && (
            <LiveProfileScreen
              onNavigate={handleNavigate}
              onLogout={logout}
              onViewSelfie={setSelectedSelfieModal}
              officeConfig={officeConfig}
              officeTiming={officeTiming}
            />
          )}

          {/* Admin Screens (Only rendered when user is Admin) */}
          {isAdmin && activeScreen === 'adm_dashboard' && (
            <LiveAdminDashboardScreen
              onNavigate={handleNavigate}
              onOpenGeofence={() => setShowGeofenceModal(true)}
              onOpenTiming={() => setShowTimingModal(true)}
              onOpenAttendanceModal={setAdminAttendanceModal}
              onViewSelfie={setSelectedSelfieModal}
              officeTiming={officeTiming}
            />
          )}

          {isAdmin && activeScreen === 'adm_employees' && (
            <LiveAdminEmployeesScreen
              onNavigate={handleNavigate}
              officeTiming={officeTiming}
              onSelectEmployee={(emp) => {
                setSelectedEmp(emp)
                setEmpDetailOrigin('adm_employees')
                setActiveScreen('adm_details')
              }}
            />
          )}

          {isAdmin && activeScreen === 'adm_details' && (
            <LiveEmployeeDetailsScreen
              employee={selectedEmp}
              origin={empDetailOrigin}
              onNavigate={handleNavigate}
              onOpenAttendanceModal={setAdminAttendanceModal}
              onViewSelfie={setSelectedSelfieModal}
              officeTiming={officeTiming}
            />
          )}

          {isAdmin && activeScreen === 'adm_approvals' && (
            <LiveLeaveApprovalsScreen
              onNavigate={handleNavigate}
            />
          )}

          {isAdmin && activeScreen === 'adm_reports' && (
            <LiveReportsScreen
              onNavigate={handleNavigate}
              officeTiming={officeTiming}
              onOpenAttendanceModal={setAdminAttendanceModal}
              onViewSelfie={setSelectedSelfieModal}
              onSelectEmployee={(emp) => {
                setSelectedEmp(emp)
                setEmpDetailOrigin('adm_reports')
                setActiveScreen('adm_details')
              }}
            />
          )}

          {isAdmin && activeScreen === 'adm_profile' && (
            <LiveAdminProfileScreen
              onNavigate={handleNavigate}
              onLogout={logout}
              onOpenGeofence={() => setShowGeofenceModal(true)}
              onOpenTiming={() => setShowTimingModal(true)}
              onViewSelfie={setSelectedSelfieModal}
              officeConfig={officeConfig}
              officeTiming={officeTiming}
            />
          )}
        </div>
      </div>

      {/* Geofence Modal */}
      {showGeofenceModal && (
        <LiveGeofenceModal
          officeConfig={officeConfig}
          onClose={() => setShowGeofenceModal(false)}
          adminName={profile?.name || user?.displayName || 'Admin'}
        />
      )}

      {/* Office Timings & Shift Modal */}
      {showTimingModal && (
        <LiveOfficeTimingModal
          officeTiming={officeTiming}
          onClose={() => setShowTimingModal(false)}
          adminName={profile?.name || user?.displayName || 'Admin'}
        />
      )}

      {/* Admin Manual Attendance (Add / Edit / Delete) Modal */}
      {adminAttendanceModal && (
        <LiveAdminAttendanceModal
          config={adminAttendanceModal}
          officeTiming={officeTiming}
          officeConfig={officeConfig}
          adminName={profile?.name || user?.displayName || 'Admin'}
          onClose={() => setAdminAttendanceModal(null)}
        />
      )}

      {/* Global Selfie Zoom Preview Modal */}
      {selectedSelfieModal && (
        <LiveSelfieZoomModal
          selfie={selectedSelfieModal}
          onClose={() => setSelectedSelfieModal(null)}
        />
      )}
    </div>
  )
}

/* =========================================================================
   1. LIVE LOGIN SCREEN (EXACT SHOWCASE UI WITH REAL FIREBASE AUTH)
   ========================================================================= */
function LiveLoginScreen({ onSuccess }) {
  const { login, loginWithGoogle, resetPassword } = useAuth()
  const [profileRole, setProfileRole] = useState('employee') // 'employee' | 'admin'
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('swl_last_employee_email') || ''
    }
    return ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Prefill helpful sample credentials or remember last employee email
  useEffect(() => {
    if (profileRole === 'admin') {
      setEmail('admin@softwindlabs.com')
      setPassword('admin123')
    } else {
      const saved = typeof window !== 'undefined' ? (localStorage.getItem('swl_last_employee_email') || '') : ''
      setEmail(saved)
      setPassword('')
    }
    setErrorMsg('')
  }, [profileRole])

  async function handleEmailLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      if (profileRole === 'employee' && typeof window !== 'undefined') {
        try {
          localStorage.setItem('swl_last_employee_email', email.trim())
        } catch {}
      }
      await login(email.trim(), password, profileRole)
      onSuccess(profileRole)
    } catch (err) {
      console.error('Login error:', err)
      let msg = err.message || 'Invalid email or password.'
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/too-many-requests'
      ) {
        msg = 'Incorrect email or password. Please try again.'
      }
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true)
    setErrorMsg('')
    try {
      await loginWithGoogle(profileRole)
      onSuccess(profileRole)
    } catch (err) {
      console.error('Google login error:', err)
      setErrorMsg(err.message || 'Google sign-in was not completed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="swl-login-viewport">
      {/* Top Header & Brand */}
      <div className="swl-login-top-section">
        <div className="swl-login-brand-row" style={{ marginBottom: 12 }}>
          <div className="swl-logo-badge" style={{ width: 38, height: 38, borderRadius: 12 }}>
            <Icons.Logo />
          </div>
          <div>
            <span className="swl-login-brand-name" style={{ fontSize: '1.22rem', fontWeight: 800 }}>SWL Attend</span>
            <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Attendance Portal
            </span>
          </div>
        </div>

        {/* Welcome Message Greeting (Seamlessly placed at top) */}
        <div style={{ textAlign: 'center', marginBottom: 12, width: '100%' }}>
          <h2 className="swl-login-title" style={{ fontSize: '1.36rem', fontWeight: 800, color: '#0F172A', marginBottom: 4, letterSpacing: '-0.02em' }}>
            {profileRole === 'admin' ? 'Administrator Portal 🛡️' : 'Welcome Back! 👋'}
          </h2>
          <p className="swl-login-sub" style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4, margin: 0 }}>
            {profileRole === 'admin'
              ? 'Sign in to access admin console, employees & office geofence'
              : 'Select your profile below and sign in to mark attendance'}
          </p>
        </div>

        {/* Visual Profile Avatar Cards for Employee and Admin */}
        <div style={{ width: '100%', marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Employee Card */}
            <div
              onClick={() => {
                setProfileRole('employee')
                setErrorMsg('')
                if (typeof window !== 'undefined' && !email) {
                  try {
                    setEmail(localStorage.getItem('swl_last_employee_email') || '')
                  } catch {}
                }
              }}
              style={{
                background: profileRole === 'employee' ? '#EEF4FF' : '#FFFFFF',
                border: profileRole === 'employee' ? '2px solid #1E5AE6' : '1.5px solid #E2E8F0',
                borderRadius: 16,
                padding: '12px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: profileRole === 'employee' ? '0 6px 16px rgba(30, 90, 230, 0.16)' : '0 1px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: profileRole === 'employee' ? 'translateY(-2px)' : 'none'
              }}
            >
              {profileRole === 'employee' && (
                <div style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#1E5AE6',
                  color: '#FFFFFF',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  ✓
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: profileRole === 'employee' ? '2.5px solid #1E5AE6' : '2px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)'
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="7" r="4.2" fill="#FFFFFF" />
                    <path d="M4 19.5C4 16 7.5 13.5 12 13.5C16.5 13.5 20 16 20 19.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                    <rect x="10.5" y="15" width="3" height="4.5" rx="1" fill="#93C5FD" />
                  </svg>
                </div>
                <span style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#10B981',
                  color: '#fff',
                  fontSize: '0.52rem',
                  borderRadius: 999,
                  padding: '1px 5px',
                  fontWeight: 800
                }}>
                  STAFF
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                Employee
              </div>
              <div style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                color: profileRole === 'employee' ? '#1E5AE6' : '#64748B',
                background: profileRole === 'employee' ? '#DBEAFE' : '#F1F5F9',
                padding: '2px 8px',
                borderRadius: 999,
                marginTop: 4
              }}>
                👤 Staff Portal
              </div>
            </div>

            {/* Admin Card */}
            <div
              onClick={() => {
                setProfileRole('admin')
                setEmail('admin@softwindlabs.com')
                setPassword('admin123')
                setErrorMsg('')
              }}
              style={{
                background: profileRole === 'admin' ? '#EEF4FF' : '#FFFFFF',
                border: profileRole === 'admin' ? '2px solid #1E5AE6' : '1.5px solid #E2E8F0',
                borderRadius: 16,
                padding: '12px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: profileRole === 'admin' ? '0 6px 16px rgba(30, 90, 230, 0.16)' : '0 1px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: profileRole === 'admin' ? 'translateY(-2px)' : 'none'
              }}
            >
              {profileRole === 'admin' && (
                <div style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#1E5AE6',
                  color: '#FFFFFF',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  ✓
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: profileRole === 'admin' ? '2.5px solid #1E5AE6' : '2px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4.5 5.5V11C4.5 16.5 7.8 21 12 22C16.2 21 19.5 16.5 19.5 11V5.5L12 2Z" fill="#FFFFFF" fillOpacity="0.2" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="12" cy="9.5" r="2.8" fill="#FFFFFF" />
                    <path d="M8.2 16.5C8.5 14.5 10.2 13.5 12 13.5C13.8 13.5 15.5 14.5 15.8 16.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#F59E0B',
                  color: '#fff',
                  fontSize: '0.52rem',
                  borderRadius: 999,
                  padding: '1px 5px',
                  fontWeight: 800
                }}>
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                Administrator
              </div>
              <div style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                color: profileRole === 'admin' ? '#1E5AE6' : '#64748B',
                background: profileRole === 'admin' ? '#DBEAFE' : '#F1F5F9',
                padding: '2px 8px',
                borderRadius: 999,
                marginTop: 4
              }}>
                🛡️ Admin Console
              </div>
            </div>
          </div>
        </div>

        {/* Active Context Chip */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: profileRole === 'admin' ? '#EEF2FF' : '#EFF6FF',
          color: profileRole === 'admin' ? '#4338CA' : '#1E5AE6',
          border: profileRole === 'admin' ? '1px solid #C7D2FE' : '1px solid #BFDBFE',
          padding: '4px 12px',
          borderRadius: 999,
          fontSize: '0.7rem',
          fontWeight: 700,
          marginBottom: 10
        }}>
          <span>{profileRole === 'admin' ? '🛡️' : '👤'}</span>
          <span>
            {profileRole === 'admin'
              ? 'Admin Mode: Manage Organization & Radius'
              : 'Employee Mode: Selfie Punch & Shifts'}
          </span>
        </div>
      </div>

      {/* Middle Form Section */}
      <div className="swl-login-mid-section">
        {errorMsg && (
          <div style={{
            background: '#FEE2E2',
            color: '#B91C1C',
            fontSize: '0.74rem',
            padding: '8px 12px',
            borderRadius: '10px',
            marginBottom: '14px',
            textAlign: 'center',
            fontWeight: 600
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleEmailLogin}>
          <div className="swl-form-group" style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}>
              {profileRole === 'admin' ? 'Admin Email Address' : 'Work Email Address'}
            </label>
            <div className="swl-input-box" style={{ padding: '12px 14px' }}>
              <Icons.User />
              <input
                id="swl-login-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={profileRole === 'admin' ? 'admin@softwindlabs.com' : 'employee@softwindlabs.com'}
              />
            </div>
          </div>

          <div className="swl-form-group" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                Security Password
              </label>
              <a
                href="#forgot"
                className="swl-forgot-link"
                style={{ margin: 0, fontSize: '0.74rem' }}
                onClick={async (e) => {
                  e.preventDefault()
                  const targetEmail = (email && email.includes('@')) ? email.trim() : prompt('Enter your registered email address to receive password reset link:')
                  if (targetEmail) {
                    try {
                      await resetPassword(targetEmail)
                      alert(`✓ Password reset email sent to ${targetEmail}. Please check your inbox or spam folder!`)
                    } catch (err) {
                      alert(err.message || 'Failed to send reset link.')
                    }
                  }
                }}
              >
                Forgot Password?
              </a>
            </div>
            <div className="swl-input-box" style={{ padding: '12px 14px', position: 'relative' }}>
              <Icons.Lock />
              <input
                type={showPassword ? 'text' : 'password'}
                name="auth_key"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ flex: 1, paddingRight: 32 }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showPassword ? '#1E5AE6' : '#94A3B8'
                }}
              >
                {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="swl-btn-login"
            disabled={submitting}
            style={{ padding: '14px', marginTop: 8, fontSize: '0.92rem', fontWeight: 800, borderRadius: 12 }}
          >
            {submitting ? 'Authenticating…' : (profileRole === 'admin' ? 'Sign In as Administrator ➔' : 'Sign In as Employee ➔')}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <div className="swl-divider" style={{ margin: '12px 0' }}>or continue with</div>
          <button
            type="button"
            className="swl-btn-google"
            onClick={handleGoogleLogin}
            disabled={submitting}
            style={{ padding: '12px', borderRadius: 12, minHeight: 46 }}
          >
            <Icons.Google />
            <span>{profileRole === 'admin' ? 'Sign in with Google (Admin)' : 'Sign in with Google (Employee)'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="swl-login-bottom-section">
        <div className="swl-login-trust-pill">
          <span>🔒 256-Bit SSL Encrypted</span>
          <span>•</span>
          <span>📍 GPS Geofenced</span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
          <AppUpdateSyncButton
            label="Sync Latest App Version (v2.4)"
            style={{ borderRadius: 999, padding: '4px 12px', fontSize: '0.64rem', fontWeight: 800 }}
          />
        </div>
        <div className="swl-login-footer" style={{ margin: '6px 0 0 0', fontSize: '0.7rem' }}>
          Softwind Labs Attendance · <span>Corporate Workspace</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   2. LIVE EMPLOYEE HOME SCREEN (SCREEN 3)
   ========================================================================= */
function LiveHomeScreen({ onNavigate, officeConfig, officeTiming, onViewSelfie }) {
  const { user, profile } = useAuth()
  const { unreadCount, pushPermission, requestPushPermission } = useNotifications()
  const [showNotifModal, setShowNotifModal] = useState(false)
  const todayKey = todayDateKey()
  const curMonth = monthKey()

  const [todayRecord, setTodayRecord] = useState(null)
  const [monthlyRecords, setMonthlyRecords] = useState([])
  const [teamToday, setTeamToday] = useState([])
  const [loading, setLoading] = useState(true)

  // Listen to employee's today record and current month records
  useEffect(() => {
    if (!user?.uid) return
    let active = true

    if (!isFirebaseConfigured || !db) {
      setTodayRecord(null)
      setMonthlyRecords([])
      setLoading(false)
      return
    }

    const todayQ = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid),
      where('date', '==', todayKey)
    )

    const unsubToday = onSnapshot(todayQ, (snap) => {
      if (!active) return
      if (!snap.empty) {
        setTodayRecord({ id: snap.docs[0].id, ...snap.docs[0].data() })
      } else {
        setTodayRecord(null)
      }
    })

    const monthQ = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid),
      where('month', '==', curMonth)
    )

    const unsubMonth = onSnapshot(monthQ, (snap) => {
      if (!active) return
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMonthlyRecords(list)
      setLoading(false)
    })

    // Listen to all team punches for today
    const teamQ = query(collection(db, 'attendance'), where('date', '==', todayKey))
    const unsubTeam = onSnapshot(teamQ, (snap) => {
      if (!active) return
      setTeamToday(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => {
      active = false
      unsubToday()
      unsubMonth()
      unsubTeam()
    }
  }, [user?.uid, todayKey, curMonth])

  // Compute live monthly stats
  const { presentCount, absentCount, effectiveWorkingDays } = useMemo(() => {
    return buildEmployeeSchedule(monthlyRecords, curMonth, { uid: user?.uid })
  }, [monthlyRecords, curMonth, user?.uid])

  const officeCutoffStr = useMemo(() => {
    try {
      const [h, m] = (officeTiming?.startTime || '09:00').split(':').map(Number)
      const totalM = h * 60 + m + Number(officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30)
      const cutoffH = Math.floor(totalM / 60) % 24
      const cutoffM = totalM % 60
      return formatTime24to12(`${String(cutoffH).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}`)
    } catch {
      return '09:30 AM'
    }
  }, [officeTiming])

  const lateCount = useMemo(() => {
    return monthlyRecords.filter(r => getAttendanceLateInfo(r, officeTiming).isLate).length
  }, [monthlyRecords, officeTiming])

  const attendanceRate = effectiveWorkingDays > 0 ? Math.round((presentCount / effectiveWorkingDays) * 100) : 0
  const isPresentToday = Boolean(todayRecord?.checkInTime)
  const isCheckedOutToday = Boolean(todayRecord?.checkOutTime)
  const todayLate = useMemo(() => {
    return getAttendanceLateInfo(todayRecord, officeTiming)
  }, [todayRecord, officeTiming])

  // Greeting based on hour
  const greeting = useMemo(() => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good Morning,'
    if (hr < 17) return 'Good Afternoon,'
    return 'Good Evening,'
  }, [])

  const employeeName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Rahul Sharma'
  const employeeRole = profile?.role || profile?.designation || 'Software Developer'

  // Today date formatted
  const formattedToday = useMemo(() => {
    const d = new Date()
    const options = { day: 'numeric', month: 'short', year: 'numeric' }
    return d.toLocaleDateString('en-GB', options)
  }, [])

  const dayOfWeek = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'Friday' ? 'long' : 'short' })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="swl-home-viewport" style={{ flex: 1, overflowY: 'auto' }}>
        {/* User Header */}
        <div className="swl-user-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserAvatar
              name={employeeName}
              photoURL={profile?.photoURL || user?.photoURL}
              size={44}
              fontSize="1.15rem"
              border="2px solid #1E5AE6"
              onClick={() => onNavigate('emp_profile')}
              title="Click to view profile & upload photo"
            />
            <div>
              <p className="swl-user-info-greeting">{greeting}</p>
              <h3 className="swl-user-info-name">{employeeName} 👋</h3>
              <p className="swl-user-info-role">{employeeRole}</p>
            </div>
          </div>
          <div
            className="swl-bell-btn"
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setShowNotifModal(true)}
            title="Team Arrival Alerts & Activity"
          >
            <Icons.Bell />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  borderRadius: 999,
                  minWidth: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  border: '2px solid #FFFFFF'
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Pop-up Notification Permission Card */}
        {pushPermission !== 'granted' && pushPermission !== 'unsupported' && typeof window !== 'undefined' && 'Notification' in window && (
          <div
            style={{
              margin: '0 16px 10px 16px',
              background: 'linear-gradient(135deg, #EEF4FF 0%, #E0E7FF 100%)',
              border: '1.5px solid #BFDBFE',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              boxShadow: '0 2px 8px rgba(30, 90, 230, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <img
                src="/softwind-logo.png"
                alt="Softwind Labs Logo"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  objectFit: 'contain',
                  background: '#FFFFFF',
                  padding: '2px',
                  border: '1px solid #BFDBFE'
                }}
              />
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1E293B' }}>
                  Enable Pop-up Alerts
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>
                  Get real-time arrival alerts for Softwind Labs staff
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={requestPushPermission}
              style={{
                background: '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Allow
            </button>
          </div>
        )}

        {/* Hero Attendance Card */}
        <div className="swl-status-hero-card">
          <div className="swl-status-hero-top">
            <span>Today, {formattedToday}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{dayOfWeek}</span>
              <span style={{ color: '#94A3B8' }}>♡</span>
            </div>
          </div>

          <div className="swl-status-hero-badge-row">
            {isPresentToday ? (
              <>
                <div
                  className="swl-green-check-circle"
                  style={{
                    background: todayLate.isLate ? '#FEF3C7' : '#ECFDF5',
                    color: todayLate.isLate ? '#D97706' : '#10B981',
                    border: todayLate.isLate ? '1.5px solid #FDE68A' : '1.5px solid #A7F3D0'
                  }}
                >
                  {todayLate.isLate ? '⏱️' : '✓'}
                </div>
                <span className="swl-hero-status-text" style={{ color: todayLate.isLate ? '#B45309' : '#0F172A' }}>
                  {isCheckedOutToday
                    ? (todayLate.isLate ? `Shift Completed (Late${todayLate.lateText ? ' +' + todayLate.lateText : ''})` : 'Shift Completed')
                    : (todayLate.isLate ? `You are Present (Late${todayLate.lateText ? ' +' + todayLate.lateText : ''})` : 'You are Present')}
                </span>
              </>
            ) : (
              <>
                <div className="swl-green-check-circle" style={{ background: '#F59E0B' }}>⏱️</div>
                <span className="swl-hero-status-text" style={{ color: '#0F172A' }}>Not Checked In Yet</span>
              </>
            )}
          </div>

          <div className="swl-hero-hours" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div>
              {isPresentToday
                ? `Punch Time: In ${formatTime(todayRecord.checkInTime)}${isCheckedOutToday ? ` • Out ${formatTime(todayRecord.checkOutTime)}` : ' (Ongoing)'}`
                : `Working Hours: ${formatTime24to12(officeTiming?.startTime || '09:00')} - ${formatTime24to12(officeTiming?.endTime || '18:00')}`}
            </div>
            <div style={{ fontSize: '0.66rem', color: '#1E5AE6', fontWeight: 700 }}>
              ⏰ Office Shift: {formatTime24to12(officeTiming?.startTime || '09:00')} – {formatTime24to12(officeTiming?.endTime || '18:00')} • Late after {officeCutoffStr}
            </div>
          </div>

          {/* Today's In/Out Verified Selfies */}
          {isPresentToday && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(226, 232, 240, 0.6)', paddingTop: 8 }}>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>
                Today's Punch Selfies:
              </span>
              <SelfiePairThumbs
                inUrl={todayRecord?.checkInSelfieUrl || todayRecord?.checkInPhotoUrl || todayRecord?.selfieUrl}
                outUrl={todayRecord?.checkOutSelfieUrl || todayRecord?.checkOutPhotoUrl}
                onViewSelfie={onViewSelfie}
                date={todayRecord?.date || todayKey}
                name={employeeName}
                inLoc={todayRecord?.checkInLocation}
                outLoc={todayRecord?.checkOutLocation}
                inTime={todayRecord?.checkInTime ? formatTime(todayRecord.checkInTime) : ''}
                outTime={todayRecord?.checkOutTime ? formatTime(todayRecord.checkOutTime) : ''}
                size={28}
              />
            </div>
          )}
        </div>

        {/* 2 Quick Punch Cards */}
        <div className="swl-punch-cards-row">
          {/* Check In Card */}
          <div
            className="swl-punch-card"
            style={{ cursor: isPresentToday ? 'default' : 'pointer' }}
            onClick={() => {
              if (isPresentToday) {
                onNavigate('emp_checkin', true, { punchMode: 'status' })
              } else {
                onNavigate('emp_checkin', true, { punchMode: 'checkin' })
              }
            }}
          >
            <div className={`swl-punch-icon ${isPresentToday ? 'in' : 'in'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="swl-punch-title">Check In</div>
            <div className={`swl-punch-sub ${isPresentToday ? (todayLate.isLate ? 'late' : 'done') : 'pending'}`}>
              {isPresentToday ? `${formatTime(todayRecord.checkInTime)} (${todayLate.isLate ? `Late +${todayLate.lateText}` : 'Done'})` : 'Tap to Punch In'}
            </div>
          </div>

          {/* Check Out Card */}
          <div
            className="swl-punch-card"
            style={{ cursor: isPresentToday && !isCheckedOutToday ? 'pointer' : 'default' }}
            onClick={() => {
              if (!isPresentToday) {
                alert('You have not checked in yet. Please punch Check-In first.')
                return
              }
              if (isCheckedOutToday) {
                onNavigate('emp_checkin', true, { punchMode: 'status' })
                return
              }
              onNavigate('emp_checkin', true, { punchMode: 'checkout' })
            }}
          >
            <div className={`swl-punch-icon ${isCheckedOutToday ? 'in' : 'out'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="swl-punch-title">Check Out</div>
            <div className={`swl-punch-sub ${isCheckedOutToday ? 'done' : 'pending'}`}>
              {isCheckedOutToday ? `${formatTime(todayRecord.checkOutTime)} Done` : (isPresentToday ? 'Tap to Punch Out' : 'Not Yet')}
            </div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="swl-summary-card">
          <div className="swl-summary-title">Monthly Summary</div>
          <div className="swl-donut-row">
            <div className="swl-donut-container">
              <svg className="swl-donut-svg" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.8"
                  strokeDasharray={`${Math.min(100, Math.max(0, attendanceRate))}, 100`}
                />
              </svg>
              <div className="swl-donut-center-text">{presentCount}/{effectiveWorkingDays || 26}</div>
            </div>
            <div className="swl-donut-legend">
              <div className="swl-legend-row"><span className="swl-dot green"></span> Present {presentCount}</div>
              <div className="swl-legend-row"><span className="swl-dot yellow"></span> Late {lateCount}</div>
              <div className="swl-legend-row"><span className="swl-dot red"></span> Absent {absentCount}</div>
            </div>
          </div>
          <div
            className="swl-view-details-link"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('emp_history')}
          >
            View Details &gt;
          </div>
        </div>

        {/* 👥 Team Attendance Arrivals Today */}
        <div style={{ margin: '14px 16px 6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
            👥 Team Attendance ({teamToday.length})
          </div>
          <span
            style={{ fontSize: '0.68rem', color: '#1E5AE6', fontWeight: 800, cursor: 'pointer' }}
            onClick={() => onNavigate('emp_history')}
            title="View Full Team Attendance History"
          >
            All Team Records &gt;
          </span>
        </div>

        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
          {teamToday.length === 0 ? (
            <div style={{ background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 12, padding: '14px', textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8' }}>
              No colleagues have punched in yet today.
            </div>
          ) : (
            teamToday.map((member) => {
              const inUrl = member.checkInSelfieUrl || member.checkInPhotoUrl || member.selfieUrl
              const outUrl = member.checkOutSelfieUrl || member.checkOutPhotoUrl
              const loc = member.checkInLocation || member.location
              return (
                <div key={member.id} className="swl-punch-feed-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {inUrl || outUrl ? (
                      <SelfiePairThumbs
                        inUrl={inUrl}
                        outUrl={outUrl}
                        onViewSelfie={onViewSelfie}
                        date={member.date}
                        name={member.name}
                        inLoc={member.checkInLocation}
                        outLoc={member.checkOutLocation}
                        inTime={member.checkInTime ? formatTime(member.checkInTime) : ''}
                        outTime={member.checkOutTime ? formatTime(member.checkOutTime) : ''}
                        size={34}
                      />
                    ) : (
                      <UserAvatar
                        name={member.name}
                        photoURL={member.photoURL}
                        size={34}
                        fontSize="0.75rem"
                      />
                    )}
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                        {member.name || 'Teammate'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.66rem', color: '#64748B' }}>
                        In: {member.checkInTime ? formatTime(member.checkInTime) : '--'}
                        {member.checkOutTime ? ` • Out: ${formatTime(member.checkOutTime)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {(() => {
                      const memberLate = getAttendanceLateInfo(member, officeTiming)
                      return (
                        <span className={`swl-badge-pill ${memberLate.isLate ? 'yellow' : 'green'}`}>
                          {memberLate.isLate
                            ? (member.checkOutTime ? 'Out (Late)' : `Late${memberLate.lateText ? ' (+' + memberLate.lateText + ')' : ''}`)
                            : (member.checkOutTime ? 'Out' : 'Present')}
                        </span>
                      )
                    })()}
                    <LocationBtn location={loc} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Arrival Notifications Modal */}
      {showNotifModal && (
        <LiveArrivalsModal
          onClose={() => setShowNotifModal(false)}
          onViewSelfie={onViewSelfie}
        />
      )}

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item active" onClick={() => onNavigate('emp_home')}>
          <Icons.Home active={true} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   3. LIVE CHECK-IN SCREEN (SCREEN 4) - CAMERA, GPS & GEOFENCE PUNCH
   ========================================================================= */
function LiveCheckInScreen({ onNavigate, officeConfig, officeTiming, punchMode = 'auto' }) {
  const { user, profile } = useAuth()
  const { triggerArrivalAlert } = useNotifications()
  const todayKey = todayDateKey()

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [todayDoc, setTodayDoc] = useState(null)
  const [gpsLocation, setGpsLocation] = useState(null)
  const [gpsLocked, setGpsLocked] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [faceDetected, setFaceDetected] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [autoCaptured, setAutoCaptured] = useState(false)

  // Explicit Checkout Mode & Confirmation Modal to prevent accidental checkouts
  const [checkoutMode, setCheckoutMode] = useState(() => punchMode === 'checkout')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // 1. Listen for today's record
  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured || !db) return
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid),
      where('date', '==', todayKey)
    )
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTodayDoc({ id: snap.docs[0].id, ...snap.docs[0].data() })
      } else {
        setTodayDoc(null)
      }
    })
    return () => unsub()
  }, [user?.uid, todayKey])

  const hasCheckedIn = Boolean(todayDoc?.checkInTime)
  const hasCheckedOut = Boolean(todayDoc?.checkOutTime)
  const isShiftDone = hasCheckedIn && hasCheckedOut
  const isShiftActive = hasCheckedIn && !hasCheckedOut

  // If user navigated with explicit 'checkout' punchMode, prompt confirmation modal
  useEffect(() => {
    if (punchMode === 'checkout' && isShiftActive && !checkoutMode) {
      setShowConfirmModal(true)
    }
  }, [punchMode, isShiftActive, checkoutMode])

  // 2. Start Camera Feed (reusable for initial mount & instant retake)
  const startCamera = useCallback(async () => {
    try {
      const currentStream = streamRef.current
      const isTrackActive = currentStream && currentStream.getVideoTracks().some(t => t.readyState === 'live')
      let stream = currentStream

      if (!isTrackActive) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false
        })
        streamRef.current = stream
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (_) {}
      }
      setCameraActive(true)
    } catch (err) {
      console.warn('Camera stream warning:', err)
      if (profile?.photoURL || user?.photoURL) {
        setPhotoUrl(profile?.photoURL || user?.photoURL)
      }
    }
  }, [profile?.photoURL, user?.photoURL])

  // Stop camera feed and release hardware camera sensor
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setFaceDetected(false)
    setCountdown(null)
  }, [])

  // Camera is strictly and only needed when:
  // - User has NOT checked in yet (!hasCheckedIn)
  // - OR user is actively on duty and explicitly activated checkoutMode (isShiftActive && checkoutMode)
  const isCameraNeeded = (!hasCheckedIn || (isShiftActive && checkoutMode)) && !isShiftDone && !successMsg

  useEffect(() => {
    if (isCameraNeeded) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isCameraNeeded, startCamera, stopCamera])

  // 2b. REAL Face Detection loop - only detects when an actual human face is present
  useEffect(() => {
    if (!isCameraNeeded || !cameraActive || photoUrl || !videoRef.current) return
    let active = true

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let nativeDetector = null
    if ('FaceDetector' in window) {
      try {
        nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
      } catch (_) {}
    }

    const checkInterval = setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return

      try {
        if (nativeDetector) {
          const faces = await nativeDetector.detect(videoRef.current)
          if (!active) return
          if (faces && faces.length > 0) {
            const b = faces[0].boundingBox
            const vw = videoRef.current.videoWidth || 480
            const vh = videoRef.current.videoHeight || 480
            if (b.width > vw * 0.15 && b.height > vh * 0.15) {
              setFaceDetected(true)
              return
            }
          }
          setFaceDetected(false)
          return
        }

        // Real Canvas Skin Tone & Facial Contrast Model
        ctx.drawImage(videoRef.current, 0, 0, 64, 64)
        const frameData = ctx.getImageData(0, 0, 64, 64).data
        let skinCount = 0
        let totalLuma = 0
        const total = 64 * 64
        const lumas = []

        for (let i = 0; i < frameData.length; i += 4) {
          const r = frameData[i]
          const g = frameData[i + 1]
          const b = frameData[i + 2]
          const luma = 0.299 * r + 0.587 * g + 0.114 * b
          totalLuma += luma
          lumas.push(luma)

          // YCbCr skin model
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

          if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 50 && r > g && g > b) {
            skinCount++
          }
        }

        const avgLuma = totalLuma / total
        let variance = 0
        for (let i = 0; i < lumas.length; i++) {
          variance += Math.pow(lumas[i] - avgLuma, 2)
        }
        const stdDev = Math.sqrt(variance / total)
        const skinRatio = skinCount / total

        // A face centered in lens has 20%-85% skin pixels with facial contrast (eyes, brows, mouth)
        const isFacePresent = skinRatio >= 0.20 && skinRatio <= 0.85 && stdDev > 16 && avgLuma > 35 && avgLuma < 245

        if (active) {
          setFaceDetected(isFacePresent)
        }
      } catch (e) {
        // Safe check
      }
    }, 350)

    return () => {
      active = false
      clearInterval(checkInterval)
    }
  }, [isCameraNeeded, cameraActive, photoUrl])

  // 2c. 3-Second Countdown & Auto-Capture ONLY for morning Check-In when Face is in frame
  useEffect(() => {
    if (!isCameraNeeded || photoUrl) {
      setCountdown(null)
      return
    }

    // In checkout departure mode: DO NOT auto-snap to give user full manual control
    if (isShiftActive) {
      setCountdown(null)
      return
    }

    // Cancel countdown immediately if face is NOT in frame
    if (!faceDetected) {
      if (!autoCaptured) {
        setCountdown(null)
      }
      return
    }

    // Face detected: initiate countdown
    if (faceDetected && !autoCaptured && countdown === null) {
      setCountdown(3)
      return
    }

    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      handleSnapPhoto()
      setAutoCaptured(true)
      setCountdown(null)
    }
  }, [isCameraNeeded, isShiftActive, faceDetected, countdown, photoUrl, autoCaptured])

  // 3. Acquire GPS Location with resilient iOS/Android fallback & continuous watch
  const fetchGpsLocation = useCallback((isRetry = false) => {
    setGpsLoading(true)
    if (isRetry) {
      setGpsError('')
    }
    getCurrentGpsCoordinates()
      .then((coords) => {
        setGpsLocation(coords)
        setGpsLocked(true)
        setGpsError('')
        setGpsLoading(false)
      })
      .catch((err) => {
        console.warn('GPS location note:', err)
        setGpsLocked(false)
        setGpsLoading(false)
        const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
        let msg = 'GPS location unavailable. Please grant location access.'
        if (err?.code === 1) {
          msg = isIOS
            ? 'Location access denied. On iPhone: Settings > Safari (or Chrome) > Location > select "Allow", and turn ON "Precise Location".'
            : 'Location access denied. Please allow location permissions in your browser settings.'
        } else if (err?.code === 3) {
          msg = isIOS
            ? 'GPS request timed out indoors. Ensure "Precise Location" is ON in iPhone Settings > Safari > Location, and tap Retry.'
            : 'GPS request timed out. Please tap Retry or step near a window/open area.'
        } else if (isIOS) {
          msg = 'Unable to fetch iPhone location. Ensure "Precise Location" is enabled in Settings > Safari > Location.'
        }
        setGpsError(msg)
      })
  }, [])

  useEffect(() => {
    fetchGpsLocation(false)

    // Watch position continuously so indoors or slow satellite fixes resolve automatically
    const unwatch = watchGpsCoordinates(
      (coords) => {
        setGpsLocation(coords)
        setGpsLocked(true)
        setGpsError('')
        setGpsLoading(false)
      },
      (err) => {
        console.warn('watchGpsCoordinates warning:', err)
      }
    )

    return () => {
      unwatch()
    }
  }, [fetchGpsLocation])

  // 4. Geofence Check
  const geofence = useMemo(() => {
    return checkGeofence(gpsLocation, officeConfig)
  }, [gpsLocation, officeConfig])

  // Office Geofence is active if latitude/longitude is configured
  const isOfficeGeofenceConfigured = Boolean(
    (officeConfig?.latitude != null && officeConfig?.longitude != null) ||
    officeConfig?.isConfigured ||
    geofence?.isConfigured
  )

  // Strictly block when office geofence is active and location is outside allowed radius
  const isOutsideGeofence = Boolean(
    isOfficeGeofenceConfigured && geofence && !geofence.isAllowed
  )

  // Capture Photo
  function handleSnapPhoto() {
    if (videoRef.current && cameraActive) {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')
      ctx.drawImage(videoRef.current, 0, 0, 400, 400)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setPhotoUrl(dataUrl)
    } else {
      if (profile?.photoURL || user?.photoURL) {
        setPhotoUrl(profile?.photoURL || user?.photoURL)
      }
    }
    setCountdown(null)
  }

  function handleRetakePhoto() {
    setPhotoUrl(null)
    setAutoCaptured(false)
    setFaceDetected(false)
    setCountdown(null)
    if (videoRef.current) {
      if (streamRef.current && streamRef.current.getVideoTracks().some(t => t.readyState === 'live')) {
        if (videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current
        }
        videoRef.current.play().catch(() => {})
        setCameraActive(true)
      } else {
        startCamera()
      }
    } else {
      startCamera()
    }
  }

  // Confirm Punch Action
  async function handleConfirmPunch() {
    if (submitting) return
    if (isShiftDone) return
    // Guard: Prevent any accidental checkout if user is not in explicit checkout mode
    if (isShiftActive && !checkoutMode) return
    if (profile?.status === 'disabled' || profile?.disabled) {
      alert('Your employee account has been deactivated by the administrator. Clock-in is disabled.')
      return
    }

    // STRICT 1 PHONE = 1 EMPLOYEE DEVICE BINDING CHECK
    // Checks both Device UUID and immutable Hardware Model ID (which survives Chrome data clears!)
    const curDev = getDeviceDetails()
    const currentDeviceId = curDev.deviceId
    const currentDeviceName = curDev.deviceName
    const currentHardwareId = curDev.hardwareModelId

    const isBound = Boolean(profile?.boundDeviceId || profile?.boundHardwareModelId || profile?.boundDeviceFingerprint)
    if (isBound) {
      const matchUuid = Boolean(profile?.boundDeviceId && profile.boundDeviceId === currentDeviceId)
      const matchHardware = Boolean(
        (profile?.boundHardwareModelId && profile.boundHardwareModelId === currentHardwareId) ||
        (profile?.boundDeviceFingerprint && profile.boundDeviceFingerprint === currentHardwareId)
      )
      const matchBrandModel = Boolean(
        !profile?.boundHardwareModelId &&
        profile?.boundDeviceName &&
        profile.boundDeviceName === currentDeviceName
      )

      if (!matchUuid && !matchHardware && !matchBrandModel) {
        alert(`🚫 Device Restricted: Your account is locked to your registered mobile phone [${profile.boundDeviceName || profile.boundPhoneModel || 'Registered Phone'}]. Punching from an unauthorized phone or computer is strictly blocked.`)
        return
      }
    }

    // STRICT GEOFENCE ENFORCEMENT: Block punch if outside office radius!
    if (!gpsLocation || !gpsLocked) {
      alert('🚫 Location Required: Please enable your device GPS location to verify office proximity before punching.')
      return
    }

    const liveGeofence = checkGeofence(gpsLocation, officeConfig)
    const isLiveBlocked = Boolean(
      isOfficeGeofenceConfigured && liveGeofence && !liveGeofence.isAllowed
    )

    if (isLiveBlocked || isOutsideGeofence) {
      const dist = liveGeofence?.distanceMeters ?? geofence?.distanceMeters ?? 'unknown'
      const rad = liveGeofence?.allowedRadius ?? geofence?.allowedRadius ?? 100
      alert(`🚫 Attendance Blocked: You are currently ${dist}m away from the office premise. Punch is strictly restricted to within ${rad}m of the office location.`)
      return
    }

    setSubmitting(true)

    // Ensure photo captured
    let finalPhoto = photoUrl
    if (!finalPhoto) {
      if (videoRef.current && cameraActive) {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 400
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0, 400, 400)
        finalPhoto = canvas.toDataURL('image/jpeg', 0.85)
        setPhotoUrl(finalPhoto)
      } else if (profile?.photoURL || user?.photoURL) {
        finalPhoto = profile?.photoURL || user?.photoURL
        setPhotoUrl(finalPhoto)
      } else {
        alert('Live camera selfie is required to punch attendance. Please ensure camera access is enabled.')
        setSubmitting(false)
        return
      }
    }

    try {
      const isCheckOut = Boolean(todayDoc?.checkInTime && !todayDoc?.checkOutTime)
      const punchNow = new Date()
      const lateCalc = isCheckOut ? { isLate: false, lateMinutes: 0, lateText: '' } : checkIsPunchLate(punchNow, officeTiming)

      if (isFirebaseConfigured && db && user?.uid) {
        if (todayDoc) {
          // Check-Out: update with checkOutPhotoUrl AND checkOutSelfieUrl
          await updateDoc(doc(db, 'attendance', todayDoc.id), {
            checkOutTime: serverTimestamp(),
            checkOutPhotoUrl: finalPhoto,
            checkOutSelfieUrl: finalPhoto,
            checkOutLocation: gpsLocation || null,
            checkOutDeviceId: currentDeviceId,
            checkOutDeviceName: currentDeviceName,
            status: 'completed'
          })
        } else {
          // Check-In: record with checkInPhotoUrl, checkInSelfieUrl, selfieUrl, and late status
          await addDoc(collection(db, 'attendance'), {
            uid: user.uid,
            name: profile?.name || user.displayName || user.email?.split('@')[0] || 'Employee',
            email: user.email || '',
            date: todayKey,
            month: monthKey(),
            checkInTime: serverTimestamp(),
            checkInPhotoUrl: finalPhoto,
            checkInSelfieUrl: finalPhoto,
            selfieUrl: finalPhoto,
            checkInLocation: gpsLocation || null,
            deviceId: currentDeviceId,
            deviceName: currentDeviceName,
            checkOutTime: null,
            checkOutPhotoUrl: null,
            checkOutSelfieUrl: null,
            isLate: lateCalc.isLate,
            lateMinutes: lateCalc.lateMinutes,
            status: lateCalc.isLate ? 'late' : 'present',
            createdAt: serverTimestamp()
          })
        }

        // Auto-heal device binding on punch: if not bound yet or needs hardware ID
        if (!isBound && user?.uid) {
          updateDoc(doc(db, 'users', user.uid), {
            boundDeviceId: currentDeviceId,
            boundHardwareModelId: currentHardwareId,
            boundDeviceFingerprint: currentHardwareId,
            boundDeviceName: currentDeviceName,
            boundPhoneModel: curDev.phoneModel,
            boundAt: serverTimestamp()
          }).catch(() => {})
        } else if ((!profile?.boundHardwareModelId || profile.boundDeviceId !== currentDeviceId) && user?.uid) {
          updateDoc(doc(db, 'users', user.uid), {
            boundDeviceId: currentDeviceId,
            boundHardwareModelId: currentHardwareId,
            boundDeviceFingerprint: currentHardwareId,
            boundDeviceName: currentDeviceName,
            boundPhoneModel: curDev.phoneModel
          }).catch(() => {})
        }
      }

      stopCamera()
      playPunchChime()
      if (isCheckOut) {
        setSuccessMsg('✓ Check-Out Confirmed! Shift Completed.')
      } else if (lateCalc.isLate) {
        setSuccessMsg(`✓ Check-In Confirmed! (Marked Late: +${lateCalc.lateText})`)
      } else {
        setSuccessMsg('✓ Check-In Confirmed! (On Time)')
      }

      try {
        if (triggerArrivalAlert) {
          triggerArrivalAlert({
            type: isCheckOut ? 'out' : 'in',
            name: profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Employee',
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            photoUrl: finalPhoto,
            docId: todayDoc?.id || 'live-punch',
            isSelf: true,
            isLate: lateCalc.isLate,
            lateMinutes: lateCalc.lateMinutes,
            lateText: lateCalc.lateText
          })
        }
      } catch (_) {}

      setTimeout(() => {
        onNavigate('emp_home')
      }, 1200)
    } catch (err) {
      console.error('Punch save error:', err)
      alert('Error confirming punch: ' + (err.message || 'Please retry.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>
            {isShiftDone
              ? 'Shift Completed'
              : (isShiftActive
                  ? (checkoutMode ? 'Check Out Departure' : 'Active Shift')
                  : 'Check In')}
          </span>
          <div style={{ width: 18 }} />
        </div>

        {/* STATE 1: SHIFT FULLY COMPLETED TODAY */}
        {isShiftDone && (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 12px' }}>
              ✓
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
              Shift Completed Today
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.75rem', color: '#64748B' }}>
              Both Check-In and Check-Out have been recorded for {todayKey}.
            </p>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>CHECK IN</div>
                  <div style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800, marginTop: 2 }}>
                    {formatTime(todayDoc.checkInTime)}
                  </div>
                  {(todayDoc.checkInSelfieUrl || todayDoc.checkInPhotoUrl) && (
                    <img
                      src={todayDoc.checkInSelfieUrl || todayDoc.checkInPhotoUrl}
                      alt="In Selfie"
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #10B981', marginTop: 6 }}
                    />
                  )}
                </div>

                <div style={{ width: 1, height: 40, background: '#E2E8F0' }} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>CHECK OUT</div>
                  <div style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800, marginTop: 2 }}>
                    {formatTime(todayDoc.checkOutTime)}
                  </div>
                  {(todayDoc.checkOutSelfieUrl || todayDoc.checkOutPhotoUrl) && (
                    <img
                      src={todayDoc.checkOutSelfieUrl || todayDoc.checkOutPhotoUrl}
                      alt="Out Selfie"
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #F59E0B', marginTop: 6 }}
                    />
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('emp_home')}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Return to Home Dashboard
            </button>
          </div>
        )}

        {/* STATE 2: ALREADY CHECKED IN (Active Shift in Progress, Camera is OFF) */}
        {isShiftActive && !checkoutMode && (
          <div style={{ padding: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
              border: '1.5px solid #86EFAC',
              borderRadius: 18,
              padding: '20px 16px',
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.12)'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#16A34A',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.72rem',
                fontWeight: 800,
                marginBottom: 14
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }} />
                Active Shift in Progress
              </div>

              <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 12px' }}>
                {(todayDoc.checkInSelfieUrl || todayDoc.checkInPhotoUrl) ? (
                  <img
                    src={todayDoc.checkInSelfieUrl || todayDoc.checkInPhotoUrl}
                    alt="Check-In Selfie"
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #16A34A',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '3px solid #16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}>
                    👤
                  </div>
                )}
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  background: '#16A34A',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  border: '2px solid #FFFFFF'
                }}>
                  ✓
                </span>
              </div>

              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: '#14532D' }}>
                You are Clocked In
              </h3>
              <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 700 }}>
                In at {formatTime(todayDoc.checkInTime)}
                <span style={{
                  marginLeft: 6,
                  fontSize: '0.66rem',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: todayDoc.isLate ? '#FEF3C7' : '#DCFCE7',
                  color: todayDoc.isLate ? '#92400E' : '#166534',
                  fontWeight: 800
                }}>
                  {todayDoc.isLate ? `Late (+${todayDoc.lateMinutes}m)` : 'On Time'}
                </span>
              </div>

              <div style={{
                marginTop: 14,
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(4px)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: '0.74rem',
                color: '#334155',
                lineHeight: 1.45
              }}>
                🛡️ <strong>Attendance Safely Logged:</strong> Your morning check-in and selfie are verified in the cloud. You do NOT need to take any more photos until you leave for the day.
              </div>
            </div>

            {/* Actions: Home vs Punch Out */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => onNavigate('emp_home')}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EEF4FF',
                  color: '#1E5AE6',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Icons.BackArrow />
                Return to Home Dashboard
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#FFFBEB',
                  color: '#B45309',
                  border: '1.5px solid #FCD34D',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                🚪 End Shift &amp; Punch Out
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: CAMERA PUNCH VIEW (Morning Check-In OR Explicit Check-Out Departure) */}
        {isCameraNeeded && (
          <div>
            {/* If in departure checkout mode, show header banner with cancel button */}
            {isShiftActive && checkoutMode && (
              <div style={{ margin: '0 16px 8px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309' }}>
                  📸 Departure Out-Selfie
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutMode(false)
                    setPhotoUrl(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                >
                  ✕ Cancel &amp; Return
                </button>
              </div>
            )}

            {/* Circular Camera Selfie Viewfinder */}
            <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
              <div
                className={`swl-camera-frame ${photoUrl ? 'photo-captured' : (faceDetected ? 'face-detected' : '')}`}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  margin: '0 auto',
                  position: 'relative',
                  overflow: 'hidden',
                  background: '#0F172A',
                  border: photoUrl
                    ? '4px solid #1E5AE6'
                    : (faceDetected ? '4px solid #10B981' : '4px solid #94A3B8'),
                  boxShadow: photoUrl
                    ? '0 0 20px rgba(30, 90, 230, 0.4)'
                    : (faceDetected ? '0 0 28px rgba(16, 185, 129, 0.55)' : '0 4px 15px rgba(0,0,0,0.2)'),
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="swl-camera-photo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    display: photoUrl ? 'none' : 'block'
                  }}
                />
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="Captured Selfie"
                    className="swl-camera-photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                )}

                {/* Inner Circular Guide */}
                {!photoUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 16,
                      borderRadius: '50%',
                      border: faceDetected ? '2px dashed rgba(16, 185, 129, 0.7)' : '2px dashed rgba(255, 255, 255, 0.4)',
                      pointerEvents: 'none',
                      transition: 'border-color 0.3s ease'
                    }}
                  />
                )}

                {/* 3-Second Countdown Overlay (Morning Check-In only) */}
                {!photoUrl && countdown !== null && countdown > 0 && !isShiftActive && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(15, 23, 42, 0.45)',
                      backdropFilter: 'blur(2px)',
                      borderRadius: '50%',
                      zIndex: 15,
                      pointerEvents: 'none'
                    }}
                  >
                    <div className="swl-countdown-digit">{countdown}</div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#ECFDF5',
                        background: 'rgba(16, 185, 129, 0.95)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        marginTop: 2
                      }}
                    >
                      Auto Snap in {countdown}s
                    </span>
                  </div>
                )}

                {/* Camera Shutter / Retake Button */}
                <button
                  type="button"
                  className="swl-cam-shutter-btn"
                  onClick={photoUrl ? handleRetakePhoto : handleSnapPhoto}
                  title={photoUrl ? 'Retake selfie' : 'Snap photo'}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: photoUrl ? '#F59E0B' : (isShiftActive ? '#F59E0B' : '#1E5AE6'),
                    color: '#fff',
                    border: '2px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    zIndex: 20
                  }}
                >
                  {photoUrl ? '🔄' : <Icons.Camera />}
                </button>
              </div>

              {/* Face Status Pill */}
              <div style={{ marginTop: 6, marginBottom: 6 }}>
                {photoUrl ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10B981', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    ✓ Face Verified &amp; Captured
                  </span>
                ) : faceDetected ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '3px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    🟢 Face Detected • {isShiftActive ? 'Tap shutter to snap photo' : (countdown !== null && countdown > 0 ? `Auto Capturing in ${countdown}s` : 'Ready')}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '3px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    👤 Align face in circle…
                  </span>
                )}
              </div>
            </div>

            {/* Location Verified Card */}
            <div className="swl-location-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.LocationPin />
                <div className="swl-loc-text-col">
                  <span className="swl-loc-title">
                    {geofence?.isAllowed ? 'Location Verified' : (gpsLocked ? 'Outside Office Geofence' : (gpsLoading ? 'Acquiring GPS Location…' : 'Locking GPS Location...'))}
                  </span>
                  <span className="swl-loc-coords">
                    {gpsLocation
                      ? `${gpsLocation.latitude.toFixed(4)}° N, ${gpsLocation.longitude.toFixed(4)}° E • ${geofence?.distanceMeters ?? 0}m away`
                      : (gpsLoading ? 'Fetching coordinates…' : (gpsError ? 'Unable to acquire location' : 'Acquiring coordinates...'))}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!gpsLocked && (
                  <button
                    type="button"
                    onClick={() => fetchGpsLocation(true)}
                    disabled={gpsLoading}
                    title="Retry Location Fetch"
                    style={{
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#2563EB',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 6,
                      cursor: gpsLoading ? 'wait' : 'pointer'
                    }}
                  >
                    🔄 {gpsLoading ? '…' : 'Retry'}
                  </button>
                )}
                <div
                  className="swl-gps-badge"
                  style={{
                    background: geofence?.isAllowed ? '#ECFDF5' : '#FEE2E2',
                    color: geofence?.isAllowed ? '#10B981' : '#EF4444',
                    fontWeight: 800
                  }}
                >
                  {geofence?.isAllowed ? 'IN RANGE' : (gpsLocked ? 'OUTSIDE' : 'LOCATING')}
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="swl-checklist">
              <div className="swl-check-item">
                <div className="swl-check-icon" style={{ background: photoUrl ? '#10B981' : '#94A3B8' }}>
                  {photoUrl ? '✓' : '…'}
                </div>
                <span>Selfie captured {photoUrl ? '(Verified)' : '(Pending)'}</span>
              </div>
              <div className="swl-check-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="swl-check-icon" style={{ background: gpsLocked ? '#10B981' : (gpsLoading ? '#3B82F6' : '#94A3B8') }}>
                    {gpsLocked ? '✓' : (gpsLoading ? '⟳' : '…')}
                  </div>
                  <span>{gpsLocked ? 'GPS location locked' : (gpsLoading ? 'Fetching GPS coordinates…' : 'GPS location pending')}</span>
                </div>
                {!gpsLocked && (
                  <button
                    type="button"
                    onClick={() => fetchGpsLocation(true)}
                    disabled={gpsLoading}
                    style={{
                      border: 'none',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      cursor: gpsLoading ? 'wait' : 'pointer'
                    }}
                  >
                    🔄 Retry
                  </button>
                )}
              </div>
              <div className="swl-check-item">
                <div
                  className="swl-check-icon"
                  style={{ background: geofence?.isAllowed ? '#10B981' : '#EF4444' }}
                >
                  {geofence?.isAllowed ? '✓' : '✕'}
                </div>
                <span>
                  {geofence?.isAllowed
                    ? `Within office premise (${geofence?.distanceMeters ?? 0}m ≤ ${geofence?.allowedRadius ?? 100}m)`
                    : `Outside premise: ${geofence?.distanceMeters ?? 0}m (Strict allowed: ${geofence?.allowedRadius ?? 100}m)`}
                </span>
              </div>
            </div>

            {/* Outside Geofence Warning Box */}
            {isOutsideGeofence && (
              <div style={{
                background: '#FEF2F2',
                border: '1.5px solid #FCA5A5',
                borderRadius: 10,
                padding: '10px 12px',
                margin: '10px 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#991B1B'
              }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🚫</span>
                <div style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
                  <strong style={{ display: 'block', fontSize: '0.76rem', color: '#7F1D1D' }}>Punch Blocked (Outside Office Premise)</strong>
                  You are currently <strong>{geofence?.distanceMeters ?? 0}m</strong> away from the office. Attendance punch is strictly permitted within the <strong>{geofence?.allowedRadius ?? 100}m</strong> office premise radius.
                </div>
              </div>
            )}

            {/* GPS Error Warning Box with iOS Help & Tap-to-Retry */}
            {!gpsLocked && gpsError && (
              <div style={{
                background: '#FFFBEB',
                border: '1.5px solid #FCD34D',
                borderRadius: 10,
                padding: '12px 14px',
                margin: '10px 16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                color: '#92400E'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>📍</span>
                  <div style={{ fontSize: '0.74rem', lineHeight: 1.45, flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.78rem', color: '#78350F', marginBottom: 2 }}>
                      Location Permission / GPS Required
                    </strong>
                    {gpsError}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #FDE68A' }}>
                  <span style={{ fontSize: '0.70rem', color: '#B45309' }}>
                    iPhone: Settings &gt; Safari/Chrome &gt; Location &gt; Turn ON <b>Precise Location</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchGpsLocation(true)}
                    disabled={gpsLoading}
                    style={{
                      border: 'none',
                      background: '#D97706',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: gpsLoading ? 'wait' : 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {gpsLoading ? 'Acquiring GPS…' : '🔄 Tap to Retry'}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Check In/Out button */}
            <div className="swl-checkin-btn-wrap" style={{ margin: '16px', paddingBottom: 28, flexShrink: 0 }}>
              <button
                type="button"
                className="swl-btn-login"
                style={{
                  background: isOutsideGeofence
                    ? '#EF4444'
                    : (successMsg ? '#10B981' : (isShiftActive ? '#F59E0B' : '#1E5AE6')),
                  cursor: (submitting || Boolean(successMsg) || isOutsideGeofence || !gpsLocked)
                    ? (!gpsLocked && gpsError ? 'pointer' : 'not-allowed')
                    : 'pointer',
                  opacity: (submitting || isOutsideGeofence || (!gpsLocked && !gpsError)) ? 0.85 : 1
                }}
                disabled={submitting || Boolean(successMsg) || isOutsideGeofence || (!gpsLocked && !gpsError)}
                onClick={() => {
                  if (!gpsLocked && gpsError) {
                    fetchGpsLocation(true)
                    return
                  }
                  handleConfirmPunch()
                }}
              >
                {isOutsideGeofence
                  ? `🚫 Outside Office (${geofence?.distanceMeters ?? 0}m > ${geofence?.allowedRadius ?? 100}m)`
                  : (!gpsLocked
                      ? (gpsLoading
                          ? 'Acquiring GPS Location…'
                          : (gpsError ? '🔄 Tap to Retry Location' : 'Acquiring GPS Location…'))
                      : (successMsg
                          ? successMsg
                          : (submitting
                              ? 'Verifying & Saving…'
                              : (isShiftActive ? 'Confirm Check Out' : 'Confirm Check In'))))}
              </button>
            </div>
          </div>
        )}

        {/* PUNCH OUT CONFIRMATION MODAL */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: 18,
              padding: '22px 18px',
              maxWidth: 340,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🚪</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                Confirm Punch Out?
              </h4>
              <p style={{ margin: '0 0 14px 0', fontSize: '0.75rem', color: '#64748B', lineHeight: 1.5 }}>
                Are you ready to end your shift for today ({todayKey})? This will open your camera to record your departure selfie and out time.
              </p>

              {/* Check if checked in very recently */}
              {(() => {
                try {
                  const inD = todayDoc?.checkInTime?.toDate ? todayDoc.checkInTime.toDate() : new Date(todayDoc.checkInTime)
                  const mins = Math.floor((Date.now() - inD.getTime()) / 60000)
                  if (mins < 30) {
                    return (
                      <div style={{
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: '0.68rem',
                        color: '#991B1B',
                        marginBottom: 14,
                        textAlign: 'left'
                      }}>
                        ⚠️ <strong>Notice:</strong> You checked in only <strong>{mins} minute(s)</strong> ago. Please verify you genuinely intend to clock out now.
                      </div>
                    )
                  }
                } catch (_) {}
                return null
              })()}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setPhotoUrl(null)
                    setCheckoutMode(true)
                  }}
                  style={{
                    flex: 1.3,
                    padding: '10px',
                    background: '#F59E0B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Yes, Punch Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('emp_history')}>
          <Icons.Attendance active={true} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   4. LIVE ATTENDANCE HISTORY SCREEN (SCREEN 5) - CALENDAR & DAILY RECORDS
   ========================================================================= */
function LiveAttendanceHistoryScreen({ onNavigate, onViewSelfie, officeTiming }) {
  const { user } = useAuth()
  const todayKey = todayDateKey()

  const [historyTab, setHistoryTab] = useState('my') // 'my' | 'team'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [todayRecord, setTodayRecord] = useState(null)

  // Team Attendance State
  const [selectedTeamDate, setSelectedTeamDate] = useState(todayKey)
  const [teamRecords, setTeamRecords] = useState([])
  const [teamUsers, setTeamUsers] = useState([])
  const [teamSearch, setTeamSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('all') // 'all' | 'working' | 'completed' | 'not-arrived'

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = String(currentDate.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [currentDate])

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [currentDate])

  // Fetch monthly records for current user
  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured || !db) return

    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid),
      where('month', '==', monthStr)
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAttendanceRecords(docs)
      const t = docs.find(d => d.date === todayKey)
      setTodayRecord(t || null)
    })

    return () => unsub()
  }, [user?.uid, monthStr, todayKey])

  // Fetch Team attendance records & users list for selected date
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return

    const qAtt = query(
      collection(db, 'attendance'),
      where('date', '==', selectedTeamDate)
    )

    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setTeamRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => !isUserAdmin(u))
      setTeamUsers(list)
    })

    return () => {
      unsubAtt()
      unsubUsers()
    }
  }, [selectedTeamDate])

  // Generate Calendar cells matching month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ num: '', type: 'empty' })
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const rec = attendanceRecords.find(r => r.date === dateKey)

      let type = 'empty'
      if (rec) {
        const lateInfo = getAttendanceLateInfo(rec, officeTiming)
        if (lateInfo.isLate) type = 'l'
        else if (rec.status === 'present' || rec.checkInTime) type = 'p'
        else if (rec.status === 'absent') type = 'a'
        else type = 'p'
      } else {
        const cellDate = new Date(year, month, d)
        const isPast = cellDate < new Date() && cellDate.getDay() !== 0 && cellDate.getDay() !== 6
        if (isPast && dateKey < todayKey) {
          type = 'a'
        }
      }

      cells.push({ num: d, type, dateKey })
    }

    return cells
  }, [currentDate, attendanceRecords, todayKey, officeTiming])

  const presentCount = attendanceRecords.filter(r => r.status === 'present' || r.checkInTime).length
  const lateCount = attendanceRecords.filter(r => getAttendanceLateInfo(r, officeTiming).isLate).length
  const absentCount = calendarDays.filter(c => c.type === 'a').length

  function changeMonth(delta) {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  function changeTeamDate(deltaDays) {
    const parts = selectedTeamDate.split('-').map(Number)
    const cur = new Date(parts[0], parts[1] - 1, parts[2])
    cur.setDate(cur.getDate() + deltaDays)
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    setSelectedTeamDate(`${y}-${m}-${d}`)
  }

  // Combined Team Directory with attendance details
  const filteredTeamList = useMemo(() => {
    // Merge users directory with attendance records
    const combined = teamUsers.map((u, i) => {
      const att = teamRecords.find(r => r.uid === u.uid || r.email === u.email)
      let calcDuration = '—'
      if (att?.checkInTime) {
        const inD = att.checkInTime.toDate ? att.checkInTime.toDate() : new Date(att.checkInTime)
        const outD = att.checkOutTime
          ? (att.checkOutTime.toDate ? att.checkOutTime.toDate() : new Date(att.checkOutTime))
          : (selectedTeamDate === todayKey ? new Date() : null)
        if (outD) {
          const diffMs = Math.max(0, outD - inD)
          const hrs = Math.floor(diffMs / (1000 * 60 * 60))
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          calcDuration = `${hrs}h ${mins}m`
        }
      }

      const lateInfo = getAttendanceLateInfo(att, officeTiming)
      return {
        uid: u.uid,
        name: u.name || u.email?.split('@')[0] || 'Team Member',
        email: u.email || '',
        role: u.role || u.designation || 'Staff',
        photoURL: u.photoURL || null,
        avatar: u.photoURL || null,
        attendance: att || null,
        duration: calcDuration,
        hasIn: Boolean(att?.checkInTime),
        hasOut: Boolean(att?.checkOutTime),
        isLate: lateInfo.isLate,
        lateMinutes: lateInfo.lateMinutes,
        lateText: lateInfo.lateText,
        inUrl: att?.checkInSelfieUrl || att?.checkInPhotoUrl || att?.selfieUrl || null,
        outUrl: att?.checkOutSelfieUrl || att?.checkOutPhotoUrl || null,
        loc: att?.checkInLocation || att?.location || null
      }
    })

    return combined.filter(item => {
      if (teamSearch.trim()) {
        const s = teamSearch.toLowerCase()
        const matchName = item.name.toLowerCase().includes(s)
        const matchEmail = item.email.toLowerCase().includes(s)
        if (!matchName && !matchEmail) return false
      }

      if (teamFilter === 'working') return item.hasIn && !item.hasOut
      if (teamFilter === 'completed') return item.hasIn && item.hasOut
      if (teamFilter === 'not-arrived') return !item.hasIn
      return true
    })
  }, [teamUsers, teamRecords, selectedTeamDate, todayKey, teamSearch, teamFilter, officeTiming])

  const todayInSelfie = todayRecord?.checkInSelfieUrl || todayRecord?.checkInPhotoUrl || todayRecord?.selfieUrl
  const todayOutSelfie = todayRecord?.checkOutSelfieUrl || todayRecord?.checkOutPhotoUrl
  const todayLoc = todayRecord?.checkInLocation || todayRecord?.location

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>Attendance Records</span>
          <Icons.Calendar />
        </div>

        {/* Tab Switcher: My Attendance vs Team Records */}
        <div className="swl-tab-pill-row" style={{ margin: '8px 16px 12px 16px' }}>
          <button
            type="button"
            className={`swl-tab-pill ${historyTab === 'my' ? 'active' : ''}`}
            onClick={() => setHistoryTab('my')}
          >
            👤 My Attendance
          </button>
          <button
            type="button"
            className={`swl-tab-pill ${historyTab === 'team' ? 'active' : ''}`}
            onClick={() => setHistoryTab('team')}
          >
            👥 Team Records ({teamRecords.length})
          </button>
        </div>

        {/* SUBTAB 1: MY OWN ATTENDANCE */}
        {historyTab === 'my' && (
          <div>
            {/* Calendar Widget */}
            <div className="swl-calendar-card">
              <div className="swl-month-header">
                <span style={{ cursor: 'pointer' }} onClick={() => changeMonth(-1)}>&lt;</span>
                <span>{monthLabel}</span>
                <span style={{ cursor: 'pointer' }} onClick={() => changeMonth(1)}>&gt;</span>
              </div>

              <div className="swl-cal-weekdays">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              <div className="swl-cal-grid">
                {calendarDays.map((d, i) => (
                  <div key={i} className={`swl-cal-day ${d.type}`}>
                    {d.num}
                  </div>
                ))}
              </div>

              <div className="swl-cal-legend">
                <span>🟢 Present</span>
                <span>🔴 Absent</span>
                <span>🟠 Late</span>
                <span>🔵 Leave</span>
              </div>
            </div>

            {/* Today's Attendance Box with Both Selfies */}
            <div className="swl-today-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="swl-today-box-title" style={{ margin: 0 }}>Today's Attendance</span>
                {todayLoc && <LocationBtn location={todayLoc} />}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="swl-today-row" style={{ margin: '2px 0' }}>
                    <span>Check In: {todayRecord?.checkInTime ? formatTime(todayRecord.checkInTime) : 'Not Yet'}</span>
                    <span className={`swl-badge-pill ${todayRecord?.checkInTime ? 'green' : 'yellow'}`}>
                      {todayRecord?.checkInTime ? 'Present' : 'Pending'}
                    </span>
                  </div>
                  <div className="swl-today-row" style={{ margin: '2px 0' }}>
                    <span>Check Out: {todayRecord?.checkOutTime ? formatTime(todayRecord.checkOutTime) : 'Ongoing'}</span>
                    <span className={`swl-badge-pill ${todayRecord?.checkOutTime ? 'green' : 'yellow'}`}>
                      {todayRecord?.checkOutTime ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Selfies Pair */}
                {(todayInSelfie || todayOutSelfie) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <SelfiePairThumbs
                      inUrl={todayInSelfie}
                      outUrl={todayOutSelfie}
                      onViewSelfie={onViewSelfie}
                      date={todayRecord?.date || todayKey}
                      name="My Attendance"
                      inLoc={todayRecord?.checkInLocation}
                      outLoc={todayRecord?.checkOutLocation}
                      inTime={todayRecord?.checkInTime ? formatTime(todayRecord.checkInTime) : ''}
                      outTime={todayRecord?.checkOutTime ? formatTime(todayRecord.checkOutTime) : ''}
                      size={36}
                    />
                    <span style={{ fontSize: '0.55rem', color: '#64748B', fontWeight: 700 }}>Selfies</span>
                  </div>
                )}
              </div>
            </div>

            {/* Month Summary 4 columns */}
            <div className="swl-stat-cols-4">
              <div>
                <div className="swl-stat-col-num green">{presentCount}</div>
                <div className="swl-stat-col-label">Present</div>
              </div>
              <div>
                <div className="swl-stat-col-num yellow">{lateCount}</div>
                <div className="swl-stat-col-label">Late</div>
              </div>
              <div>
                <div className="swl-stat-col-num red">{absentCount}</div>
                <div className="swl-stat-col-label">Absent</div>
              </div>
              <div>
                <div className="swl-stat-col-num gray">0</div>
                <div className="swl-stat-col-label">Leave</div>
              </div>
            </div>

            {/* Monthly Punch Log List with In & Out Selfies */}
            <div style={{ margin: '14px 16px 6px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
              My Monthly Punches ({attendanceRecords.length})
            </div>

            <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 16 }}>
              {attendanceRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: '0.74rem' }}>
                  No punch logs recorded for this month.
                </div>
              ) : (
                attendanceRecords.map((r) => {
                  const inUrl = r.checkInSelfieUrl || r.checkInPhotoUrl || r.selfieUrl
                  const outUrl = r.checkOutSelfieUrl || r.checkOutPhotoUrl
                  const loc = r.checkInLocation || r.location
                  return (
                    <div key={r.id} className="swl-punch-feed-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SelfiePairThumbs
                          inUrl={inUrl}
                          outUrl={outUrl}
                          onViewSelfie={onViewSelfie}
                          date={r.date}
                          name="My Record"
                          inLoc={r.checkInLocation}
                          outLoc={r.checkOutLocation}
                          inTime={r.checkInTime ? formatTime(r.checkInTime) : ''}
                          outTime={r.checkOutTime ? formatTime(r.checkOutTime) : ''}
                          size={32}
                        />
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>{r.date}</div>
                          <div style={{ fontSize: '0.66rem', color: '#64748B' }}>
                            In: {r.checkInTime ? formatTime(r.checkInTime) : '--'}
                            {r.checkOutTime ? ` • Out: ${formatTime(r.checkOutTime)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {(() => {
                          const lateInfo = getAttendanceLateInfo(r, officeTiming)
                          return (
                            <span className={`swl-badge-pill ${lateInfo.isLate ? 'yellow' : 'green'}`}>
                              {lateInfo.isLate
                                ? (r.checkOutTime ? `Done (Late${lateInfo.lateText ? ' +' + lateInfo.lateText : ''})` : `Late${lateInfo.lateText ? ' (+' + lateInfo.lateText + ')' : ''}`)
                                : (r.checkOutTime ? 'Done' : 'Present')}
                            </span>
                          )
                        })()}
                        <LocationBtn location={loc} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: TEAM RECORDS */}
        {historyTab === 'team' && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {/* Team Date Selector */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => changeTeamDate(-1)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: 6, padding: '4px 10px', fontWeight: 800, cursor: 'pointer', color: '#334155' }}
              >
                &lt;
              </button>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                  {selectedTeamDate === todayKey ? `Today (${selectedTeamDate})` : selectedTeamDate}
                </span>
                <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 700 }}>
                  {teamRecords.length} member{teamRecords.length === 1 ? '' : 's'} punched
                </div>
              </div>
              <button
                type="button"
                onClick={() => changeTeamDate(1)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: 6, padding: '4px 10px', fontWeight: 800, cursor: 'pointer', color: '#334155' }}
              >
                &gt;
              </button>
            </div>

            {/* Search Filter */}
            <div className="swl-input-box" style={{ padding: '6px 12px' }}>
              <Icons.Search />
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search colleague by name or email..."
                style={{ fontSize: '0.75rem' }}
              />
            </div>

            {/* Quick Status Filter Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'working', label: 'In Office' },
                { id: 'completed', label: 'Completed' },
                { id: 'not-arrived', label: 'Not Arrived' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTeamFilter(f.id)}
                  style={{
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: teamFilter === f.id ? '#1E5AE6' : '#F1F5F9',
                    color: teamFilter === f.id ? '#FFFFFF' : '#64748B'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Team Members List */}
            {filteredTeamList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94A3B8', fontSize: '0.78rem' }}>
                No colleagues matching filter for {selectedTeamDate}.
              </div>
            ) : (
              filteredTeamList.map(member => (
                <div key={member.uid} className="swl-team-member-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <UserAvatar
                        name={member.name}
                        photoURL={member.photoURL || member.avatar}
                        size={36}
                      />
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
                          {member.name}
                        </h4>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                          {member.role}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Selfies Pair */}
                      {(member.inUrl || member.outUrl) && (
                        <SelfiePairThumbs
                          inUrl={member.inUrl}
                          outUrl={member.outUrl}
                          onViewSelfie={onViewSelfie}
                          date={selectedTeamDate}
                          name={member.name}
                          inLoc={member.loc}
                          outLoc={member.attendance?.checkOutLocation}
                          inTime={member.attendance?.checkInTime ? formatTime(member.attendance.checkInTime) : ''}
                          outTime={member.attendance?.checkOutTime ? formatTime(member.attendance.checkOutTime) : ''}
                          size={30}
                        />
                      )}

                      <span
                        className="swl-badge-pill"
                        style={{
                          background: member.isLate ? '#FEF3C7' : (member.hasOut ? '#EEF4FF' : (member.hasIn ? '#ECFDF5' : '#F1F5F9')),
                          color: member.isLate ? '#D97706' : (member.hasOut ? '#1E5AE6' : (member.hasIn ? '#059669' : '#94A3B8'))
                        }}
                      >
                        {member.isLate
                          ? (member.hasOut ? `Completed (Late${member.lateText ? ' +' + member.lateText : ''})` : `Late${member.lateText ? ' (+' + member.lateText + ')' : ''}`)
                          : (member.hasOut ? 'Completed' : (member.hasIn ? 'Present' : 'Absent'))}
                      </span>
                    </div>
                  </div>

                  {/* Punch times & duration breakdown */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '6px 10px', borderRadius: 8, fontSize: '0.68rem', color: '#475569' }}>
                    <div>
                      <span>In: </span>
                      <strong>{member.attendance?.checkInTime ? formatTime(member.attendance.checkInTime) : '--'}</strong>
                      <span style={{ margin: '0 6px', color: '#CBD5E1' }}>|</span>
                      <span>Out: </span>
                      <strong>{member.attendance?.checkOutTime ? formatTime(member.attendance.checkOutTime) : '--'}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Shift: <strong>{member.duration}</strong></span>
                      {member.loc && <LocationBtn location={member.loc} label="🗺️" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('emp_history')}>
          <Icons.Attendance active={true} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

export function formatLeaveTargetDates(startDate, endDate) {
  if (!startDate) return '—'
  const parse = (dStr) => {
    if (!dStr) return ''
    try {
      const parts = dStr.split('-')
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        }
      }
      const d = new Date(dStr)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    } catch {}
    return dStr
  }

  const sFormatted = parse(startDate)
  const eFormatted = endDate ? parse(endDate) : sFormatted

  if (!endDate || startDate === endDate) {
    return `${sFormatted} (1 Day)`
  }

  try {
    const d1 = new Date(startDate)
    const d2 = new Date(endDate)
    const diff = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1)
    return `${sFormatted} – ${eFormatted} (${diff} Days)`
  } catch {
    return `${sFormatted} – ${eFormatted}`
  }
}

export function formatLeaveRequestDateTime(timestamp) {
  if (!timestamp) return 'Just now'
  try {
    let date = null
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      date = new Date(timestamp)
    }
    if (!date || isNaN(date.getTime())) return 'Recently'
    const datePart = date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
    const timePart = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    return `${datePart} at ${timePart}`
  } catch {
    return 'Recently'
  }
}

/* =========================================================================
   5. LIVE LEAVE APPLICATION SCREEN (SCREEN 6) - LEAVE APPLY & MEDICAL PROOF
   ========================================================================= */
function LiveLeaveAppScreen({ onNavigate }) {
  const { user, profile } = useAuth()
  const today = todayDateKey()

  const [tab, setTab] = useState('apply') // 'apply' | 'requests'
  const [leaveType, setLeaveType] = useState('Casual Leave')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')
  const [proofPhotoUrl, setProofPhotoUrl] = useState(null)
  const [proofPhotoName, setProofPhotoName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

  const [myLeaves, setMyLeaves] = useState([])

  // Subscribe to employee's leaves
  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeLeaves({
      uid: user.uid,
      onUpdate: (list) => setMyLeaves(list),
      onError: (err) => console.warn('Leaves stream note:', err)
    })
    return () => unsub && unsub()
  }, [user?.uid])

  function handleProofFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofPhotoName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      setProofPhotoUrl(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleApplyLeave(e) {
    e.preventDefault()
    if (profile?.status === 'disabled' || profile?.disabled) {
      alert('Your employee account has been deactivated by the administrator. Leave applications cannot be submitted.')
      return
    }
    if (!reason.trim()) {
      alert('Please enter a brief reason for your leave request.')
      return
    }

    setSubmitting(true)
    try {
      await submitLeaveRequest({
        uid: user.uid,
        userName: profile?.name || user.displayName || user.email?.split('@')[0],
        userEmail: user.email,
        leaveType: leaveType.toLowerCase().replace(' leave', ''),
        startDate,
        endDate,
        daysCount: 1,
        reason,
        proofPhotoUrl
      })
      setSubmittedSuccess(true)
      setTimeout(() => {
        setSubmittedSuccess(false)
        setTab('requests')
        setReason('')
        setProofPhotoUrl(null)
      }, 1000)
    } catch (err) {
      console.error('Submit leave error:', err)
      alert('Failed to submit leave request: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(leaveId) {
    if (!confirm('Are you sure you want to cancel this pending leave?')) return
    try {
      await cancelLeaveRequest({ leaveId, uid: user.uid })
    } catch (err) {
      alert('Could not cancel leave: ' + err.message)
    }
  }

  async function handleDeleteLeave(leaveId) {
    if (!window.confirm('Delete this leave record permanently from your history?')) return
    try {
      setMyLeaves((prev) => prev.filter((l) => l.id !== leaveId))
      await deleteLeaveRequest({ leaveId, uid: user.uid })
    } catch (err) {
      console.error('Delete leave error:', err)
      alert('Could not delete leave record: ' + (err.message || 'Error'))
    }
  }

  async function handleClearAllLeaves() {
    if (myLeaves.length === 0) return
    if (!window.confirm(`Are you sure you want to clear all ${myLeaves.length} leave records from your history? This action cannot be undone.`)) {
      return
    }
    const idsToClear = myLeaves.map((l) => l.id)
    try {
      setMyLeaves([])
      await clearLeaveRecords({ uid: user.uid, leaveIds: idsToClear })
    } catch (err) {
      console.error('Clear leaves error:', err)
      alert('Could not clear leave history: ' + (err.message || 'Error'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>Apply Leave</span>
          <Icons.Leave active={false} />
        </div>

        <div className="swl-tab-pill-row">
          <button
            className={`swl-tab-pill ${tab === 'apply' ? 'active' : ''}`}
            onClick={() => setTab('apply')}
          >
            Apply Leave
          </button>
          <button
            className={`swl-tab-pill ${tab === 'requests' ? 'active' : ''}`}
            onClick={() => setTab('requests')}
          >
            My Requests ({myLeaves.length})
          </button>
        </div>

        {tab === 'apply' ? (
          <>
            <form onSubmit={handleApplyLeave} className="swl-leave-form">
              <div>
                <label className="swl-form-label">Leave Type</label>
                <div className="swl-input-box">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: '#1E293B' }}
                  >
                    <option>Casual Leave</option>
                    <option>Sick Leave</option>
                    <option>Earned Leave</option>
                    <option>Emergency Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="swl-form-label">From Date</label>
                <div className="swl-input-box">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <Icons.Calendar />
                </div>
              </div>

              <div>
                <label className="swl-form-label">To Date</label>
                <div className="swl-input-box">
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <Icons.Calendar />
                </div>
              </div>

              <div>
                <label className="swl-form-label">Reason</label>
                <textarea
                  required
                  rows="2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    outline: 'none',
                    minHeight: 50,
                    resize: 'none'
                  }}
                  placeholder="Enter reason for leave..."
                />
              </div>

              {/* Medical proof upload box when Sick Leave is selected */}
              {leaveType === 'Sick Leave' && (
                <div>
                  <label className="swl-form-label">🩺 Doctor Slip / Medical Proof</label>
                  <div style={{
                    border: '1.5px dashed #F59E0B',
                    borderRadius: '12px',
                    padding: '10px',
                    textAlign: 'center',
                    background: '#FFFBEB'
                  }}>
                    {proofPhotoUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ color: '#047857', fontWeight: 700 }}>✓ {proofPhotoName || 'Document Attached'}</span>
                        <button
                          type="button"
                          onClick={() => { setProofPhotoUrl(null); setProofPhotoName(''); }}
                          style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'block', fontSize: '0.72rem', color: '#B45309' }}>
                        <span>📎 Click to upload doctor certificate / slip (Photo or PDF)</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={handleProofFile}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="swl-btn-login"
                style={{ marginTop: 4, background: submittedSuccess ? '#10B981' : '#1E5AE6' }}
                disabled={submitting}
              >
                {submittedSuccess ? '✓ Request Submitted' : (submitting ? 'Submitting…' : 'Submit Request')}
              </button>
            </form>

            {/* Leave Balance Box */}
            <div className="swl-leave-balances">
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Leave Balance</div>
              <div className="swl-balances-grid">
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E5AE6' }}>5</div>
                  <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Sick Leave</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10B981' }}>7</div>
                  <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Casual Leave</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F59E0B' }}>10</div>
                  <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Earned Leave</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* My Requests Tab */
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header with Clear Records Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                Leave Requests ({myLeaves.length})
              </span>
              {myLeaves.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllLeaves}
                  style={{
                    background: '#FFF1F2',
                    color: '#E11D48',
                    border: '1px solid #FECDD3',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Clear all past leave records"
                >
                  <span>🗑️ Clear History</span>
                </button>
              )}
            </div>

            {myLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 10px', color: '#94A3B8', fontSize: '0.8rem' }}>
                No leave requests submitted yet.
              </div>
            ) : (
              myLeaves.map((l) => (
                <div key={l.id} className="swl-approval-card" style={{ padding: 12, borderRadius: 12 }}>
                  <div className="swl-approval-top" style={{ marginBottom: 6 }}>
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                        {l.leaveType ? (l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) + ' Leave') : 'Leave'}
                      </p>
                    </div>
                    <span className={`swl-badge-pill ${l.status === 'approved' ? 'green' : (l.status === 'rejected' ? 'red' : 'yellow')}`}>
                      {l.status}
                    </span>
                  </div>

                  {/* Target Leave Dates */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', margin: '4px 0' }}>
                    <span style={{ fontSize: '0.82rem' }}>📅</span>
                    <div>
                      <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Leave Dates:</span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>
                        {formatLeaveTargetDates(l.startDate, l.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Request Applied Date & Time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 6px 2px' }}>
                    <span style={{ fontSize: '0.66rem', color: '#64748B' }}>🕒 Applied on:</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155' }}>
                      {formatLeaveRequestDateTime(l.createdAt)}
                    </span>
                  </div>

                  {/* Reason */}
                  {l.reason && (
                    <div style={{ fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', margin: '4px 0 8px 2px' }}>
                      "{l.reason}"
                    </div>
                  )}

                  {/* Rejection Reason display if rejected by Admin */}
                  {l.status === 'rejected' && (l.rejectionReason || l.adminNote) && (
                    <div style={{
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: 8,
                      padding: '8px 10px',
                      margin: '6px 0',
                      fontSize: '0.72rem',
                      color: '#991B1B'
                    }}>
                      <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span>⚠️ Rejection Reason from Admin:</span>
                      </div>
                      <div style={{ color: '#7F1D1D' }}>
                        {l.rejectionReason || l.adminNote}
                      </div>
                    </div>
                  )}

                  {/* Doctor Proof Slip if attached */}
                  {l.proofPhotoUrl && (
                    <div style={{ margin: '6px 0' }}>
                      <a
                        href={l.proofPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.68rem',
                          color: '#059669',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '3px 8px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontWeight: 700
                        }}
                      >
                        📎 View Attached Proof
                      </a>
                    </div>
                  )}

                  {/* Bottom Action Row (Cancel pending / Delete record) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                    {l.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(l.id)}
                        style={{
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#64748B',
                          padding: '3px 9px',
                          borderRadius: 6,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel Request
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteLeave(l.id)}
                      style={{
                        border: '1px solid #FECDD3',
                        background: '#FFF1F2',
                        color: '#E11D48',
                        padding: '3px 9px',
                        borderRadius: 6,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      title="Permanently delete this record"
                    >
                      <span>🗑️ Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('emp_leave')}>
          <Icons.Leave active={true} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   6. LIVE PROFILE SCREEN (SCREEN 7)
   ========================================================================= */
function LiveProfileScreen({ onNavigate, onLogout, onViewSelfie, officeConfig, officeTiming }) {
  const { user, profile, currentDevice } = useAuth()
  const todayKey = todayDateKey()

  const [subview, setSubview] = useState('menu') // 'menu' | 'personal_info' | 'contact_admin' | 'change_password' | 'settings'
  const [todayRecord, setTodayRecord] = useState(null)

  // Handle back navigation for profile subviews so app never closes
  useEffect(() => {
    if (subview === 'menu') return
    try {
      window.history.pushState({ app: 'swl', profileSubview: subview }, '')
    } catch (_) {}

    const onPop = () => {
      setSubview('menu')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [subview])

  // Personal Info Form State
  const [editName, setEditName] = useState(profile?.name || user?.displayName || 'Rahul Sharma')
  const [editPhone, setEditPhone] = useState(profile?.phone || '+91 98765 43210')
  const [editDept, setEditDept] = useState(profile?.department || profile?.role || 'Software Engineering')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [resetSending, setResetSending] = useState(false)

  // Contact Admin Query State
  const [querySubject, setQuerySubject] = useState('')
  const [queryMessage, setQueryMessage] = useState('')
  const [querySending, setQuerySending] = useState(false)
  const [queryMsg, setQueryMsg] = useState('')

  // Official Admin contact email
  const ADMIN_OFFICIAL_EMAIL = 'admin@softwindlabs.com'

  // Fetch today's record to display employee's selfie if available
  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured || !db) return
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', user.uid),
      where('date', '==', todayKey)
    )
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTodayRecord({ id: snap.docs[0].id, ...snap.docs[0].data() })
      }
    })
    return () => unsub()
  }, [user?.uid, todayKey])

  const name = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Rahul Sharma'
  const role = profile?.role || profile?.designation || 'Software Developer'
  const empId = profile?.employeeId || profile?.empId || 'SWL-1048'
  const joinDate = profile?.joiningDate || '15 Jan 2024'

  const activeSelfie = todayRecord?.checkInSelfieUrl || todayRecord?.checkInPhotoUrl || todayRecord?.selfieUrl
  const profilePhoto = profile?.photoURL || user?.photoURL || null

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoMsg('')
    try {
      const base64Url = await processImageFile(file, 350, 350, 0.82)
      if (isFirebaseConfigured && db && user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          photoURL: base64Url,
          updatedAt: serverTimestamp()
        }, { merge: true })
        if (user && updateProfile) {
          await updateProfile(user, { photoURL: base64Url }).catch(() => {})
        }
      }
      setPhotoMsg('✓ Profile photo updated successfully!')
      setTimeout(() => setPhotoMsg(''), 3000)
    } catch (err) {
      alert('Photo update failed: ' + (err.message || 'Please retry.'))
    } finally {
      setPhotoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  async function handleSavePersonalInfo(e) {
    e.preventDefault()
    setInfoSaving(true)
    setInfoMsg('')
    try {
      if (isFirebaseConfigured && db && user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          name: editName.trim(),
          phone: editPhone.trim(),
          department: editDept.trim(),
          role: editDept.trim(),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }
      if (user && updateProfile) {
        await updateProfile(user, { displayName: editName.trim() }).catch(() => {})
      }
      setInfoMsg('✓ Personal information updated successfully!')
      setTimeout(() => {
        setInfoMsg('')
        setSubview('menu')
      }, 1200)
    } catch (err) {
      setInfoMsg(err.message || 'Error updating profile.')
    } finally {
      setInfoSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwdMsg('')
    if (!currentPassword) {
      setPwdMsg('Please enter your current password.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPwdMsg('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg('New passwords do not match.')
      return
    }
    setPwdSaving(true)
    try {
      if (user && user.email) {
        // Re-authenticate user to avoid auth/requires-recent-login error
        const credential = EmailAuthProvider.credential(user.email, currentPassword)
        await reauthenticateWithCredential(user, credential)
        await updatePassword(user, newPassword)
        setPwdMsg('✓ Password updated successfully!')
        setTimeout(() => {
          setPwdMsg('')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setSubview('menu')
        }, 1400)
      } else {
        throw new Error('User session not found. Please log in again.')
      }
    } catch (err) {
      console.error('Password change error:', err)
      let msg = err.message || 'Failed to update password.'
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Current password is incorrect. Please check or use the reset link below.'
      } else if (err.code === 'auth/requires-recent-login') {
        msg = 'Session expired. Please log out and sign back in to change password.'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.'
      }
      setPwdMsg(msg)
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) return
    setResetSending(true)
    setPwdMsg('')
    try {
      await sendPasswordResetEmail(auth, user.email)
      setPwdMsg(`✓ Password reset email sent to ${user.email}. Check your inbox!`)
    } catch (err) {
      setPwdMsg(err.message || 'Failed to send reset link.')
    } finally {
      setResetSending(false)
    }
  }

  async function handleSendAdminQuery(e) {
    e.preventDefault()
    if (!querySubject.trim() || !queryMessage.trim()) {
      setQueryMsg('Please fill in both subject and message.')
      return
    }
    setQuerySending(true)
    setQueryMsg('')
    try {
      if (isFirebaseConfigured && db) {
        await addDoc(collection(db, 'admin_queries'), {
          uid: user?.uid || 'anon',
          senderName: name,
          senderEmail: user?.email || '',
          subject: querySubject.trim(),
          message: queryMessage.trim(),
          status: 'pending',
          createdAt: serverTimestamp()
        })
      }
      setQueryMsg('✓ Message submitted! Administrator will reply shortly.')
      setTimeout(() => {
        setQueryMsg('')
        setQuerySubject('')
        setQueryMessage('')
        setSubview('menu')
      }, 1500)
    } catch (err) {
      setQueryMsg(err.message || 'Error sending query. Please send direct email.')
    } finally {
      setQuerySending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* SUBVIEW 1: MENU ROOT */}
        {subview === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0 18px 0' }}>
            {/* HERO PROFILE CARD */}
            <div className="swl-profile-hero" style={{ position: 'relative', margin: '0 16px', borderRadius: 18, padding: '18px 16px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <UserAvatar
                  name={name}
                  photoURL={profilePhoto}
                  size={78}
                  fontSize="2rem"
                  border="3px solid #1E5AE6"
                  title={profilePhoto ? "Click to view full photo" : `${name}'s Profile Initial`}
                  onClick={() => {
                    if (profilePhoto && onViewSelfie) {
                      onViewSelfie({
                        photoUrl: profilePhoto,
                        name: `${name}'s Profile Photo`,
                        date: todayRecord?.date || todayKey,
                        time: todayRecord?.checkInTime ? formatTime(todayRecord.checkInTime) : 'Profile Avatar'
                      })
                    }
                  }}
                />
                <label
                  htmlFor="emp-photo-input"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    background: '#1E5AE6',
                    color: '#fff',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: photoUploading ? 'wait' : 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                    border: '2px solid #FFFFFF',
                    fontSize: '0.8rem'
                  }}
                  title="Upload / Change Profile Photo"
                >
                  {photoUploading ? '⏳' : '📷'}
                  <input
                    id="emp-photo-input"
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelected}
                  />
                </label>
              </div>

              <div style={{ marginTop: 6 }}>
                <label
                  htmlFor="emp-photo-input"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: 999,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: '#1E5AE6',
                    cursor: 'pointer'
                  }}
                >
                  📷 {photoUploading ? 'Saving Photo...' : 'Change Profile Photo'}
                </label>
              </div>

              {photoMsg && (
                <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
                  {photoMsg}
                </div>
              )}

              <h3 style={{ margin: '8px 0 2px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                {name}
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
                {role} • <span style={{ color: '#1E5AE6', fontWeight: 700 }}>{empId}</span>
              </p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span className="swl-badge-pill green">Active Member</span>
                <span className="swl-badge-pill" style={{ background: '#EEF4FF', color: '#1E5AE6' }}>
                  {user?.email}
                </span>
              </div>
            </div>

            {/* QUICK STATS STRIP */}
            {(() => {
              const todayLate = getAttendanceLateInfo(todayRecord, officeTiming)
              return (
                <div style={{ margin: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Today Shift</div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: todayLate.isLate ? '#D97706' : (todayRecord?.checkInTime ? '#10B981' : '#F59E0B'), marginTop: 3 }}>
                      {todayLate.isLate
                        ? (todayRecord?.checkOutTime ? 'Completed (Late)' : `Late (+${todayLate.lateText})`)
                        : (todayRecord?.checkOutTime ? 'Completed' : (todayRecord?.checkInTime ? `In ${formatTime(todayRecord.checkInTime)}` : 'Pending'))}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>GPS Radius</div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1E5AE6', marginTop: 3 }}>
                      {officeConfig?.radiusMeters || 100}m Strict
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Account Status</div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#10B981', marginTop: 3 }}>
                      Active ✓
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* SECTION 1: ACCOUNT & SETTINGS */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Account &amp; Security
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={() => setSubview('personal_info')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.User />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Personal Information</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Name, phone &amp; department profile</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => setSubview('change_password')} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Lock />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Change Password</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Update employee login password</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* SECTION 2: ATTENDANCE & WORKSPACE */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Work &amp; Attendance
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={() => onNavigate('emp_history')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Attendance active={false} />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Attendance History</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Punch timestamps &amp; calendar view</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => onNavigate('emp_leave')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Leave active={false} />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Leave Requests</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Apply leave &amp; check approvals</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => setSubview('settings')} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Settings />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Office Geofence Info</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Verified premise ({officeConfig?.radiusMeters || 100}m radius)</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* SECTION 3: SUPPORT & EXIT */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Support &amp; Session
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={() => setSubview('contact_admin')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Mail />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Contact Admin Desk</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#1E5AE6', fontWeight: 600 }}>admin@softwindlabs.com</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item logout" onClick={onLogout} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Logout />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#EF4444' }}>Sign Out</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#94A3B8' }}>End session on this device</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* WORKSPACE IDENTITY & SYSTEM CARD AT THE BOTTOM */}
            <div style={{ margin: '4px 16px 8px 16px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.82rem' }}>🛡️</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Softwind Labs Enterprise Portal</span>
              </div>
              <p style={{ margin: '4px 0 8px 0', fontSize: '0.64rem', color: '#64748B', lineHeight: 1.4 }}>
                Protected with strict GPS geofencing &amp; facial selfie verification • v2.4
              </p>
              <AppUpdateSyncButton />
            </div>
          </div>
        )}

        {/* SUBVIEW 2: PERSONAL INFORMATION */}
        {subview === 'personal_info' && (
          <div>
            <div className="swl-subview-header">
              <button
                type="button"
                className="swl-nav-back-btn"
                onClick={() => setSubview('menu')}
              >
                <Icons.BackArrow />
              </button>
              <h4 className="swl-subview-title">Personal Information</h4>
              <div style={{ width: 18 }} />
            </div>

            <form onSubmit={handleSavePersonalInfo} className="swl-subview-wrap">
              <div className="swl-card-white" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Photo Upload Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
                  <UserAvatar
                    name={name}
                    photoURL={profilePhoto}
                    size={56}
                    fontSize="1.4rem"
                    border="2.5px solid #1E5AE6"
                  />
                  <div>
                    <label
                      htmlFor="emp-photo-input-subview"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: '#EEF4FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#1E5AE6',
                        cursor: 'pointer'
                      }}
                    >
                      📷 {photoUploading ? 'Saving...' : 'Upload New Photo'}
                      <input
                        id="emp-photo-input-subview"
                        type="file"
                        accept="image/*"
                        disabled={photoUploading}
                        style={{ display: 'none' }}
                        onChange={handlePhotoSelected}
                      />
                    </label>
                    <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 4 }}>
                      Supported formats: JPG, PNG, WebP
                    </div>
                  </div>
                </div>

                <div>
                  <label className="swl-input-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="swl-input-field"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="swl-input-label">Work Email (Registered)</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="swl-input-field"
                    style={{ background: '#F8FAFC', color: '#64748B' }}
                  />
                </div>

                <div>
                  <label className="swl-input-label">Mobile Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="swl-input-field"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="swl-input-label">Department / Designation</label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="swl-input-field"
                    placeholder="Software Engineering"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="swl-input-label">Employee ID</label>
                    <input
                      type="text"
                      disabled
                      value={empId}
                      className="swl-input-field"
                      style={{ background: '#F8FAFC', color: '#64748B' }}
                    />
                  </div>
                  <div>
                    <label className="swl-input-label">Joining Date</label>
                    <input
                      type="text"
                      disabled
                      value={joinDate}
                      className="swl-input-field"
                      style={{ background: '#F8FAFC', color: '#64748B' }}
                    />
                  </div>
                </div>
              </div>

              {infoMsg && (
                <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, background: infoMsg.startsWith('✓') ? '#ECFDF5' : '#FEE2E2', color: infoMsg.startsWith('✓') ? '#059669' : '#DC2626' }}>
                  {infoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={infoSaving}
                className="swl-btn-login"
                style={{ marginTop: 4 }}
              >
                {infoSaving ? 'Saving Updates…' : 'Save Personal Details'}
              </button>
            </form>
          </div>
        )}

        {/* SUBVIEW 3: CONTACT ADMIN (OFFICIAL ADMIN EMAIL GIVEN) */}
        {subview === 'contact_admin' && (
          <div>
            <div className="swl-subview-header">
              <button
                type="button"
                className="swl-nav-back-btn"
                onClick={() => setSubview('menu')}
              >
                <Icons.BackArrow />
              </button>
              <h4 className="swl-subview-title">Contact Administrator</h4>
              <div style={{ width: 18 }} />
            </div>

            <div className="swl-subview-wrap">
              {/* Prominent Official Admin Email Card */}
              <div className="swl-contact-card">
                <div className="swl-contact-card-top">
                  <div className="swl-contact-icon-bubble">✉️</div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 800 }}>
                      Official HR &amp; Admin Email
                    </div>
                    <div className="swl-contact-email-badge">
                      {ADMIN_OFFICIAL_EMAIL}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#3B82F6', marginTop: 2 }}>
                      Replies typically within 24 business hours
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:${ADMIN_OFFICIAL_EMAIL}?subject=Attendance%20Portal%20Inquiry%20-%20${encodeURIComponent(name)}`}
                  className="swl-btn-email-action"
                >
                  <span>✉️</span>
                  <span>Send Direct Email to Administrator</span>
                </a>
              </div>

              {/* In-App Query Message Form */}
              <form onSubmit={handleSendAdminQuery} className="swl-card-white" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                  📝 Send Quick Inquiry to Admin
                </h4>

                <div>
                  <label className="swl-input-label">Subject</label>
                  <input
                    type="text"
                    required
                    value={querySubject}
                    onChange={(e) => setQuerySubject(e.target.value)}
                    className="swl-input-field"
                    placeholder="e.g. Punch adjustment / Profile query"
                  />
                </div>

                <div>
                  <label className="swl-input-label">Message Details</label>
                  <textarea
                    rows={4}
                    required
                    value={queryMessage}
                    onChange={(e) => setQueryMessage(e.target.value)}
                    className="swl-input-field"
                    placeholder="Explain your query or issue for the administrator..."
                    style={{ resize: 'none' }}
                  />
                </div>

                {queryMsg && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, background: queryMsg.startsWith('✓') ? '#ECFDF5' : '#FEE2E2', color: queryMsg.startsWith('✓') ? '#059669' : '#DC2626' }}>
                    {queryMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={querySending}
                  className="swl-btn-login"
                  style={{ marginTop: 2 }}
                >
                  {querySending ? 'Submitting Message…' : 'Submit Query to Admin'}
                </button>
              </form>

              {/* Company Admin Support Info */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px', fontSize: '0.7rem', color: '#64748B' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>🏢 Softwind Labs Corporate Helpdesk</div>
                <div>Office Hours: {officeTiming?.workDays || 'Mon–Sat'}, {formatTime24to12(officeTiming?.startTime || '09:00')} – {formatTime24to12(officeTiming?.endTime || '18:00')} IST</div>
                <div>Urgent Helpline: +91 (011) 4567-8900</div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW 4: CHANGE PASSWORD */}
        {subview === 'change_password' && (
          <div>
            <div className="swl-subview-header">
              <button
                type="button"
                className="swl-nav-back-btn"
                onClick={() => setSubview('menu')}
              >
                <Icons.BackArrow />
              </button>
              <h4 className="swl-subview-title">Change Password</h4>
              <div style={{ width: 18 }} />
            </div>

            <form onSubmit={handleChangePassword} className="swl-subview-wrap">
              <div className="swl-card-white" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Current Password Field with Eye Toggle */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="swl-input-label" style={{ margin: 0 }}>Current Password</label>
                    <button
                      type="button"
                      disabled={resetSending}
                      onClick={handleSendResetEmail}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1E5AE6',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {resetSending ? 'Sending link…' : 'Forgot password?'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      name="user_current_token"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="swl-input-field"
                      placeholder="Enter your current password"
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showCurrentPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showCurrentPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>

                {/* New Password Field with Eye Toggle */}
                <div>
                  <label className="swl-input-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      name="user_new_token"
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="swl-input-field"
                      placeholder="Minimum 6 characters"
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showNewPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showNewPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Field with Eye Toggle */}
                <div>
                  <label className="swl-input-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      name="user_confirm_token"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="swl-input-field"
                      placeholder="Re-type new password"
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showConfirmPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showConfirmPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>
              </div>

              {pwdMsg && (
                <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, background: pwdMsg.startsWith('✓') ? '#ECFDF5' : '#FEE2E2', color: pwdMsg.startsWith('✓') ? '#059669' : '#DC2626' }}>
                  {pwdMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={pwdSaving}
                className="swl-btn-login"
                style={{ marginTop: 4 }}
              >
                {pwdSaving ? 'Updating Password…' : 'Save New Password'}
              </button>
            </form>
          </div>
        )}

        {/* SUBVIEW 5: SETTINGS & WORKPLACE */}
        {subview === 'settings' && (
          <div>
            <div className="swl-subview-header">
              <button
                type="button"
                className="swl-nav-back-btn"
                onClick={() => setSubview('menu')}
              >
                <Icons.BackArrow />
              </button>
              <h4 className="swl-subview-title">Workplace & Network</h4>
              <div style={{ width: 18 }} />
            </div>

            <div className="swl-subview-wrap">
              <div className="swl-card-white" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                  📍 Office Geofence & Shift Rules
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.6 }}>
                  <div>• <strong>Allowed Radius:</strong> {officeConfig?.radiusMeters || 100} meters around headquarters</div>
                  <div>• <strong>Office Working Hours:</strong> {formatTime24to12(officeTiming?.startTime || '09:00')} – {formatTime24to12(officeTiming?.endTime || '18:00')} IST ({officeTiming?.workDays || 'Mon–Sat'})</div>
                  <div>• <strong>Grace Time:</strong> {officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30} minutes grace period</div>
                  <div>• <strong>Verification Mode:</strong> Live Face Selfie + GPS Validation</div>
                </div>
              </div>

              <div className="swl-card-white" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.72rem', color: '#64748B' }}>
                <div style={{ fontWeight: 800, color: '#0F172A' }}>Software Version</div>
                <div>Softwind Labs Attendance Core v2.4.0 (PWA Ready)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('emp_profile')}>
          <Icons.Profile active={true} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   7. LIVE ADMIN DASHBOARD SCREEN (SCREEN 9)
   ========================================================================= */
function LiveAdminDashboardScreen({ onNavigate, onOpenGeofence, onOpenTiming, onOpenAttendanceModal, onViewSelfie, officeTiming }) {
  const { user, profile } = useAuth()
  const { pushPermission, requestPushPermission } = useNotifications()
  const todayKey = todayDateKey()
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [presentEmployees, setPresentEmployees] = useState(0)
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0)
  const [todayPunches, setTodayPunches] = useState([])

  const lateEmployees = useMemo(() => {
    return todayPunches.filter(r => getAttendanceLateInfo(r, officeTiming).isLate).length
  }, [todayPunches, officeTiming])

  const cutoffDisplay = useMemo(() => {
    try {
      const [h, m] = (officeTiming?.startTime || '09:00').split(':').map(Number)
      const totalM = h * 60 + m + Number(officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30)
      const cutoffH = Math.floor(totalM / 60) % 24
      const cutoffM = totalM % 60
      return formatTime24to12(`${String(cutoffH).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}`)
    } catch {
      return '09:30 AM'
    }
  }, [officeTiming])

  // Listen to live users and today attendance
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      // Exclude Admin: Admin is a manager, not a worker whose attendance is tracked
      const workersOnly = allUsers.filter(u => !isUserAdmin(u))
      setTotalEmployees(workersOnly.length)
    })

    const qAtt = query(collection(db, 'attendance'), where('date', '==', todayKey))
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Only include worker attendance records
      const workerRecords = records.filter(r => !isUserAdmin(r))
      setTodayPunches(workerRecords)
      setPresentEmployees(workerRecords.length)
    })

    const qLeaves = query(collection(db, 'leaves'), where('status', '==', 'pending'))
    const unsubLeaves = onSnapshot(qLeaves, (snap) => {
      setPendingLeavesCount(snap.docs.length)
    })

    return () => {
      unsubUsers()
      unsubAtt()
      unsubLeaves()
    }
  }, [todayKey])

  const absentEmployees = Math.max(0, totalEmployees - presentEmployees)
  const presentPct = totalEmployees > 0 ? Math.round((presentEmployees / totalEmployees) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div onClick={onOpenGeofence} style={{ cursor: 'pointer', padding: 2 }} title="Office Geofence Setup">
              <Icons.LocationPin />
            </div>
            <div
              onClick={onOpenTiming}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#FEF3C7',
                color: '#D97706',
                fontSize: '0.82rem',
                border: '1px solid #FDE68A'
              }}
              title="Office Timings & Shift Setup"
            >
              ⏰
            </div>
          </div>
          <span>Admin Dashboard</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="swl-bell-btn" style={{ width: 28, height: 28 }} onClick={() => onNavigate('adm_approvals')}>
              <Icons.Bell />
              {pendingLeavesCount > 0 && <div className="swl-bell-badge" />}
            </div>
            <div onClick={() => onNavigate('adm_profile')} style={{ cursor: 'pointer' }} title="Admin Profile">
              <UserAvatar
                name={profile?.name || user?.displayName || 'Jai Chaturvedi'}
                photoURL={profile?.photoURL || user?.photoURL}
                size={28}
                fontSize="0.75rem"
                border="1.5px solid #1E5AE6"
              />
            </div>
          </div>
        </div>

        {/* Pop-up Notification Permission Card */}
        {pushPermission !== 'granted' && pushPermission !== 'unsupported' && typeof window !== 'undefined' && 'Notification' in window && (
          <div
            style={{
              margin: '0 16px 10px 16px',
              background: 'linear-gradient(135deg, #EEF4FF 0%, #E0E7FF 100%)',
              border: '1.5px solid #BFDBFE',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              boxShadow: '0 2px 8px rgba(30, 90, 230, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>🔔</span>
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1E293B' }}>
                  Enable Pop-up Alerts
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>
                  Get real-time alerts on your phone when staff punches in
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={requestPushPermission}
              style={{
                background: '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Allow
            </button>
          </div>
        )}

        {/* 4 Stats in 2x2 Grid */}
        <div className="swl-admin-stats-2x2">
          <div className="swl-admin-stat-card" onClick={() => onNavigate('adm_employees')} style={{ cursor: 'pointer' }}>
            <div className="swl-admin-stat-icon blue">👥</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Total Employees</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{totalEmployees}</div>
            </div>
          </div>

          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon green">✓</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Present</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>{presentEmployees}</div>
            </div>
          </div>

          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon red">✕</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Absent</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EF4444' }}>{absentEmployees}</div>
            </div>
          </div>

          <div className="swl-admin-stat-card" onClick={onOpenTiming} style={{ cursor: 'pointer' }} title="Click to view/change Office Timings">
            <div className="swl-admin-stat-icon orange">🕒</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Late</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F59E0B' }}>{lateEmployees}</div>
              <div style={{ fontSize: '0.58rem', color: '#D97706', fontWeight: 700, marginTop: 1 }}>After {cutoffDisplay}</div>
            </div>
          </div>
        </div>

        {/* Today's Attendance Donut Card */}
        <div className="swl-summary-card" style={{ margin: '0 16px' }}>
          <div className="swl-summary-title">Today's Attendance</div>
          <div className="swl-donut-row">
            <div className="swl-donut-container">
              <svg className="swl-donut-svg" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.8"
                  strokeDasharray={`${presentPct}, 100`}
                />
              </svg>
              <div className="swl-donut-center-text" style={{ fontSize: '0.72rem' }}>
                {presentPct}%<br/>
                <span style={{ fontSize: '0.55rem', color: '#10B981' }}>Present</span>
              </div>
            </div>
            <div className="swl-donut-legend">
              <div className="swl-legend-row"><span className="swl-dot green"></span> Present {presentEmployees}</div>
              <div className="swl-legend-row"><span className="swl-dot red"></span> Absent {absentEmployees}</div>
              <div className="swl-legend-row"><span className="swl-dot yellow"></span> Late {lateEmployees}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ margin: '12px 16px 4px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>Quick Actions</div>
        <div className="swl-quick-actions-grid">
          <div className="swl-action-btn-card" onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'add' })} title="Manual punch entry if employee forgot">
            <div style={{ fontSize: '1.25rem', lineHeight: 1 }}>⏱️</div>
            <span>Manual Punch</span>
            <span style={{ fontSize: '0.58rem', color: '#1E5AE6', fontWeight: 700 }}>+ Add / Fix Punch</span>
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate('adm_employees')}>
            <Icons.Employees active={false} />
            <span>Manage Employees</span>
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate('adm_approvals')}>
            <Icons.Leave active={false} />
            <span>Leave Approvals</span>
            {pendingLeavesCount > 0 && <div className="swl-action-badge">{pendingLeavesCount}</div>}
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate('adm_reports')}>
            <Icons.Reports active={false} />
            <span>Reports</span>
          </div>

          <div className="swl-action-btn-card" onClick={onOpenGeofence}>
            <Icons.LocationPin />
            <span>Office Geofence</span>
          </div>

          <div className="swl-action-btn-card" onClick={onOpenTiming} title="Set office shift hours and late grace period">
            <div style={{ fontSize: '1.25rem', lineHeight: 1 }}>⏰</div>
            <span>Office Timings</span>
            <span style={{ fontSize: '0.58rem', color: '#1E5AE6', fontWeight: 700 }}>
              {formatTime24to12(officeTiming?.startTime || '09:00')} (+{officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30}m)
            </span>
          </div>
        </div>

        {/* 📍 Today's Punch Feed */}
        <div style={{ margin: '14px 16px 6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
            📍 Today's Punches ({todayPunches.length})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'add' })}
              style={{
                border: '1px solid #1E5AE6',
                background: '#EEF4FF',
                color: '#1E5AE6',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              + Add Punch
            </button>
            <span
              style={{ fontSize: '0.66rem', color: '#1E5AE6', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => onNavigate('adm_reports')}
            >
              All Reports &gt;
            </span>
          </div>
        </div>

        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
          {todayPunches.length === 0 ? (
            <div style={{ background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 12, padding: '14px', textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8' }}>
              No punch records yet today.
            </div>
          ) : (
            todayPunches.map((punch) => {
              const inUrl = punch.checkInSelfieUrl || punch.checkInPhotoUrl || punch.selfieUrl
              const outUrl = punch.checkOutSelfieUrl || punch.checkOutPhotoUrl
              const loc = punch.checkInLocation || punch.location
              return (
                <div key={punch.id} className="swl-punch-feed-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {inUrl || outUrl ? (
                      <SelfiePairThumbs
                        inUrl={inUrl}
                        outUrl={outUrl}
                        onViewSelfie={onViewSelfie}
                        date={punch.date}
                        name={punch.name}
                        inLoc={punch.checkInLocation}
                        outLoc={punch.checkOutLocation}
                        inTime={punch.checkInTime ? formatTime(punch.checkInTime) : ''}
                        outTime={punch.checkOutTime ? formatTime(punch.checkOutTime) : ''}
                        size={34}
                      />
                    ) : (
                      <UserAvatar
                        name={punch.name || punch.email}
                        photoURL={punch.photoURL}
                        size={34}
                        fontSize="0.75rem"
                      />
                    )}
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                        {punch.name || punch.email?.split('@')[0] || 'Employee'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.66rem', color: '#64748B' }}>
                        In: {punch.checkInTime ? formatTime(punch.checkInTime) : '--'}
                        {punch.checkOutTime ? ` • Out: ${formatTime(punch.checkOutTime)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {(() => {
                      const punchLate = getAttendanceLateInfo(punch, officeTiming)
                      return (
                        <span className={`swl-badge-pill ${punchLate.isLate ? 'yellow' : 'green'}`}>
                          {punchLate.isLate
                            ? (punch.checkOutTime ? 'Out (Late)' : `Late${punchLate.lateText ? ' (+' + punchLate.lateText + ')' : ''}`)
                            : (punch.checkOutTime ? 'Out' : 'Present')}
                        </span>
                      )
                    })()}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LocationBtn location={loc} />
                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'edit', record: r })}
                          title="Edit Attendance"
                          style={{
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#1E5AE6',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm(`Delete attendance record for ${r.name || 'Employee'} on ${r.date}?`)
                            if (ok && isFirebaseConfigured && db) {
                              try {
                                await deleteDoc(doc(db, 'attendance', r.id))
                              } catch (e) {
                                alert('Delete error: ' + e.message)
                              }
                            }
                          }}
                          title="Delete Record"
                          style={{
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'edit', record: punch })}
                        title="Edit Check-In / Check-Out"
                        style={{
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          color: '#1E5AE6',
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = window.confirm(`Are you sure you want to delete today's attendance record for ${punch.name || 'Employee'}?`)
                          if (ok && isFirebaseConfigured && db) {
                            try {
                              await deleteDoc(doc(db, 'attendance', punch.id))
                            } catch (e) {
                              alert('Delete error: ' + e.message)
                            }
                          }
                        }}
                        title="Delete Attendance Record"
                        style={{
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Admin Bottom Nav with 5 tabs */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={true} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   8. LIVE ADMIN EMPLOYEES SCREEN (SCREEN 10) - LIST, SEARCH & ADD MEMBER
   ========================================================================= */
function LiveAdminEmployeesScreen({ onNavigate, onSelectEmployee, officeTiming }) {
  const todayKey = todayDateKey()
  const [users, setUsers] = useState([])
  const [todayAtt, setTodayAtt] = useState([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [empToDelete, setEmpToDelete] = useState(null)
  const [actionNotice, setActionNotice] = useState('')

  // Stream users and today attendance
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      setUsers(list)
    })

    const qAtt = query(collection(db, 'attendance'), where('date', '==', todayKey))
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setTodayAtt(snap.docs.map(d => d.data()))
    })

    return () => {
      unsubUsers()
      unsubAtt()
    }
  }, [todayKey])

  // Combine user info with account status and today's attendance status
  const employeesWithStatus = useMemo(() => {
    return users.map((u, i) => {
      const isAdminAccount = isUserAdmin(u)
      const att = todayAtt.find(a => a.uid === u.uid)
      let attStatus = 'Absent'
      let isLate = false
      let lateText = ''
      let lateMinutes = 0
      if (isAdminAccount) {
        attStatus = 'Admin' // Admin is NEVER 'Absent' or 'Present'
      } else if (att) {
        const lateInfo = getAttendanceLateInfo(att, officeTiming)
        isLate = lateInfo.isLate
        lateText = lateInfo.lateText
        lateMinutes = lateInfo.lateMinutes
        if (isLate) {
          attStatus = att.checkOutTime ? 'Out (Late)' : (lateText ? `Late (+${lateText})` : 'Late')
        } else if (att.checkOutTime) {
          attStatus = 'Completed'
        } else {
          attStatus = 'Present'
        }
      }
      const isAccountDisabled = u.status === 'disabled' || Boolean(u.disabled)
      return {
        ...u,
        name: u.name || u.email?.split('@')[0] || (isAdminAccount ? 'Admin' : 'Employee'),
        role: isAdminAccount ? 'Administrator' : (u.role || 'Staff Member'),
        isAdmin: isAdminAccount,
        attStatus,
        status: attStatus,
        isLate,
        lateText,
        lateMinutes,
        att,
        isAccountDisabled,
        accountStatus: isAccountDisabled ? 'disabled' : 'active',
        photoURL: u.photoURL || null,
        avatar: u.photoURL || null
      }
    })
  }, [users, todayAtt, officeTiming])

  const filtered = employeesWithStatus.filter((emp) => {
    let matchesFilter = true
    if (filter === 'Active') matchesFilter = !emp.isAccountDisabled
    else if (filter === 'Disabled') matchesFilter = emp.isAccountDisabled
    else if (filter === 'Present') matchesFilter = !emp.isAdmin && Boolean(emp.att) && !emp.isLate
    else if (filter === 'Absent') matchesFilter = !emp.isAdmin && !emp.att
    else if (filter === 'Late') matchesFilter = !emp.isAdmin && emp.isLate

    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
                          (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  async function handleToggleStatus(e, emp) {
    e.stopPropagation()
    const newStatus = emp.isAccountDisabled ? 'active' : 'disabled'
    try {
      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'users', emp.uid), {
          status: newStatus,
          disabled: newStatus === 'disabled',
          updatedAt: serverTimestamp()
        })
      }
      setActionNotice(`✓ ${emp.name} account set to ${newStatus.toUpperCase()}`)
      setTimeout(() => setActionNotice(''), 2500)
    } catch (err) {
      alert('Error updating user status: ' + (err.message || 'Permission denied'))
    }
  }

  async function handleConfirmDelete() {
    if (!empToDelete) return
    const target = empToDelete
    setEmpToDelete(null)
    try {
      if (isFirebaseConfigured && db) {
        await deleteDoc(doc(db, 'users', target.uid))
      }
      setActionNotice(`🗑️ Permanently deleted profile for ${target.name}`)
      setTimeout(() => setActionNotice(''), 2500)
    } catch (err) {
      alert('Error deleting user: ' + (err.message || 'Permission denied'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Employees</span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              background: '#1E5AE6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Add
          </button>
        </div>

        {/* Action toast */}
        {actionNotice && (
          <div style={{ margin: '6px 16px 0 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '6px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700 }}>
            {actionNotice}
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '8px 16px 4px 16px' }}>
          <div className="swl-input-box" style={{ padding: '8px 12px' }}>
            <Icons.Search />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="swl-filter-chips">
          {['All', 'Active', 'Disabled', 'Present', 'Absent', 'Late'].map((f) => {
            let count = employeesWithStatus.length
            if (f === 'Active') count = employeesWithStatus.filter(e => !e.isAccountDisabled).length
            else if (f === 'Disabled') count = employeesWithStatus.filter(e => e.isAccountDisabled).length
            else if (f === 'Present') count = employeesWithStatus.filter(e => !e.isAdmin && Boolean(e.att) && !e.isLate).length
            else if (f === 'Absent') count = employeesWithStatus.filter(e => !e.isAdmin && !e.att).length
            else if (f === 'Late') count = employeesWithStatus.filter(e => !e.isAdmin && e.isLate).length

            return (
              <button
                key={f}
                className={`swl-filter-chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f} ({count})
              </button>
            )
          })}
        </div>

        {/* Employee List */}
        <div className="swl-emp-list" style={{ paddingBottom: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '0.78rem' }}>
              No employees match the selected filter.
            </div>
          ) : (
            filtered.map((emp) => {
              const isAccDisabled = emp.isAccountDisabled
              return (
                <div
                  key={emp.uid}
                  className="swl-emp-item"
                  onClick={() => onSelectEmployee(emp)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    opacity: isAccDisabled ? 0.8 : 1,
                    borderLeft: isAccDisabled ? '3px solid #EF4444' : '3px solid #10B981'
                  }}
                >
                  <div className="swl-emp-item-left" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <UserAvatar name={emp.name} photoURL={emp.photoURL || emp.avatar} size={36} />
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p className="swl-emp-name" style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {emp.name}
                        </p>
                        {isAccDisabled ? (
                          <span style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: '0.58rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>
                            Disabled
                          </span>
                        ) : (
                          <span style={{ background: '#ECFDF5', color: '#047857', fontSize: '0.58rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>
                            Active
                          </span>
                        )}
                      </div>
                      <p className="swl-emp-sub" style={{ margin: 0 }}>{emp.role}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    {emp.isAdmin ? (
                      <span className="swl-badge-pill" style={{ background: '#EEF4FF', color: '#1E5AE6', fontSize: '0.62rem', fontWeight: 800 }}>
                        👑 Administrator
                      </span>
                    ) : (
                      <span className={`swl-badge-pill ${emp.isLate ? 'yellow' : (emp.status === 'Absent' ? 'red' : 'green')}`} style={{ fontSize: '0.62rem' }}>
                        {emp.status}
                      </span>
                    )}

                    {!emp.isAdmin && (
                      <>
                        {/* Quick Disable / Enable Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStatus(e, emp)}
                          title={isAccDisabled ? 'Click to Enable Account' : 'Click to Disable Account'}
                          style={{
                            background: isAccDisabled ? '#ECFDF5' : '#FFF1F2',
                            color: isAccDisabled ? '#059669' : '#E11D48',
                            border: isAccDisabled ? '1px solid #A7F3D0' : '1px solid #FECDD3',
                            borderRadius: 6,
                            padding: '3px 7px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {isAccDisabled ? 'Enable' : 'Disable'}
                        </button>

                        {/* Quick Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEmpToDelete(emp)
                          }}
                          title={`Permanently delete profile for ${emp.name}`}
                          style={{
                            background: '#F8FAFC',
                            color: '#64748B',
                            border: '1px solid #E2E8F0',
                            borderRadius: 6,
                            padding: '3px 6px',
                            fontSize: '0.68rem',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Admin Bottom Nav with 5 tabs */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={true} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <LiveAddEmployeeModal onClose={() => setShowAddModal(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {empToDelete && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setEmpToDelete(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: '22px 20px',
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: 6 }}>🗑️</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              Delete Employee?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.74rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete profile for <strong>{empToDelete.name || empToDelete.email}</strong>?
              <br />
              <span style={{ color: '#EF4444', fontWeight: 600 }}>This action cannot be undone.</span>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEmpToDelete(null)}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#F1F5F9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   9. LIVE ADMIN EMPLOYEE DETAILS (SCREEN 11) - PROFILE, ACCESS CONTROL & RECORDS
   ========================================================================= */
function LiveEmployeeDetailsScreen({ employee, onNavigate, onViewSelfie, origin, officeTiming, onOpenAttendanceModal }) {
  const { resetEmployeeDeviceBinding } = useAuth()
  const [deviceResetting, setDeviceResetting] = useState(false)
  const [empPhotoUploading, setEmpPhotoUploading] = useState(false)
  const [tab, setTab] = useState('attendance')
  const [records, setRecords] = useState([])
  const [userDoc, setUserDoc] = useState(employee)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [detailNotice, setDetailNotice] = useState('')
  const curMonth = monthKey()

  useEffect(() => {
    if (!employee?.uid || !isFirebaseConfigured || !db) return
    const unsub = onSnapshot(doc(db, 'users', employee.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserDoc({ uid: docSnap.id, ...docSnap.data() })
      }
    })
    return () => unsub()
  }, [employee?.uid])

  useEffect(() => {
    if (!employee?.uid || !isFirebaseConfigured || !db) return
    const q = query(
      collection(db, 'attendance'),
      where('uid', '==', employee.uid),
      where('month', '==', curMonth)
    )
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [employee?.uid, curMonth])

  const name = userDoc?.name || employee?.name || 'Employee'
  const role = userDoc?.role || employee?.role || employee?.designation || 'Staff'
  const email = userDoc?.email || employee?.email || 'N/A'
  const phone = userDoc?.phone || employee?.phone || '+91 98765 43210'
  const empId = userDoc?.employeeId || employee?.employeeId || employee?.empId || 'SWL-1024'
  const isAccDisabled = userDoc?.status === 'disabled' || Boolean(userDoc?.disabled)

  async function handleToggleStatus() {
    if (statusUpdating || !userDoc?.uid) return
    setStatusUpdating(true)
    const newStatus = isAccDisabled ? 'active' : 'disabled'
    try {
      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'users', userDoc.uid), {
          status: newStatus,
          disabled: newStatus === 'disabled',
          updatedAt: serverTimestamp()
        })
      }
      setDetailNotice(`✓ Portal access updated to ${newStatus.toUpperCase()}`)
      setTimeout(() => setDetailNotice(''), 2500)
    } catch (err) {
      alert('Error toggling status: ' + (err.message || 'Permission denied'))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConfirmDelete() {
    if (!userDoc?.uid) return
    setShowDeleteModal(false)
    try {
      if (isFirebaseConfigured && db) {
        await deleteDoc(doc(db, 'users', userDoc.uid))
      }
      onNavigate(origin === 'adm_reports' ? 'adm_reports' : 'adm_employees')
    } catch (err) {
      alert('Error deleting employee: ' + (err.message || 'Permission denied'))
    }
  }

  async function handleResetDevice() {
    if (!userDoc?.uid || deviceResetting) return
    const confirmReset = window.confirm(
      `Are you sure you want to reset the registered device for ${name}?\n\nAfter reset, this employee can bind a new phone upon their next login and the previous device lock will be removed.`
    )
    if (!confirmReset) return

    setDeviceResetting(true)
    try {
      if (resetEmployeeDeviceBinding) {
        await resetEmployeeDeviceBinding(userDoc.uid)
      } else if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'users', userDoc.uid), {
          boundDeviceId: null,
          boundDeviceFingerprint: null,
          boundHardwareModelId: null,
          boundDeviceName: null,
          boundPhoneModel: null,
          boundAt: null
        })
      }
      setUserDoc(prev => ({
        ...prev,
        boundDeviceId: null,
        boundDeviceFingerprint: null,
        boundHardwareModelId: null,
        boundDeviceName: null,
        boundPhoneModel: null,
        boundAt: null
      }))
      setDetailNotice('✓ Device link reset successfully! Employee ab naye phone se login kar sakta hai.')
      setTimeout(() => setDetailNotice(''), 3000)
    } catch (err) {
      alert('Error resetting device: ' + (err.message || 'Permission denied'))
    } finally {
      setDeviceResetting(false)
    }
  }

  async function handleAdminUploadEmployeePhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !userDoc?.uid) return
    setEmpPhotoUploading(true)
    try {
      const base64Url = await processImageFile(file, 350, 350, 0.82)
      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'users', userDoc.uid), {
          photoURL: base64Url,
          updatedAt: serverTimestamp()
        })
      }
      setUserDoc(prev => ({ ...prev, photoURL: base64Url }))
      setDetailNotice('✓ Employee photo updated successfully!')
      setTimeout(() => setDetailNotice(''), 3000)
    } catch (err) {
      alert('Error updating photo: ' + (err.message || 'Please retry.'))
    } finally {
      setEmpPhotoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button
            className="swl-nav-back-btn"
            onClick={() => onNavigate(origin === 'adm_reports' ? 'adm_reports' : 'adm_employees')}
          >
            <Icons.BackArrow />
          </button>
          <span>Member Profile</span>
          <div style={{ width: 18 }} />
        </div>

        {/* Profile Card */}
        <div style={{ padding: '14px 16px', background: '#FFFFFF', margin: '10px 16px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <UserAvatar
                name={name}
                photoURL={userDoc?.photoURL || employee?.photoURL}
                size={52}
                fontSize="1.35rem"
                border={isAccDisabled ? '2px solid #EF4444' : '2px solid #1E5AE6'}
              />
              <label
                htmlFor="admin-emp-photo-input"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#1E5AE6',
                  color: '#fff',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.62rem',
                  cursor: empPhotoUploading ? 'wait' : 'pointer',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
                title="Admin: Change employee photo"
              >
                {empPhotoUploading ? '⏳' : '📷'}
                <input
                  id="admin-emp-photo-input"
                  type="file"
                  accept="image/*"
                  disabled={empPhotoUploading}
                  style={{ display: 'none' }}
                  onChange={handleAdminUploadEmployeePhoto}
                />
              </label>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>{name}</h4>
                {isAccDisabled ? (
                  <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '1px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 800 }}>
                    Disabled
                  </span>
                ) : (
                  <span style={{ background: '#ECFDF5', color: '#047857', padding: '1px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 800 }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                <span style={{ background: '#EEF4FF', color: '#1E5AE6', padding: '1px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700 }}>
                  {empId}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{role}</span>
                <label
                  htmlFor="admin-emp-photo-input"
                  style={{
                    fontSize: '0.62rem',
                    color: '#1E5AE6',
                    cursor: 'pointer',
                    fontWeight: 700,
                    textDecoration: 'underline'
                  }}
                >
                  {empPhotoUploading ? 'Saving...' : '📷 Change Photo'}
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.68rem', color: '#475569', background: '#F8FAFC', padding: '8px 10px', borderRadius: 8 }}>
            <div>✉️ <strong>Email:</strong> {email}</div>
            <div>📞 <strong>Phone:</strong> {phone}</div>
          </div>
        </div>

        {/* Action notification */}
        {detailNotice && (
          <div style={{ margin: '0 16px 8px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '7px 12px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700 }}>
            {detailNotice}
          </div>
        )}

        {/* 1 EMPLOYEE = 1 PHONE DEVICE BINDING MANAGEMENT CARD */}
        {(() => {
          const isBound = Boolean(userDoc?.boundDeviceId || userDoc?.boundHardwareModelId || userDoc?.boundDeviceFingerprint)
          const phoneModel = userDoc?.boundDeviceName || userDoc?.boundPhoneModel || 'Linked Mobile Phone'
          const hardwareId = userDoc?.boundHardwareModelId || userDoc?.boundDeviceFingerprint || ''

          return (
            <div style={{ margin: '0 16px 8px 16px', background: isBound ? '#F0FDF4' : '#FFFBEB', border: isBound ? '1px solid #BBF7D0' : '1px solid #FDE68A', borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>📱</span>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isBound ? '#166534' : '#92400E' }}>
                      {isBound ? 'Registered Phone (Locked)' : 'No Phone Bound'}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: isBound ? '#15803D' : '#B45309' }}>
                      {isBound ? phoneModel : 'Pending first employee login on personal phone'}
                    </div>
                  </div>
                </div>
                <span style={{
                  background: isBound ? '#DCFCE7' : '#FEF3C7',
                  color: isBound ? '#166534' : '#92400E',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999
                }}>
                  {isBound ? '1 Phone Lock Active' : 'Unbound'}
                </span>
              </div>

              {isBound && (
                <div style={{ fontSize: '0.65rem', color: '#334155', background: '#FFFFFF', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Phone Model:</strong> {phoneModel}</div>
                  {hardwareId && (
                    <div><strong>Hardware Model ID:</strong> <code style={{ fontSize: '0.65rem', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, color: '#0F172A' }}>{hardwareId}</code></div>
                  )}
                  {userDoc?.boundDeviceId && (
                    <div style={{ wordBreak: 'break-all', color: '#64748B' }}><strong>Device UUID:</strong> {userDoc.boundDeviceId}</div>
                  )}
                </div>
              )}

              {isBound ? (
                <button
                  type="button"
                  disabled={deviceResetting}
                  onClick={handleResetDevice}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {deviceResetting ? 'Resetting Device Lock...' : '🔄 Reset Device Binding (Employee Changed Phone)'}
                </button>
              ) : (
                <div style={{ fontSize: '0.64rem', color: '#B45309', fontStyle: 'italic' }}>
                  ℹ️ Jab employee apne phone se pehli baar login karega, uska phone model aur hardware ID is account se permanently link ho jayenge.
                </div>
              )}
            </div>
          )
        })()}

        {/* Account Access & Status Control Card */}
        {isAccDisabled ? (
          <div style={{ margin: '0 16px 8px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>🚫</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#991B1B' }}>Account Deactivated</div>
                  <div style={{ fontSize: '0.64rem', color: '#B91C1C' }}>Employee is blocked from clocking in & mobile actions.</div>
                </div>
              </div>
              <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>Disabled</span>
            </div>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={handleToggleStatus}
              style={{ width: '100%', padding: '8px', background: '#059669', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {statusUpdating ? 'Updating...' : '✓ Re-Enable Employee Portal Access'}
            </button>
          </div>
        ) : (
          <div style={{ margin: '0 16px 8px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>🟢</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065F46' }}>Account Active</div>
                  <div style={{ fontSize: '0.64rem', color: '#047857' }}>Employee has verified access to check in and apply leaves.</div>
                </div>
              </div>
              <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>Active</span>
            </div>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={handleToggleStatus}
              style={{ width: '100%', padding: '8px', background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {statusUpdating ? 'Updating...' : '⏸️ Deactivate / Disable Employee Access'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="swl-tab-pill-row" style={{ margin: '8px 16px' }}>
          <button className={`swl-tab-pill ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
            Attendance ({records.length})
          </button>
          <button className={`swl-tab-pill ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>
            Leave History
          </button>
        </div>

        {tab === 'attendance' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 16px 8px 16px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
              Attendance Records ({records.length})
            </span>
            <button
              type="button"
              onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({
                mode: 'add',
                preselectedUser: {
                  uid: userDoc?.uid || employee?.uid,
                  name: name || employee?.name,
                  email: userDoc?.email || employee?.email,
                  photoURL: userDoc?.photoURL || employee?.photoURL
                }
              })}
              style={{
                border: '1px solid #1E5AE6',
                background: '#EEF4FF',
                color: '#1E5AE6',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              + Add Manual Punch
            </button>
          </div>
        )}

        {/* Records */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: '0.8rem' }}>
              No punch records found for this month.
            </div>
          ) : (
            records.map((r, i) => {
              const inUrl = r.checkInSelfieUrl || r.checkInPhotoUrl || r.selfieUrl
              const outUrl = r.checkOutSelfieUrl || r.checkOutPhotoUrl
              const loc = r.checkInLocation || r.location
              return (
                <div key={r.id || i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SelfiePairThumbs
                      inUrl={inUrl}
                      outUrl={outUrl}
                      onViewSelfie={onViewSelfie}
                      date={r.date}
                      name={name}
                      inLoc={r.checkInLocation}
                      outLoc={r.checkOutLocation}
                      inTime={r.checkInTime ? formatTime(r.checkInTime) : ''}
                      outTime={r.checkOutTime ? formatTime(r.checkOutTime) : ''}
                      size={32}
                    />
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>{r.date}</div>
                      <div style={{ fontSize: '0.66rem', color: '#64748B' }}>
                        {r.checkInTime ? formatTime(r.checkInTime) : '-'} - {r.checkOutTime ? formatTime(r.checkOutTime) : 'Ongoing'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {(() => {
                      const lateInfo = getAttendanceLateInfo(r, officeTiming)
                      return (
                        <span className={`swl-badge-pill ${lateInfo.isLate ? 'yellow' : 'green'}`}>
                          {lateInfo.isLate
                            ? (r.checkOutTime ? `Completed (Late${lateInfo.lateText ? ' +' + lateInfo.lateText : ''})` : `Late${lateInfo.lateText ? ' (+' + lateInfo.lateText : ''}`)
                            : (r.checkOutTime ? 'Completed' : 'Present')}
                        </span>
                      )
                    })()}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LocationBtn location={loc} />
                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'edit', record: r })}
                          title="Edit Attendance"
                          style={{
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#1E5AE6',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm(`Delete attendance record for ${r.name || 'Employee'} on ${r.date}?`)
                            if (ok && isFirebaseConfigured && db) {
                              try {
                                await deleteDoc(doc(db, 'attendance', r.id))
                              } catch (e) {
                                alert('Delete error: ' + e.message)
                              }
                            }
                          }}
                          title="Delete Record"
                          style={{
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'edit', record: r })}
                        title="Edit Attendance Record"
                        style={{
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          color: '#1E5AE6',
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = window.confirm(`Delete attendance record for ${name} on ${r.date}?`)
                          if (ok && isFirebaseConfigured && db) {
                            try {
                              await deleteDoc(doc(db, 'attendance', r.id))
                            } catch (e) {
                              alert('Delete error: ' + e.message)
                            }
                          }
                        }}
                        title="Delete Attendance Record"
                        style={{
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          borderRadius: 5,
                          padding: '2px 6px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Danger Zone: Delete Employee */}
        <div style={{ margin: '14px 16px 16px 16px', background: '#FFF7ED', border: '1px dashed #FDBA74', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#9A3412' }}>Permanent Deletion</div>
            <div style={{ fontSize: '0.64rem', color: '#C2410C' }}>Completely wipe user account and credentials.</div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            style={{ padding: '6px 12px', background: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Admin Bottom Nav with 5 tabs */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={true} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: '22px 20px',
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: 6 }}>🗑️</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              Delete Employee?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.74rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete profile for <strong>{name}</strong>?
              <br />
              <span style={{ color: '#EF4444', fontWeight: 600 }}>This will erase this user from the directory.</span>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#F1F5F9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   10. LIVE ADMIN LEAVE APPROVALS SCREEN (SCREEN 12)
   ========================================================================= */
function LiveLeaveApprovalsScreen({ onNavigate }) {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('Pending')
  const [leaves, setLeaves] = useState([])
  const [selectedProofModal, setSelectedProofModal] = useState(null)
  const [rejectingLeave, setRejectingLeave] = useState(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  useEffect(() => {
    const unsub = subscribeLeaves({
      onUpdate: (list) => setLeaves(list),
      onError: (err) => console.warn('Leaves admin err:', err)
    })
    return () => unsub && unsub()
  }, [])

  const pendingLeaves = leaves.filter(l => l.status === 'pending')
  const approvedLeaves = leaves.filter(l => l.status === 'approved')
  const rejectedLeaves = leaves.filter(l => l.status === 'rejected')

  const currentList = tab === 'Pending' ? pendingLeaves : (tab === 'Approved' ? approvedLeaves : rejectedLeaves)

  async function handleAction(leaveId, newStatus) {
    try {
      await reviewLeaveRequest({
        leaveId,
        status: newStatus,
        reviewedBy: user.uid,
        reviewedByName: profile?.name || 'Admin',
        adminNote: `Reviewed by ${profile?.name || 'Admin'}`
      })
    } catch (err) {
      alert('Action error: ' + err.message)
    }
  }

  async function handleDeleteLeave(leaveId, userName) {
    if (!window.confirm(`Delete this leave record permanently ${userName ? `for ${userName}` : ''}?`)) return
    try {
      setLeaves((prev) => prev.filter((l) => l.id !== leaveId))
      await deleteLeaveRequest({ leaveId })
    } catch (err) {
      alert('Could not delete leave record: ' + err.message)
    }
  }

  async function handleClearTabRecords() {
    if (currentList.length === 0) return
    if (!window.confirm(`Are you sure you want to clear all ${currentList.length} ${tab.toLowerCase()} leave records? This action cannot be undone.`)) {
      return
    }
    const idsToClear = currentList.map((l) => l.id)
    try {
      setLeaves((prev) => prev.filter((l) => !idsToClear.includes(l.id)))
      await clearLeaveRecords({ leaveIds: idsToClear })
    } catch (err) {
      alert('Could not clear records: ' + err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Leave Approvals</span>
          <Icons.Calendar />
        </div>

        {/* Tabs */}
        <div className="swl-tab-pill-row">
          <button className={`swl-tab-pill ${tab === 'Pending' ? 'active' : ''}`} onClick={() => setTab('Pending')}>
            Pending ({pendingLeaves.length})
          </button>
          <button className={`swl-tab-pill ${tab === 'Approved' ? 'active' : ''}`} onClick={() => setTab('Approved')}>
            Approved ({approvedLeaves.length})
          </button>
          <button className={`swl-tab-pill ${tab === 'Rejected' ? 'active' : ''}`} onClick={() => setTab('Rejected')}>
            Rejected ({rejectedLeaves.length})
          </button>
        </div>

        {/* Action Header with Count & Clear Tab Records Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 4px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B' }}>
            {currentList.length} {tab} Request{currentList.length === 1 ? '' : 's'}
          </span>
          {currentList.length > 0 && (
            <button
              type="button"
              onClick={handleClearTabRecords}
              style={{
                background: '#FFF1F2',
                color: '#E11D48',
                border: '1px solid #FECDD3',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
              title={`Clear all ${tab.toLowerCase()} leave records`}
            >
              <span>🗑️ Clear {tab}</span>
            </button>
          )}
        </div>

        {/* List */}
        <div className="swl-approvals-list" style={{ padding: '0 16px 16px' }}>
          {currentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: '#94A3B8', fontSize: '0.8rem' }}>
              No {tab.toLowerCase()} leave requests found.
            </div>
          ) : (
            currentList.map((item) => (
              <div key={item.id} className="swl-approval-card" style={{ padding: 12, borderRadius: 12 }}>
                <div className="swl-approval-top" style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar name={item.userName || item.userEmail} size={34} fontSize="0.75rem" />
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                        {item.userName || item.userEmail?.split('@')[0] || 'Employee'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 600, color: '#1E5AE6' }}>
                        {item.leaveType ? (item.leaveType.charAt(0).toUpperCase() + item.leaveType.slice(1) + ' Leave') : 'Leave'}
                      </p>
                    </div>
                  </div>
                  <span className={`swl-badge-pill ${item.status === 'approved' ? 'green' : (item.status === 'rejected' ? 'red' : 'yellow')}`}>
                    {item.status}
                  </span>
                </div>

                {/* Target Leave Dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', margin: '6px 0 4px' }}>
                  <span style={{ fontSize: '0.82rem' }}>📅</span>
                  <div>
                    <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Leave Dates:</span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>
                      {formatLeaveTargetDates(item.startDate, item.endDate)}
                    </span>
                  </div>
                </div>

                {/* Request Applied Date & Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 6px 2px' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748B' }}>🕒 Requested on:</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155' }}>
                    {formatLeaveRequestDateTime(item.createdAt)}
                  </span>
                </div>

                {/* Reason */}
                {item.reason && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', margin: '4px 0 8px 2px' }}>
                    "{item.reason}"
                  </div>
                )}

                {/* Rejection Reason display if rejected */}
                {item.status === 'rejected' && (item.rejectionReason || item.adminNote) && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: 8,
                    padding: '6px 10px',
                    margin: '4px 0 8px 2px',
                    fontSize: '0.7rem',
                    color: '#991B1B'
                  }}>
                    <strong style={{ color: '#B91C1C' }}>⚠️ Rejection Reason:</strong> {item.rejectionReason || item.adminNote}
                  </div>
                )}

                {item.proofPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedProofModal(item.proofPhotoUrl)}
                    style={{
                      border: '1px solid #F59E0B',
                      background: '#FFFBEB',
                      color: '#B45309',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.68rem',
                      cursor: 'pointer',
                      marginBottom: 8,
                      fontWeight: 700
                    }}
                  >
                    🩺 View Medical Proof Slip
                  </button>
                )}

                {/* Bottom action row with Approve / Reject and Delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                  <div>
                    {item.status === 'pending' ? (
                      <div className="swl-approval-actions" style={{ margin: 0, gap: 6 }}>
                        <button className="swl-btn-approve" onClick={() => handleAction(item.id, 'approved')}>
                          Approve
                        </button>
                        <button
                          className="swl-btn-reject"
                          onClick={() => {
                            setRejectingLeave(item)
                            setRejectionReasonInput('')
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.64rem', color: '#64748B' }}>
                        {item.reviewedByName ? `✓ Reviewed by ${item.reviewedByName}` : '✓ Reviewed'}
                      </span>
                    )}
                  </div>

                  {/* Quick Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteLeave(item.id, item.userName)}
                    style={{
                      border: '1px solid #FECDD3',
                      background: '#FFF1F2',
                      color: '#E11D48',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                    title="Permanently delete this leave record"
                  >
                    <span>🗑️ Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Bottom Nav with 5 tabs */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={true} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>

      {/* Medical Proof Zoom Modal */}
      {selectedProofModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setSelectedProofModal(null)}
        >
          <div style={{ background: '#fff', padding: 12, borderRadius: 16, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Medical Proof Document</h4>
            <img src={selectedProofModal} alt="Medical Proof" style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: 8, objectFit: 'contain' }} />
            <button
              style={{ marginTop: 12, padding: '6px 14px', background: '#1E5AE6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              onClick={() => setSelectedProofModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leave Rejection Reason Modal */}
      {rejectingLeave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => !rejectSubmitting && setRejectingLeave(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: '20px 22px',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>✍️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0F172A' }}>
                  Reject Leave Request
                </h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748B' }}>
                  Employee: <strong>{rejectingLeave.userName || rejectingLeave.userEmail}</strong>
                </p>
              </div>
            </div>

            <p style={{ margin: '8px 0 10px 0', fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
              Please state the reason for rejecting this leave request. This will be visible to the employee:
            </p>

            <textarea
              rows={3}
              required
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="e.g. Project deliverable deadline / Staff unavailability..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.8rem',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                color: '#0F172A'
              }}
              autoFocus
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                disabled={rejectSubmitting}
                onClick={() => setRejectingLeave(null)}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#F1F5F9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectSubmitting}
                onClick={async () => {
                  const reason = rejectionReasonInput.trim()
                  if (!reason) {
                    alert('Please enter a rejection reason.')
                    return
                  }
                  setRejectSubmitting(true)
                  try {
                    await reviewLeaveRequest({
                      leaveId: rejectingLeave.id,
                      status: 'rejected',
                      reviewedBy: user.uid,
                      reviewedByName: profile?.name || 'Admin',
                      adminNote: reason,
                      rejectionReason: reason
                    })
                    setRejectingLeave(null)
                  } catch (err) {
                    alert('Error rejecting leave: ' + err.message)
                  } finally {
                    setRejectSubmitting(false)
                  }
                }}
                style={{
                  flex: 2,
                  padding: '9px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {rejectSubmitting ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   11. LIVE ADMIN REPORTS & CSV EXPORT SCREEN (SCREEN 13)
   ========================================================================= */
function LiveReportsScreen({ onNavigate, onViewSelfie, onSelectEmployee, officeTiming, onOpenAttendanceModal }) {
  const [reportTab, setReportTab] = useState('overview') // 'overview' | 'employees' | 'logs'
  const [timeframe, setTimeframe] = useState('Monthly') // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())

  const curMonth = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = String(currentDate.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [currentDate])

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [currentDate])

  function changeMonth(delta) {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  // Subscribe to live users (exclude admin - admin is not a worker)
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      setUsers(allUsers.filter(u => !isUserAdmin(u)))
    })
    return () => unsub()
  }, [])

  // Subscribe to attendance records
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    const q = query(collection(db, 'attendance'), where('month', '==', curMonth))
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [curMonth])

  const workerRecords = useMemo(() => records.filter(r => !isUserAdmin(r)), [records])
  const presentCount = workerRecords.length
  const lateCount = useMemo(() => {
    return workerRecords.filter(r => getAttendanceLateInfo(r, officeTiming).isLate).length
  }, [workerRecords, officeTiming])
  const absentCount = Math.max(0, (users.length * 24) - presentCount)

  // Per-employee analytics (employees only)
  const employeeSummaries = useMemo(() => {
    return users.map((u, i) => {
      const uRecords = workerRecords.filter(r => r.uid === u.uid || r.email === u.email)
      const uPresent = uRecords.length
      const uLate = uRecords.filter(r => getAttendanceLateInfo(r, officeTiming).isLate).length
      const workingDaysTarget = 24
      const uAbsent = Math.max(0, workingDaysTarget - uPresent)
      const uRate = workingDaysTarget > 0 ? Math.min(100, Math.round((uPresent / workingDaysTarget) * 100)) : 0
      
      // Compute total hours worked
      let totalMinutes = 0
      uRecords.forEach(r => {
        if (r.checkInTime && r.checkOutTime) {
          const inM = r.checkInTime.seconds ? r.checkInTime.seconds : new Date(r.checkInTime).getTime() / 1000
          const outM = r.checkOutTime.seconds ? r.checkOutTime.seconds : new Date(r.checkOutTime).getTime() / 1000
          const diff = Math.max(0, (outM - inM) / 60)
          totalMinutes += diff
        } else if (r.checkInTime) {
          totalMinutes += 480 // standard 8h
        }
      })
      const totalHours = (totalMinutes / 60).toFixed(1)

      return {
        ...u,
        name: u.name || u.email?.split('@')[0] || 'Employee',
        role: u.role || 'Staff Member',
        photoURL: u.photoURL || null,
        avatar: u.photoURL || null,
        totalPunches: uRecords.length,
        presentCount: uPresent,
        lateCount: uLate,
        absentCount: uAbsent,
        rate: uRate,
        totalHours
      }
    })
  }, [users, workerRecords, officeTiming])

  // Filtered punch logs
  const filteredLogs = useMemo(() => {
    return records.filter(r => {
      if (!search.trim()) return true
      const s = search.toLowerCase()
      const n = (r.name || '').toLowerCase()
      const e = (r.email || '').toLowerCase()
      const d = (r.date || '').toLowerCase()
      return n.includes(s) || e.includes(s) || d.includes(s)
    })
  }, [records, search])

  function exportCSV() {
    if (records.length === 0) {
      alert('No attendance records available to export for this month.')
      return
    }
    const headers = ['Date', 'Employee Name', 'Email', 'Check-In Time', 'Check-Out Time', 'Duration (Hours)', 'Status', 'Late', 'GPS Coordinates', 'Selfie Photo URL']
    const rows = records.map(r => {
      const loc = r.checkInLocation || r.location
      const lat = loc?.latitude ?? loc?.lat ?? ''
      const lng = loc?.longitude ?? loc?.lng ?? ''
      const gpsStr = lat && lng ? `${lat},${lng}` : ''
      const selfie = r.checkInSelfieUrl || r.checkInPhotoUrl || ''
      const lateInfo = getAttendanceLateInfo(r, officeTiming)
      return [
        r.date || '',
        `"${r.name || 'Employee'}"`,
        r.email || '',
        r.checkInTime ? formatTime(r.checkInTime) : '',
        r.checkOutTime ? formatTime(r.checkOutTime) : '',
        '8.0',
        r.status || 'present',
        lateInfo.isLate ? `Yes (+${lateInfo.lateText || lateInfo.lateMinutes + 'm'})` : 'No',
        `"${gpsStr}"`,
        `"${selfie}"`
      ]
    })
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `SWL_Attendance_Report_${curMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Attendance Reports</span>
          <div style={{ width: 18 }} />
        </div>

        {/* 3 Report Subtabs */}
        <div className="swl-tab-pill-row" style={{ margin: '8px 16px 4px 16px' }}>
          <button
            className={`swl-tab-pill ${reportTab === 'overview' ? 'active' : ''}`}
            onClick={() => setReportTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`swl-tab-pill ${reportTab === 'employees' ? 'active' : ''}`}
            onClick={() => setReportTab('employees')}
          >
            👥 Employees ({users.length})
          </button>
          <button
            className={`swl-tab-pill ${reportTab === 'logs' ? 'active' : ''}`}
            onClick={() => setReportTab('logs')}
          >
            📋 Punch Logs ({records.length})
          </button>
        </div>

        {/* Timeframe pill tabs */}
        <div className="swl-tab-pill-row" style={{ margin: '4px 16px 8px 16px' }}>
          {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(t => (
            <button
              key={t}
              className={`swl-tab-pill ${timeframe === t ? 'active' : ''}`}
              onClick={() => setTimeframe(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Month Selector Header */}
        <div className="swl-month-header" style={{ fontSize: '0.85rem', margin: '4px 0 10px 0' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => changeMonth(-1)}>&lt;</span>
          <span>{monthLabel}</span>
          <span style={{ cursor: 'pointer' }} onClick={() => changeMonth(1)}>&gt;</span>
        </div>

        {/* SUBTAB 1: OVERVIEW */}
        {reportTab === 'overview' && (
          <div>
            <div className="swl-reports-grid">
              <div className="swl-report-stat">
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Total Punches</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{records.length}</div>
              </div>
              <div className="swl-report-stat">
                <div style={{ fontSize: '0.62rem', color: '#10B981' }}>Present</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10B981' }}>{presentCount}</div>
              </div>
              <div className="swl-report-stat">
                <div style={{ fontSize: '0.62rem', color: '#EF4444' }}>Absent</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EF4444' }}>{absentCount}</div>
              </div>
              <div className="swl-report-stat">
                <div style={{ fontSize: '0.62rem', color: '#F59E0B' }}>Late</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F59E0B' }}>{lateCount}</div>
              </div>
              <div className="swl-report-stat">
                <div style={{ fontSize: '0.62rem', color: '#06B6D4' }}>Employees</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#06B6D4' }}>{users.length}</div>
              </div>
            </div>

            <div style={{ margin: '14px 16px' }}>
              <button
                className="swl-btn-login"
                onClick={exportCSV}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icons.Download />
                <span>Download Full CSV Report</span>
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 2: EMPLOYEE SUMMARY BREAKDOWN */}
        {reportTab === 'employees' && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {employeeSummaries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '0.78rem' }}>
                No registered employees found.
              </div>
            ) : (
              employeeSummaries.map((emp) => (
                <div
                  key={emp.uid}
                  className="swl-emp-summary-card"
                  style={{ cursor: 'pointer', transition: 'transform 0.1s ease, box-shadow 0.1s ease' }}
                  onClick={() => onSelectEmployee && onSelectEmployee(emp)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <UserAvatar name={emp.name} photoURL={emp.photoURL || emp.avatar} size={38} />
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{emp.name}</h4>
                        <p style={{ margin: 0, fontSize: '0.66rem', color: '#64748B' }}>{emp.email}</p>
                      </div>
                    </div>
                    <span className="swl-badge-pill green">{emp.rate}% Rate</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: '#F8FAFC', padding: '6px 8px', borderRadius: 8, textAlign: 'center', fontSize: '0.65rem' }}>
                    <div>
                      <div style={{ color: '#10B981', fontWeight: 800, fontSize: '0.85rem' }}>{emp.presentCount}</div>
                      <div style={{ color: '#64748B' }}>Present</div>
                    </div>
                    <div>
                      <div style={{ color: '#F59E0B', fontWeight: 800, fontSize: '0.85rem' }}>{emp.lateCount}</div>
                      <div style={{ color: '#64748B' }}>Late</div>
                    </div>
                    <div>
                      <div style={{ color: '#EF4444', fontWeight: 800, fontSize: '0.85rem' }}>{emp.absentCount}</div>
                      <div style={{ color: '#64748B' }}>Absent</div>
                    </div>
                    <div>
                      <div style={{ color: '#1E5AE6', fontWeight: 800, fontSize: '0.85rem' }}>{emp.totalHours}h</div>
                      <div style={{ color: '#64748B' }}>Hours</div>
                    </div>
                  </div>

                  <div className="swl-emp-bar-bg">
                    <div className="swl-emp-bar-fill" style={{ width: `${emp.rate}%` }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748B' }}>Click to view profile & records</span>
                    <span style={{ fontSize: '0.68rem', color: '#1E5AE6', fontWeight: 800 }}>
                      View Member Profile &gt;
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SUBTAB 3: DETAILED PUNCH LOGS */}
        {reportTab === 'logs' && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>Punch Logs</span>
              <button
                type="button"
                onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'add' })}
                style={{
                  border: '1px solid #1E5AE6',
                  background: '#EEF4FF',
                  color: '#1E5AE6',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                + Add Attendance
              </button>
            </div>

            {/* Search Filter */}
            <div className="swl-input-box" style={{ padding: '6px 12px' }}>
              <Icons.Search />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter logs by name, email, date..."
              />
            </div>

            {filteredLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '0.78rem' }}>
                No punch logs found for this period.
              </div>
            ) : (
              filteredLogs.map((r) => {
                const inUrl = r.checkInSelfieUrl || r.checkInPhotoUrl || r.selfieUrl
                const outUrl = r.checkOutSelfieUrl || r.checkOutPhotoUrl
                const loc = r.checkInLocation || r.location
                return (
                  <div key={r.id} className="swl-punch-feed-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <SelfiePairThumbs
                        inUrl={inUrl}
                        outUrl={outUrl}
                        onViewSelfie={onViewSelfie}
                        date={r.date}
                        name={r.name}
                        inLoc={r.checkInLocation}
                        outLoc={r.checkOutLocation}
                        inTime={r.checkInTime ? formatTime(r.checkInTime) : ''}
                        outTime={r.checkOutTime ? formatTime(r.checkOutTime) : ''}
                        size={34}
                      />
                      <div
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectEmployee && onSelectEmployee({ uid: r.uid, name: r.name, email: r.email })}
                        title="Click to view member profile"
                      >
                        <p style={{ margin: '0 0 2px 0', fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                          {r.name || r.email?.split('@')[0] || 'Employee'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.66rem', color: '#64748B' }}>
                          {r.date} • In: {r.checkInTime ? formatTime(r.checkInTime) : '--'}
                          {r.checkOutTime ? ` • Out: ${formatTime(r.checkOutTime)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {(() => {
                        const lateInfo = getAttendanceLateInfo(r, officeTiming)
                        return (
                          <span className={`swl-badge-pill ${lateInfo.isLate ? 'yellow' : 'green'}`}>
                            {lateInfo.isLate
                              ? (r.checkOutTime ? `Completed (Late${lateInfo.lateText ? ' +' + lateInfo.lateText : ''})` : `Late${lateInfo.lateText ? ' (+' + lateInfo.lateText + ')' : ''}`)
                              : (r.checkOutTime ? 'Completed' : 'Present')}
                          </span>
                        )
                      })()}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LocationBtn location={loc} />
                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal && onOpenAttendanceModal({ mode: 'edit', record: r })}
                          title="Edit Attendance"
                          style={{
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#1E5AE6',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm(`Delete attendance record for ${r.name || 'Employee'} on ${r.date}?`)
                            if (ok && isFirebaseConfigured && db) {
                              try {
                                await deleteDoc(doc(db, 'attendance', r.id))
                              } catch (e) {
                                alert('Delete error: ' + e.message)
                              }
                            }
                          }}
                          title="Delete Record"
                          style={{
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 5,
                            padding: '2px 6px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            <button
              className="swl-btn-login"
              onClick={exportCSV}
              style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Icons.Download />
              <span>Export Filtered CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Admin Bottom Nav with 5 tabs */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={true} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   14. LIVE ADMIN PROFILE SCREEN
   ========================================================================= */
function LiveAdminProfileScreen({ onNavigate, onLogout, onOpenGeofence, onOpenTiming, onViewSelfie, officeConfig, officeTiming }) {
  const { user, profile } = useAuth()
  const [subView, setSubView] = useState(null) // null | 'personal_info' | 'contact_desk' | 'password' | 'rules'

  // Handle back navigation for admin profile subviews so app never closes
  useEffect(() => {
    if (!subView) return
    try {
      window.history.pushState({ app: 'swl', adminProfileSubview: subView }, '')
    } catch (_) {}

    const onPop = () => {
      setSubView(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [subView])
  
  // Profile edit state
  const [adminName, setAdminName] = useState(profile?.name || user?.displayName || 'Administrator')
  const [adminPhone, setAdminPhone] = useState(profile?.phone || '')
  const [adminDept, setAdminDept] = useState(profile?.department || 'Executive Management')
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [passMsg, setPassMsg] = useState('')
  const [passUpdating, setPassUpdating] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  const name = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Administrator'
  const email = user?.email || 'admin@softwindlabs.com'
  const avatarUrl = profile?.photoURL || user?.photoURL || null

  async function handleAdminPhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoMsg('')
    try {
      const base64Url = await processImageFile(file, 350, 350, 0.82)
      if (user && db) {
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: base64Url,
          updatedAt: serverTimestamp()
        })
        if (updateProfile && user) {
          await updateProfile(user, { photoURL: base64Url }).catch(() => {})
        }
      }
      setPhotoMsg('✓ Admin photo updated successfully!')
      setTimeout(() => setPhotoMsg(''), 3000)
    } catch (err) {
      alert('Photo update failed: ' + (err.message || 'Please retry.'))
    } finally {
      setPhotoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  useEffect(() => {
    if (profile?.name) setAdminName(profile.name)
    if (profile?.phone) setAdminPhone(profile.phone)
    if (profile?.department) setAdminDept(profile.department)
  }, [profile])

  async function handleSavePersonalInfo(e) {
    e.preventDefault()
    if (!adminName.trim()) {
      setSaveMsg('Please enter a valid admin name.')
      return
    }
    setSaving(true)
    setSaveMsg('')
    try {
      if (user && db) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: adminName.trim(),
          phone: adminPhone.trim(),
          department: adminDept.trim()
        })
        if (updateProfile && user) {
          await updateProfile(user, { displayName: adminName.trim() }).catch(() => {})
        }
      }
      setSaveMsg('✓ Admin profile details updated successfully!')
      setTimeout(() => {
        setSaveMsg('')
        setSubView(null)
      }, 1200)
    } catch (err) {
      setSaveMsg(err.message || 'Error updating profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPassMsg('')
    if (!currentPassword) {
      setPassMsg('Please enter your current password.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPassMsg('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMsg('Passwords do not match.')
      return
    }
    setPassUpdating(true)
    try {
      if (user && user.email) {
        // Re-authenticate admin to prevent auth/requires-recent-login error
        const cred = EmailAuthProvider.credential(user.email, currentPassword)
        await reauthenticateWithCredential(user, cred)
        await updatePassword(user, newPassword)
        setPassMsg('✓ Password updated successfully!')
        setTimeout(() => {
          setSubView(null)
          setPassMsg('')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }, 1400)
      } else {
        throw new Error('User session not found. Please log in again.')
      }
    } catch (err) {
      console.error('Admin password change error:', err)
      let msg = err.message || 'Error updating password.'
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Current password is incorrect. Please check or use the reset link.'
      } else if (err.code === 'auth/requires-recent-login') {
        msg = 'Session expired. Please log out and sign back in to change password.'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.'
      }
      setPassMsg(msg)
    } finally {
      setPassUpdating(false)
    }
  }

  async function handleSendAdminResetEmail() {
    if (!user?.email) return
    setResetSending(true)
    setPassMsg('')
    try {
      await sendPasswordResetEmail(auth, user.email)
      setPassMsg(`✓ Password reset email sent to ${user.email}. Check your inbox!`)
    } catch (err) {
      setPassMsg(err.message || 'Failed to send reset link.')
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button
            className="swl-nav-back-btn"
            onClick={() => {
              if (subView) setSubView(null)
              else onNavigate('adm_dashboard')
            }}
          >
            <Icons.BackArrow />
          </button>
          <span>
            {subView === 'personal_info' && 'Admin Personal Info'}
            {subView === 'contact_desk' && 'Official Admin Contact'}
            {subView === 'password' && 'Change Admin Password'}
            {subView === 'rules' && 'Workplace Rules'}
            {!subView && 'Admin Profile'}
          </span>
          <div style={{ width: 18 }} />
        </div>

        {/* SUBVIEW: PERSONAL INFORMATION */}
        {subView === 'personal_info' && (
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '18px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={{ position: 'relative' }}>
                  <UserAvatar
                    name={name}
                    photoURL={avatarUrl}
                    size={56}
                    fontSize="1.4rem"
                    border="3px solid #1E5AE6"
                    title={avatarUrl ? "Admin Photo" : `${name}'s Initial`}
                    onClick={() =>
                      avatarUrl && onViewSelfie &&
                      onViewSelfie({
                        photoUrl: avatarUrl,
                        name: `${name} (Admin Photo)`,
                        date: 'Admin Profile',
                        location: 'HQ Management'
                      })
                    }
                  />
                  <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#1E5AE6', color: '#fff', fontSize: '0.55rem', padding: '2px 4px', borderRadius: 6, fontWeight: 700 }}>
                    🔍 Zoom
                  </span>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>{name}</h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.72rem', color: '#64748B' }}>Workspace Administrator</p>
                  <label
                    htmlFor="admin-photo-input-subview"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      background: '#EEF4FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: 6,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#1E5AE6',
                      cursor: 'pointer'
                    }}
                  >
                    📷 {photoUploading ? 'Saving...' : 'Change Admin Photo'}
                    <input
                      id="admin-photo-input-subview"
                      type="file"
                      accept="image/*"
                      disabled={photoUploading}
                      style={{ display: 'none' }}
                      onChange={handleAdminPhotoUpload}
                    />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSavePersonalInfo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', marginTop: 4, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Admin Account Email (Login)</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.8rem', marginTop: 4, color: '#64748B', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', marginTop: 4, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Department / Executive Role</label>
                  <input
                    type="text"
                    value={adminDept}
                    onChange={(e) => setAdminDept(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', marginTop: 4, outline: 'none' }}
                  />
                </div>

                {saveMsg && (
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: saveMsg.startsWith('✓') ? '#10B981' : '#EF4444' }}>
                    {saveMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setSubView(null)}
                    style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ flex: 2, padding: '9px', background: '#1E5AE6', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {saving ? 'Saving...' : 'Save Profile Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBVIEW: OFFICIAL CONTACT DESK */}
        {subView === 'contact_desk' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="swl-contact-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                    Official Workplace Support Desk
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748B' }}>
                    Configured for Softwind Labs Workspace
                  </p>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', marginTop: 8 }}>
                <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>OFFICIAL ADMIN EMAIL</div>
                <div style={{ fontSize: '0.92rem', color: '#1E5AE6', fontWeight: 800, marginTop: 2 }}>
                  admin@softwindlabs.com
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 8 }}>CURRENT ACTIVE ADMIN</div>
                <div style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: 700, marginTop: 2 }}>
                  {name} ({email})
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#334155', lineHeight: 1.4 }}>
                  All inquiries sent by employees from their profile panel route directly to this admin address.
                </p>
                <a
                  href="mailto:admin@softwindlabs.com?subject=Softwind%20Labs%20Admin%20Desk"
                  className="swl-btn-email-action"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', background: '#1E5AE6', color: '#fff', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}
                >
                  <Icons.Mail />
                  <span>Open Admin Mail Client</span>
                </a>
              </div>
            </div>

            <button
              onClick={() => setSubView(null)}
              style={{ padding: '8px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Admin Menu
            </button>
          </div>
        )}

        {/* SUBVIEW: CHANGE PASSWORD */}
        {subView === 'password' && (
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '18px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Update Admin Password
              </h4>
              <p style={{ margin: '0 0 14px 0', fontSize: '0.72rem', color: '#64748B' }}>
                Enter your current and new security password for {email}
              </p>

              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Current Password Field with Eye Toggle */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Current Password</label>
                    <button
                      type="button"
                      disabled={resetSending}
                      onClick={handleSendAdminResetEmail}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1E5AE6',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {resetSending ? 'Sending reset…' : 'Forgot password?'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      name="admin_current_token"
                      autoComplete="current-password"
                      required
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showCurrentPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showCurrentPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>

                {/* New Password Field with Eye Toggle */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>New Password</label>
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      name="admin_new_token"
                      autoComplete="new-password"
                      required
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showNewPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showNewPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Field with Eye Toggle */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Confirm New Password</label>
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      name="admin_confirm_token"
                      autoComplete="new-password"
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: showConfirmPwd ? '#1E5AE6' : '#94A3B8'
                      }}
                    >
                      {showConfirmPwd ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                </div>

                {passMsg && (
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: passMsg.startsWith('✓') ? '#10B981' : '#EF4444' }}>
                    {passMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubView(null)
                      setPassMsg('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passUpdating}
                    style={{ flex: 2, padding: '9px', background: '#1E5AE6', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {passUpdating ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBVIEW: WORKPLACE RULES */}
        {subView === 'rules' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                Softwind Labs Workspace Policies
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
                <li><strong>Check-In Geofence:</strong> Punches must be recorded within the verified office radius.</li>
                <li><strong>Selfie Verification:</strong> Live camera capture required for both In and Out punches.</li>
                <li><strong>Late Arrival:</strong> Shifts started after {(() => {
                  try {
                    const [h, m] = (officeTiming?.startTime || '09:00').split(':').map(Number)
                    const totalM = h * 60 + m + Number(officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30)
                    const cutoffH = Math.floor(totalM / 60) % 24
                    const cutoffM = totalM % 60
                    return formatTime24to12(`${String(cutoffH).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}`)
                  } catch {
                    return '09:30 AM'
                  }
                })()} are automatically flagged as Late (configured by Admin).</li>
                <li><strong>Team Arrival Feed:</strong> Colleague check-ins send real-time bell notifications.</li>
                <li><strong>Leave Applications:</strong> Planned leaves require admin review and approval.</li>
              </ul>
            </div>
            <button
              onClick={() => setSubView(null)}
              style={{ padding: '8px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* MAIN PROFILE OVERVIEW */}
        {!subView && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0 18px 0' }}>
            {/* ADMIN HERO CARD */}
            <div className="swl-profile-hero" style={{ padding: '18px 16px 14px 16px', margin: '0 16px', borderRadius: 18 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <UserAvatar
                  name={name}
                  photoURL={avatarUrl}
                  size={78}
                  fontSize="2rem"
                  border="3px solid #1E5AE6"
                  title={avatarUrl ? "Click to view full photo" : `${name}'s Profile Initial`}
                  onClick={() => {
                    if (avatarUrl && onViewSelfie) {
                      onViewSelfie({
                        photoUrl: avatarUrl,
                        name: `${name} (Admin Photo)`,
                        date: 'Admin Profile',
                        time: 'Active Administrator',
                        location: 'Office Admin Desk'
                      })
                    }
                  }}
                />
                <label
                  htmlFor="admin-photo-input-main"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    background: '#1E5AE6',
                    color: '#fff',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    cursor: photoUploading ? 'wait' : 'pointer',
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.25)'
                  }}
                  title="Upload / Change Admin Photo"
                >
                  {photoUploading ? '⏳' : '📷'}
                  <input
                    id="admin-photo-input-main"
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    style={{ display: 'none' }}
                    onChange={handleAdminPhotoUpload}
                  />
                </label>
              </div>

              <div style={{ marginTop: 6 }}>
                <label
                  htmlFor="admin-photo-input-main"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: 999,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: '#1E5AE6',
                    cursor: 'pointer'
                  }}
                >
                  📷 {photoUploading ? 'Saving Photo...' : 'Change Admin Photo'}
                </label>
              </div>

              {photoMsg && (
                <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
                  {photoMsg}
                </div>
              )}

              <h3 style={{ margin: '8px 0 2px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                {name}
              </h3>
              <span style={{
                background: '#EEF4FF',
                color: '#1E5AE6',
                padding: '3px 12px',
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 800,
                display: 'inline-block',
                marginTop: 4
              }}>
                🛡️ Workspace Administrator
              </span>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>{email}</p>
            </div>

            {/* EXECUTIVE STATS STRIP */}
            <div style={{ margin: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Access Level</div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1E5AE6', marginTop: 3 }}>
                  Super Admin
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Allowed Radius</div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#10B981', marginTop: 3 }}>
                  {officeConfig?.radiusMeters || 100}m Strict
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Database</div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#10B981', marginTop: 3 }}>
                  Live Realtime
                </div>
              </div>
            </div>

            {/* SECTION 1: ADMINISTRATION CONTROLS */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Organization Controls
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={onOpenGeofence} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.LocationPin />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Office Geofence Setup</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#1E5AE6', fontWeight: 600 }}>Manual Radius: {officeConfig?.radiusMeters || 100}m</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={onOpenTiming} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⏰</div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Office Timings & Shift Hours</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#D97706', fontWeight: 600 }}>
                        {formatTime24to12(officeTiming?.startTime || '09:00')} – {formatTime24to12(officeTiming?.endTime || '18:00')} ({officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30}m grace)
                      </span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => onNavigate('adm_employees')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Employees active={false} />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Manage Employees</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Add, edit, disable, or delete staff</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => onNavigate('adm_reports')} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Reports active={false} />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Attendance Reports</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Audit logs, CSV export &amp; selfies</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* SECTION 2: SECURITY & POLICIES */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Account &amp; Governance
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={() => setSubView('personal_info')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Profile active={false} />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Admin Personal Info</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Executive name &amp; phone details</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => setSubView('password')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Lock />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Change Admin Password</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Update master credentials</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item" onClick={() => setSubView('rules')} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Document />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Workplace Policies</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#64748B' }}>Geofence, late grace time &amp; rules</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* SECTION 3: CHANNELS & EXIT */}
            <div style={{ margin: '0 16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, paddingLeft: 4 }}>
                Communication &amp; Session
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
                <div className="swl-menu-item" onClick={() => setSubView('contact_desk')} style={{ cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="swl-menu-left">
                    <Icons.Mail />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Official Admin Desk</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#1E5AE6', fontWeight: 600 }}>admin@softwindlabs.com</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>

                <div className="swl-menu-item logout" onClick={onLogout} style={{ cursor: 'pointer', padding: '12px 14px' }}>
                  <div className="swl-menu-left">
                    <Icons.Logout />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#EF4444' }}>Admin Logout</span>
                      <span style={{ display: 'block', fontSize: '0.64rem', color: '#94A3B8' }}>Sign out administrative session</span>
                    </div>
                  </div>
                  <Icons.RightChevron />
                </div>
              </div>
            </div>

            {/* ADMIN SYSTEM HEALTH FOOTER */}
            <div style={{ margin: '4px 16px 8px 16px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.82rem' }}>🛡️</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A' }}>Softwind Labs Administration Console</span>
              </div>
              <p style={{ margin: '4px 0 8px 0', fontSize: '0.64rem', color: '#64748B', lineHeight: 1.4 }}>
                Real-time Firebase Cloud • Strict GPS Enforced • Softwind Labs Portal v2.4
              </p>
              <AppUpdateSyncButton />
            </div>
          </div>
        )}
      </div>

      {/* Admin Bottom Nav with Profile active */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate('adm_profile')}>
          <Icons.Profile active={true} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}


/* =========================================================================
   12. ADD EMPLOYEE MODAL (EMAIL & PASSWORD CREATION WITHOUT LOGGING OUT ADMIN)
   ========================================================================= */
function LiveAddEmployeeModal({ onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [role, setRole] = useState('employee')
  const [submitting, setSubmitting] = useState(false)
  const [successInfo, setSuccessInfo] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
    let p = ''
    for (let i = 0; i < 8; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
    setPassword(p)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setErrMsg('')
    setSubmitting(true)

    try {
      if (!isFirebaseConfigured || !db) {
        setSuccessInfo({ name, email, password, role })
        return
      }

      // Secondary Auth instance prevents current Admin session from being logged out
      const secondaryName = 'SecondaryAdminCreator'
      const secondaryApp =
        getApps().find((a) => a.name === secondaryName) ||
        initializeApp(firebaseConfig, secondaryName)
      const secondaryAuth = getAuth(secondaryApp)

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)

      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(),
        email: email.trim(),
        role,
        status: 'active',
        createdAt: serverTimestamp()
      })

      await secondarySignOut(secondaryAuth)
      setSuccessInfo({ name, email, password, role })
    } catch (err) {
      console.error('Create user error:', err)
      setErrMsg(err.message || 'Could not create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '20px 22px',
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
          {successInfo ? '✓ Member Created!' : 'Add New Member'}
        </h3>

        {errMsg && (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '6px 8px', borderRadius: 8, fontSize: '0.72rem', marginBottom: 10 }}>
            {errMsg}
          </div>
        )}

        {successInfo ? (
          <div>
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.75rem', lineHeight: 1.6 }}>
              <div><strong>Name:</strong> {successInfo.name}</div>
              <div><strong>Email:</strong> {successInfo.email}</div>
              <div><strong>Password:</strong> <code style={{ background: '#EEF4FF', color: '#1E5AE6', padding: '1px 5px', borderRadius: 4 }}>{successInfo.password}</code></div>
              <div><strong>Role:</strong> {successInfo.role}</div>
            </div>
            <button
              style={{ marginTop: 14, width: '100%', padding: '9px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              onClick={onClose}
            >
              Done &amp; Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', marginTop: 3 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rahul@company.com"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', marginTop: 3 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Password</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ border: 'none', background: 'transparent', color: '#64748B', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={generatePassword}
                    style={{ border: 'none', background: 'transparent', color: '#1E5AE6', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⚡ Generate
                  </button>
                </div>
              </div>
              <div style={{ position: 'relative', marginTop: 3 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{ width: '100%', padding: '8px 36px 8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: showPassword ? '#1E5AE6' : '#94A3B8'
                  }}
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', marginTop: 3 }}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 1, padding: '9px', background: '#1E5AE6', color: '#FFFFFF', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   13. OFFICE GEOFENCE SETUP MODAL (ADMIN ONLY)
   ========================================================================= */
function LiveGeofenceModal({ officeConfig, onClose, adminName }) {
  const [latitude, setLatitude] = useState(officeConfig?.latitude ? String(officeConfig.latitude) : '')
  const [longitude, setLongitude] = useState(officeConfig?.longitude ? String(officeConfig.longitude) : '')
  const [radiusMeters, setRadiusMeters] = useState(officeConfig?.radiusMeters || 100)
  const [officeAddress, setOfficeAddress] = useState(officeConfig?.officeAddress || '')
  const [acquiring, setAcquiring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  async function handleLockGps() {
    setAcquiring(true)
    try {
      const pos = await getCurrentGpsCoordinates()
      setLatitude(pos.latitude.toFixed(6))
      setLongitude(pos.longitude.toFixed(6))
    } catch (err) {
      alert('Could not acquire GPS: ' + err.message)
    } finally {
      setAcquiring(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await saveOfficeNetworkConfig({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: Number(radiusMeters) || 100,
        officeAddress: officeAddress.trim(),
        updatedBy: adminName
      })
      setSavedSuccess(true)
      setTimeout(() => {
        onClose()
      }, 900)
    } catch (err) {
      alert('Error saving geofence: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '20px 22px',
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
          📍 Office Geofence Setup
        </h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.72rem', color: '#64748B' }}>
          Define the GPS coordinates and allowed distance radius for office punches.
        </p>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Coordinates</label>
              <button
                type="button"
                onClick={handleLockGps}
                disabled={acquiring}
                style={{ border: 'none', background: 'transparent', color: '#1E5AE6', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {acquiring ? 'Locking…' : '🎯 Use Current GPS'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginTop: 4 }}>
              <input
                type="text"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.75rem' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                Allowed Geofence Radius
              </label>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E5AE6', background: '#EEF4FF', padding: '2px 8px', borderRadius: 999 }}>
                {radiusMeters}m Exact
              </span>
            </div>

            {/* Manual Typeable Number Box */}
            <div style={{ position: 'relative', marginTop: 4 }}>
              <input
                type="number"
                min="5"
                max="50000"
                step="1"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Math.max(1, Number(e.target.value)))}
                placeholder="Type manual radius (e.g. 75, 120, 250)"
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '8px 55px 8px 10px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  outline: 'none',
                  background: '#F8FAFC'
                }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>
                Meters
              </span>
            </div>

            {/* Quick preset buttons */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {[25, 50, 75, 100, 150, 200, 500].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRadiusMeters(m)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    border: radiusMeters === m ? '1.5px solid #1E5AE6' : '1px solid #E2E8F0',
                    background: radiusMeters === m ? '#EEF4FF' : '#FFFFFF',
                    color: radiusMeters === m ? '#1E5AE6' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {m}m {m === 100 ? '⭐' : ''}
                </button>
              ))}
            </div>

            {/* Synced Slider */}
            <input
              type="range"
              min="10"
              max="500"
              step="5"
              value={Math.min(500, Math.max(10, radiusMeters))}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginTop: 3 }}>
              Employees punching outside exactly <strong>{radiusMeters}m</strong> will be strictly blocked.
            </span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Office Name / Premise</label>
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              placeholder="e.g. Softwind Labs HQ"
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.78rem', marginTop: 4 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '9px',
                background: savedSuccess ? '#10B981' : '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {savedSuccess ? '✓ Saved!' : (saving ? 'Saving…' : 'Save Geofence')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================================================================
   17. LIVE OFFICE TIMINGS & SHIFT MODAL
   ========================================================================= */
function LiveOfficeTimingModal({ officeTiming, onClose, adminName }) {
  const [startTime, setStartTime] = useState(officeTiming?.startTime || '09:00')
  const [endTime, setEndTime] = useState(officeTiming?.endTime || '18:00')
  const [graceMinutes, setGraceMinutes] = useState(officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30)
  const [workDays, setWorkDays] = useState(officeTiming?.workDays || 'Mon – Sat')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Calculate late cutoff string
  const cutoffDisplay = useMemo(() => {
    try {
      const [h, m] = startTime.split(':').map(Number)
      const totalM = h * 60 + m + Number(graceMinutes || 0)
      const cutoffH = Math.floor(totalM / 60) % 24
      const cutoffM = totalM % 60
      return formatTime24to12(`${String(cutoffH).padStart(2, '0')}:${String(cutoffM).padStart(2, '0')}`)
    } catch {
      return '09:30 AM'
    }
  }, [startTime, graceMinutes])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await saveOfficeTimingConfig({
        startTime,
        endTime,
        graceMinutes: Number(graceMinutes) || 0,
        workDays,
        updatedBy: adminName
      })
      setSavedSuccess(true)
      setTimeout(() => {
        onClose()
      }, 900)
    } catch (err) {
      alert('Error saving office timings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '20px 22px',
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 3px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
              ⏰ Office Timings & Shifts
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
              Define work shift hours and late check-in grace period.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F1F5F9',
              color: '#64748B',
              borderRadius: '50%',
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Shift Start & End */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Shift Start
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  background: '#F8FAFC'
                }}
              />
              <span style={{ fontSize: '0.64rem', color: '#1E5AE6', fontWeight: 800, marginTop: 3, display: 'block' }}>
                {formatTime24to12(startTime)}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Shift End
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  background: '#F8FAFC'
                }}
              />
              <span style={{ fontSize: '0.64rem', color: '#1E5AE6', fontWeight: 800, marginTop: 3, display: 'block' }}>
                {formatTime24to12(endTime)}
              </span>
            </div>
          </div>

          {/* Grace Period */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                Grace Period
              </label>
              <span style={{ fontSize: '0.66rem', color: '#D97706', fontWeight: 800 }}>
                Late After: {cutoffDisplay}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                max="180"
                required
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Math.max(0, Number(e.target.value)))}
                placeholder="e.g. 15, 30, 45"
                style={{
                  width: '100%',
                  padding: '8px 55px 8px 10px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  background: '#F8FAFC'
                }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: 800, color: '#64748B' }}>
                Minutes
              </span>
            </div>

            {/* Quick preset chips */}
            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              {[0, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setGraceMinutes(mins)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    border: Number(graceMinutes) === mins ? '1.5px solid #D97706' : '1px solid #E2E8F0',
                    background: Number(graceMinutes) === mins ? '#FEF3C7' : '#FFFFFF',
                    color: Number(graceMinutes) === mins ? '#92400E' : '#64748B',
                    cursor: 'pointer'
                  }}
                >
                  {mins === 0 ? '0m (Strict)' : `${mins}m`}
                </button>
              ))}
            </div>

            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '6px 10px', marginTop: 8, fontSize: '0.65rem', color: '#92400E', fontWeight: 600 }}>
              ⏱️ Check-ins after <strong>{cutoffDisplay}</strong> will automatically be recorded as <strong>Late</strong>.
            </div>
          </div>

          {/* Working Days */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
              Working Schedule Days
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Mon – Sat', 'Mon – Fri', 'All 7 Days'].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setWorkDays(d)}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: 8,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: workDays === d ? '1.5px solid #1E5AE6' : '1px solid #E2E8F0',
                    background: workDays === d ? '#EEF4FF' : '#FFFFFF',
                    color: workDays === d ? '#1E5AE6' : '#64748B'
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1.4,
                padding: '9px',
                background: savedSuccess ? '#10B981' : '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {savedSuccess ? '✓ Timings Saved!' : (saving ? 'Saving…' : 'Save Office Timings')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================================================================
   15. LIVE ADMIN ATTENDANCE MANAGEMENT (ADD / EDIT / DELETE) MODAL
   ========================================================================= */
function timeStringToTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const parts = String(timeStr).split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const dateParts = String(dateStr).split('-')
  const year = parseInt(dateParts[0], 10)
  const month = parseInt(dateParts[1], 10)
  const day = parseInt(dateParts[2], 10)
  const d = new Date(year, month - 1, day, isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0)
  return Timestamp.fromDate(d)
}

function timestampToTimeString(ts) {
  if (!ts) return ''
  let d = null
  if (typeof ts?.toDate === 'function') {
    d = ts.toDate()
  } else if (ts instanceof Date) {
    d = ts
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    d = new Date(ts)
  } else if (ts?.seconds) {
    d = new Date(ts.seconds * 1000)
  }
  if (!d || isNaN(d.getTime())) return ''
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${mins}`
}

function LiveAdminAttendanceModal({ config, officeTiming, officeConfig, adminName, onClose }) {
  const isEdit = config?.mode === 'edit'
  const record = config?.record
  const preselectedUser = config?.preselectedUser

  const [usersList, setUsersList] = useState([])
  const [selectedUid, setSelectedUid] = useState(() => {
    if (isEdit) return record?.uid || ''
    return preselectedUser?.uid || ''
  })
  const [date, setDate] = useState(() => {
    if (isEdit) return record?.date || todayDateKey()
    return todayDateKey()
  })
  const [checkInTimeStr, setCheckInTimeStr] = useState(() => {
    if (isEdit && record?.checkInTime) {
      return timestampToTimeString(record.checkInTime)
    }
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [checkOutTimeStr, setCheckOutTimeStr] = useState(() => {
    if (isEdit && record?.checkOutTime) {
      return timestampToTimeString(record.checkOutTime)
    }
    return ''
  })
  const [statusOverride, setStatusOverride] = useState(() => {
    if (isEdit && record?.status) return record.status
    return 'auto'
  })
  const [note, setNote] = useState(() => {
    if (isEdit && record?.adminNote) return record.adminNote
    return ''
  })
  const [saving, setSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')

  // Stream registered users list
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      const emps = list.filter(u => !isUserAdmin(u))
      setUsersList(emps)
      if (!selectedUid && emps.length > 0 && !isEdit) {
        setSelectedUid(emps[0].uid)
      }
    })
    return () => unsub()
  }, [isEdit, selectedUid])

  const selectedUser = useMemo(() => {
    if (isEdit) {
      return {
        uid: record?.uid,
        name: record?.name,
        email: record?.email,
        photoURL: record?.photoURL || record?.checkInSelfieUrl
      }
    }
    return usersList.find(u => u.uid === selectedUid) || preselectedUser || null
  }, [isEdit, record, usersList, selectedUid, preselectedUser])

  // Live evaluation of check-in time against Admin's Office Timing
  const punchLatePreview = useMemo(() => {
    if (!date || !checkInTimeStr) return { isLate: false, lateMinutes: 0 }
    const parts = checkInTimeStr.split(':')
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const dateParts = date.split('-')
    const yr = parseInt(dateParts[0], 10)
    const mo = parseInt(dateParts[1], 10)
    const da = parseInt(dateParts[2], 10)
    const tempDate = new Date(yr, mo - 1, da, isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0)
    return checkIsPunchLate(tempDate, officeTiming)
  }, [date, checkInTimeStr, officeTiming])

  async function handleSave(e) {
    e.preventDefault()
    if (!selectedUid && !isEdit) {
      alert('Please select an employee.')
      return
    }
    if (!date) {
      alert('Please select date.')
      return
    }
    if (!checkInTimeStr) {
      alert('Please enter Check-In time.')
      return
    }

    setSaving(true)
    try {
      const inTimestamp = timeStringToTimestamp(date, checkInTimeStr)
      const outTimestamp = checkOutTimeStr ? timeStringToTimestamp(date, checkOutTimeStr) : null
      const month = date.slice(0, 7)

      const isLate = punchLatePreview.isLate
      const lateMinutes = punchLatePreview.lateMinutes

      let finalStatus = 'present'
      if (statusOverride !== 'auto') {
        finalStatus = statusOverride
      } else {
        if (outTimestamp) {
          finalStatus = isLate ? 'late' : 'completed'
        } else {
          finalStatus = isLate ? 'late' : 'present'
        }
      }

      const defaultLoc = {
        latitude: officeConfig?.latitude ? Number(officeConfig.latitude) : 27.146053,
        longitude: officeConfig?.longitude ? Number(officeConfig.longitude) : 78.041087,
        accuracy: 5.0
      }

      const userPhoto = selectedUser?.photoURL || record?.checkInSelfieUrl || record?.selfieUrl || null

      if (isEdit && record?.id) {
        const docRef = doc(db, 'attendance', record.id)
        const updatePayload = {
          date,
          month,
          checkInTime: inTimestamp,
          checkOutTime: outTimestamp,
          isLate,
          lateMinutes,
          status: finalStatus,
          adminNote: note ? note.trim() : null,
          manualAdjustment: true,
          adjustedBy: adminName,
          updatedAt: serverTimestamp()
        }
        if (outTimestamp) {
          updatePayload.checkOutPhotoUrl = record.checkOutPhotoUrl || userPhoto
          updatePayload.checkOutSelfieUrl = record.checkOutSelfieUrl || userPhoto
          updatePayload.checkOutLocation = record.checkOutLocation || defaultLoc
        } else {
          updatePayload.checkOutPhotoUrl = null
          updatePayload.checkOutSelfieUrl = null
          updatePayload.checkOutLocation = null
        }
        await updateDoc(docRef, updatePayload)
        setSavedNotice('✓ Attendance updated successfully!')
      } else {
        let boundDevice = 'Manual Entry (Admin)'
        let boundDeviceId = 'manual-' + selectedUid.slice(0, 8)
        if (selectedUser?.boundDeviceName || selectedUser?.boundPhoneModel) {
          boundDevice = selectedUser.boundDeviceName || selectedUser.boundPhoneModel
        }
        if (selectedUser?.boundDeviceId) {
          boundDeviceId = selectedUser.boundDeviceId
        }

        await addDoc(collection(db, 'attendance'), {
          uid: selectedUid,
          name: selectedUser?.name || 'Employee',
          email: selectedUser?.email || '',
          date,
          month,
          checkInTime: inTimestamp,
          checkInPhotoUrl: userPhoto,
          checkInSelfieUrl: userPhoto,
          selfieUrl: userPhoto,
          checkInLocation: defaultLoc,
          deviceId: boundDeviceId,
          deviceName: boundDevice,
          checkOutTime: outTimestamp,
          checkOutPhotoUrl: outTimestamp ? userPhoto : null,
          checkOutSelfieUrl: outTimestamp ? userPhoto : null,
          checkOutLocation: outTimestamp ? defaultLoc : null,
          isLate,
          lateMinutes,
          status: finalStatus,
          manualEntry: true,
          addedBy: adminName,
          adminNote: note ? note.trim() : null,
          createdAt: inTimestamp
        })
        setSavedNotice('✓ Attendance record created successfully!')
      }

      setTimeout(() => {
        onClose()
      }, 800)
    } catch (err) {
      alert('Error saving record: ' + (err.message || 'Operation failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || !record?.id) return
    const confirmed = window.confirm(
      `Are you sure you want to delete this attendance record for ${selectedUser?.name || record?.name || 'Employee'} on ${date}?\n\nThis action cannot be undone.`
    )
    if (!confirmed) return

    setSaving(true)
    try {
      await deleteDoc(doc(db, 'attendance', record.id))
      setSavedNotice('✓ Attendance record deleted!')
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err) {
      alert('Error deleting record: ' + (err.message || 'Permission denied'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '20px 22px',
          maxWidth: 400,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 3px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 800 }}>
              {isEdit ? '✏️ Edit Attendance Punch' : '➕ Manual Attendance Punch'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B' }}>
              {isEdit
                ? 'Update check-in / check-out times, status, or remove accidental punch.'
                : 'Add missing attendance punch for employee who forgot to clock in.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F1F5F9',
              color: '#64748B',
              borderRadius: '50%',
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800
            }}
          >
            ✕
          </button>
        </div>

        {savedNotice && (
          <div style={{ background: '#ECFDF5', color: '#065F46', padding: '8px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
            {savedNotice}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Employee Selection */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
              Employee
            </label>
            {isEdit ? (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserAvatar name={record?.name || 'Employee'} photoURL={selectedUser?.photoURL} size={32} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
                    {record?.name || 'Employee'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                    {record?.email || selectedUser?.email}
                  </div>
                </div>
              </div>
            ) : (
              <select
                required
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                  background: '#F8FAFC',
                  outline: 'none'
                }}
              >
                {usersList.length === 0 && <option value="">Loading employees...</option>}
                {usersList.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date Picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxSizing: 'border-box',
                background: '#F8FAFC'
              }}
            />
          </div>

          {/* Check-In Time & Late Preview */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                Check-In Time
              </label>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: punchLatePreview.isLate ? '#FEF3C7' : '#ECFDF5',
                  color: punchLatePreview.isLate ? '#B45309' : '#047857'
                }}
              >
                {punchLatePreview.isLate ? `🟡 Late (+${punchLatePreview.lateMinutes}m)` : '🟢 On-Time'}
              </span>
            </div>
            <input
              type="time"
              required
              value={checkInTimeStr}
              onChange={(e) => setCheckInTimeStr(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxSizing: 'border-box',
                background: '#F8FAFC'
              }}
            />
            <span style={{ fontSize: '0.64rem', color: '#64748B', marginTop: 3, display: 'block' }}>
              Shift Cutoff: <strong>{formatTime24to12(officeTiming?.startTime || '09:00')}</strong> (+{officeTiming?.graceMinutes != null ? officeTiming.graceMinutes : 30}m grace)
            </span>
          </div>

          {/* Check-Out Time */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                Check-Out Time (Optional)
              </label>
              {checkOutTimeStr && (
                <button
                  type="button"
                  onClick={() => setCheckOutTimeStr('')}
                  style={{
                    border: 'none',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                  title="Clear departure to keep shift active"
                >
                  ✕ Clear Check-Out
                </button>
              )}
            </div>
            <input
              type="time"
              value={checkOutTimeStr}
              onChange={(e) => setCheckOutTimeStr(e.target.value)}
              placeholder="--:--"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxSizing: 'border-box',
                background: '#F8FAFC'
              }}
            />
            <span style={{ fontSize: '0.64rem', color: '#64748B', marginTop: 3, display: 'block' }}>
              {checkOutTimeStr
                ? `Punch will be recorded as completed at ${formatTime24to12(checkOutTimeStr)}.`
                : 'Leave blank if employee is currently working (Active Shift).'}
            </span>
          </div>

          {/* Status Override */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
              Status
            </label>
            <select
              value={statusOverride}
              onChange={(e) => setStatusOverride(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.8rem',
                fontWeight: 600,
                boxSizing: 'border-box',
                background: '#F8FAFC'
              }}
            >
              <option value="auto">Auto (Calculate based on office timings)</option>
              <option value="present">Present (On-Time)</option>
              <option value="late">Late Arrival</option>
              <option value="completed">Completed Shift</option>
            </select>
          </div>

          {/* Admin Note */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
              Admin Adjustment Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Employee forgot to checkout / Commute delay"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.78rem',
                boxSizing: 'border-box',
                background: '#F8FAFC'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: isEdit ? 10 : 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px',
                background: '#F1F5F9',
                color: '#475569',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1.4,
                padding: '9px',
                background: savedNotice ? '#10B981' : '#1E5AE6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer'
              }}
            >
              {savedNotice ? '✓ Saved!' : (saving ? 'Saving…' : (isEdit ? '✓ Update Punch' : '+ Save Punch'))}
            </button>
          </div>

          {/* Danger Zone: Delete Punch in Edit Mode */}
          {isEdit && (
            <div style={{ paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                  borderRadius: 10,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🗑️ Delete This Attendance Record
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
