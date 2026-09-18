import { useState } from 'react'

export default function DemoBanner() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="demo-banner">
        <div className="demo-banner-content">
          <span className="demo-badge">⚡ DEMO MODE</span>
          <span>Running locally with sample data. Firebase keys not yet configured in <code>.env</code>.</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="demo-banner-btn" onClick={() => setShowModal(true)}>
            Setup Firebase Guide
          </button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Connect Your Firebase Project</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>To switch from <strong>Demo Mode</strong> to your live Firebase database & auth:</p>
              <ol className="modal-steps">
                <li>
                  Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a> and click <strong>Add project</strong>.
                </li>
                <li>
                  Enable <strong>Authentication</strong> (Email/Password), <strong>Firestore Database</strong>, and <strong>Cloud Storage</strong>.
                </li>
                <li>
                  Go to <strong>Project Settings &gt; General &gt; Your apps &gt; Web app (<code>&lt;/&gt;</code>)</strong>.
                </li>
                <li>
                  Copy the keys into your <code>.env</code> file in the project folder:
                  <pre className="code-block">
{`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456:web:abcd`}
                  </pre>
                </li>
                <li>
                  Save <code>.env</code> and the app will automatically switch from Demo Mode to live Firebase!
                </li>
              </ol>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowModal(false)}>
                Got it, keep testing Demo Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
