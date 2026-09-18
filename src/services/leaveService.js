import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import {
  mockGetLeavesList,
  mockCreateLeaveRequest,
  mockUpdateLeaveStatus,
  mockCancelLeaveRequest
} from '../mockService'

/**
 * Subscribes to real-time leave updates.
 * If uid is provided, filters for that employee. Otherwise (for admin), returns all leaves.
 */
export function subscribeLeaves({ uid, onUpdate, onError }) {
  if (!isFirebaseConfigured || !db) {
    // Demo Mode: Send immediate snapshot and set up local storage event listener
    const notify = () => {
      try {
        const list = mockGetLeavesList({ uid })
        onUpdate(list)
      } catch (err) {
        if (onError) onError(err)
      }
    }

    notify()

    // Poll slightly in demo mode so cross-tab and state updates reflect instantly
    const interval = setInterval(notify, 1200)

    return () => {
      clearInterval(interval)
    }
  }

  // Firestore Real-Time Listener:
  // Querying by uid alone or collection alone ensures 0 composite index requirements!
  try {
    const colRef = collection(db, 'leaves')
    const q = uid ? query(colRef, where('uid', '==', uid)) : query(colRef)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
        // In-memory sort by creation time descending
        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
          return timeB - timeA
        })
        onUpdate(list)
      },
      (err) => {
        console.error('Error listening to leaves:', err)
        if (onError) onError(err)
      }
    )

    return unsubscribe
  } catch (err) {
    console.error('Failed to initialize leave listener:', err)
    if (onError) onError(err)
    return () => {}
  }
}

/**
 * Submits a new leave request.
 */
export async function submitLeaveRequest({
  uid,
  userName,
  userEmail,
  leaveType,
  startDate,
  endDate,
  daysCount,
  reason
}) {
  if (!isFirebaseConfigured || !db) {
    return mockCreateLeaveRequest({
      uid,
      userName,
      userEmail,
      leaveType,
      startDate,
      endDate,
      daysCount,
      reason
    })
  }

  const payload = {
    uid,
    userName: userName || userEmail?.split('@')[0] || 'Employee',
    userEmail: userEmail || '',
    leaveType: leaveType || 'casual',
    startDate,
    endDate,
    daysCount: Number(daysCount) || 1,
    reason: (reason || '').trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    adminNote: ''
  }

  const docRef = await addDoc(collection(db, 'leaves'), payload)
  return { id: docRef.id, ...payload }
}

/**
 * Admin action to approve or reject a leave request.
 */
export async function reviewLeaveRequest({
  leaveId,
  status, // 'approved' | 'rejected'
  reviewedBy,
  reviewedByName,
  adminNote = ''
}) {
  if (!isFirebaseConfigured || !db) {
    return mockUpdateLeaveStatus({
      leaveId,
      status,
      reviewedBy,
      reviewedByName,
      adminNote
    })
  }

  const leaveDocRef = doc(db, 'leaves', leaveId)
  await updateDoc(leaveDocRef, {
    status,
    reviewedBy: reviewedBy || 'admin',
    reviewedByName: reviewedByName || 'Administrator',
    reviewedAt: serverTimestamp(),
    adminNote: adminNote.trim()
  })

  return { id: leaveId, status }
}

/**
 * Employee action to cancel their pending leave request.
 */
export async function cancelLeaveRequest({ leaveId, uid }) {
  if (!isFirebaseConfigured || !db) {
    return mockCancelLeaveRequest({ leaveId, uid })
  }

  const leaveDocRef = doc(db, 'leaves', leaveId)
  await updateDoc(leaveDocRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp()
  })

  return { id: leaveId, status: 'cancelled' }
}
