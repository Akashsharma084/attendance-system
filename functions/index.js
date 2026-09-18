const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

async function assertIsAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists || snap.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admins only.')
  }
}

// Creates a new employee (or admin) login + their Firestore profile doc.
// Call from the client with: { email, password, name, role }
exports.createUser = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid)

  const { email, password, name, role } = request.data
  if (!email || !password || !name) {
    throw new HttpsError('invalid-argument', 'email, password and name are required.')
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.')
  }

  const userRecord = await admin.auth().createUser({
    email: email.trim(),
    password,
    displayName: name.trim()
  })

  await db.collection('users').doc(userRecord.uid).set({
    name: name.trim(),
    email: email.trim(),
    role: role === 'admin' ? 'admin' : 'employee',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  })

  return { uid: userRecord.uid }
})

// Enables or disables a user's login + flips their Firestore status field.
// Call with: { uid, disabled: true|false }
exports.setUserStatus = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid)

  const { uid, disabled } = request.data
  if (!uid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'uid and disabled (boolean) are required.')
  }
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', "You can't disable your own account.")
  }

  await admin.auth().updateUser(uid, { disabled })
  await db.collection('users').doc(uid).update({
    status: disabled ? 'disabled' : 'active'
  })

  return { ok: true }
})
