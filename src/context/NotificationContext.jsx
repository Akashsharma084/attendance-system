import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { useAuth } from './AuthContext'
import { formatTime, todayDateKey } from '../utils/dateHelpers'

const NotificationContext = createContext(null)

const STORAGE_KEY = 'sw_attendance_notifications'

function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.22)

    // Note 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.12)
    gain2.gain.setValueAtTime(0.16, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.45)
  } catch (err) {
    // Audio autoplay restrictions before first user interaction
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [activeToast, setActiveToast] = useState(null)
  const [pushPermission, setPushPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })

  const isInitialLoadRef = useRef(true)
  const knownRecordsRef = useRef(new Map())
  const toastTimeoutRef = useRef(null)

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)))
    } catch (e) {
      // Storage full or unavailable
    }
  }, [notifications])

  // Request browser Web Push notification permission
  async function requestPushPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission()
        setPushPermission(res)
        return res
      } catch (err) {
        console.warn('Push permission request error:', err)
      }
    }
    return 'unsupported'
  }

  function triggerPushNotification({ title, body, icon }) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: `punch-${Date.now()}`
        })
      } catch (e) {
        console.warn('Could not launch system notification:', e)
      }
    }
  }

  function triggerArrivalAlert({ type, name, time, photoUrl, docId }) {
    const isCheckIn = type === 'in'
    const title = isCheckIn ? '🟢 Staff Arrival' : '🏁 Staff Departure'
    const message = isCheckIn
      ? `${name} aa gaya hai! Checked in at ${time}`
      : `${name} has checked out (${time})`

    // 1. Play synthesized bell chime
    playChimeSound()

    // 2. Launch system web push notification
    triggerPushNotification({
      title,
      body: message,
      icon: photoUrl
    })

    // 3. Show In-App Floating Toast
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setActiveToast({
      id: `${docId}-${type}-${Date.now()}`,
      type,
      title,
      name,
      time,
      photoUrl,
      message
    })

    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null)
    }, 7000)

    // 4. Save into in-app notification feed
    const newNotice = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      docId,
      type,
      name,
      time,
      photoUrl: photoUrl || null,
      message,
      read: false,
      timestamp: Date.now()
    }
    setNotifications((prev) => [newNotice, ...prev.slice(0, 49)])
  }

  // Subscribe to live today attendance updates
  useEffect(() => {
    if (!user) return
    isInitialLoadRef.current = true
    knownRecordsRef.current.clear()

    const today = todayDateKey()

    if (!isFirebaseConfigured || !db) {
      return
    }

    const q = query(
      collection(db, 'attendance'),
      where('date', '==', today)
    )

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (isInitialLoadRef.current) {
          // Initialize cache with existing records so we don't alert past arrivals on refresh
          snapshot.docs.forEach((doc) => {
            const data = doc.data()
            knownRecordsRef.current.set(doc.id, {
              hasIn: Boolean(data.checkInTime),
              hasOut: Boolean(data.checkOutTime)
            })
          })
          isInitialLoadRef.current = false
          return
        }

        // Process doc changes
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id
          const data = change.doc.data()
          const prevStatus = knownRecordsRef.current.get(docId)

          // Don't send popup to the person who punched their own check-in/out
          const isCurrentUser = data.uid === user.uid
          const empName = data.name || data.email?.split('@')[0] || 'Employee'
          const photo = data.checkInSelfieUrl || null

          if (change.type === 'added') {
            knownRecordsRef.current.set(docId, {
              hasIn: Boolean(data.checkInTime),
              hasOut: Boolean(data.checkOutTime)
            })

            if (!isCurrentUser && data.checkInTime) {
              const formattedTime = formatTime(data.checkInTime)
              triggerArrivalAlert({
                type: 'in',
                name: empName,
                time: formattedTime,
                photoUrl: photo,
                docId
              })
            }
          } else if (change.type === 'modified') {
            const hadOut = prevStatus?.hasOut
            const nowHasOut = Boolean(data.checkOutTime)

            knownRecordsRef.current.set(docId, {
              hasIn: Boolean(data.checkInTime),
              hasOut: nowHasOut
            })

            // Check if checkout just occurred
            if (!isCurrentUser && !hadOut && nowHasOut) {
              const formattedTime = formatTime(data.checkOutTime)
              triggerArrivalAlert({
                type: 'out',
                name: empName,
                time: formattedTime,
                photoUrl: data.checkOutSelfieUrl || photo,
                docId
              })
            }
          }
        })
      },
      (err) => {
        console.warn('Real-time notification listener notice:', err)
      }
    )

    return () => {
      unsub()
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [user])

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function clearAllNotifications() {
    setNotifications([])
  }

  function dismissToast() {
    setActiveToast(null)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        pushPermission,
        requestPushPermission,
        markAllAsRead,
        clearAllNotifications,
        dismissToast,
        triggerArrivalAlert
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return ctx
}
