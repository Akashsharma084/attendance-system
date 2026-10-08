import { collection, doc, writeBatch, getDocs, setDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { getStoredUsers, getStoredAttendance } from '../mockService'

/**
 * Seeds demo users and attendance records to Firestore if admin requests it
 */
export async function seedDemoDataToFirestore() {
  if (!isFirebaseConfigured || !db) {
    return {
      success: true,
      mode: 'mock',
      message: 'Demo data is active in browser storage.'
    }
  }

  const users = getStoredUsers()
  const attendance = getStoredAttendance()

  try {
    // 1. Seed users
    for (const u of users) {
      const userRef = doc(db, 'users', u.uid)
      await setDoc(userRef, {
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status || 'active',
        isAdmin: u.role === 'admin',
        photoURL: u.photoURL || null,
        joinDate: u.joinDate || '2026-08-07',
        department: u.department || 'Operations'
      }, { merge: true })
    }

    // 2. Seed attendance records in batches of 200
    const CHUNK_SIZE = 200
    for (let i = 0; i < attendance.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db)
      const chunk = attendance.slice(i, i + CHUNK_SIZE)

      chunk.forEach((r) => {
        const docRef = doc(db, 'attendance', r.id)
        batch.set(docRef, {
          uid: r.uid,
          name: r.name,
          date: r.date,
          month: r.month,
          checkInTime: r.checkInTime,
          checkInLocation: r.checkInLocation || { lat: 28.6139, lng: 77.2090, accuracy: 8 },
          checkInSelfieUrl: r.checkInSelfieUrl || null,
          checkOutTime: r.checkOutTime || null,
          checkOutLocation: r.checkOutLocation || null,
          checkOutSelfieUrl: r.checkOutSelfieUrl || null
        }, { merge: true })
      })

      await batch.commit()
    }

    return {
      success: true,
      mode: 'firestore',
      count: attendance.length,
      userCount: users.length,
      message: `Successfully seeded ${users.length} members and ${attendance.length} attendance records into live Firestore database!`
    }
  } catch (err) {
    console.error('Error seeding data to Firestore:', err)
    throw err
  }
}
