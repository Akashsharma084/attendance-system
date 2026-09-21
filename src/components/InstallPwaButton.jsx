import { useEffect, useState } from 'react'

export default function InstallPwaButton({ className = '', style = {} }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)

  useEffect(() => {
    // Check if already in standalone app mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Check iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    } else if (isIOS) {
      setShowIosTip(true)
    }
  }

  if (isInstalled) return null
  if (!deferredPrompt && !isIOS) return null

  return (
    <>
      <button
        type="button"
        className={`sw-pwa-install-btn ${className}`}
        style={style}
        onClick={handleInstallClick}
        title="Install Attendance App on this device"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </svg>
        <span>Install App</span>
      </button>

      {showIosTip && (
        <div className="modal-overlay" onClick={() => setShowIosTip(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '1.75rem' }}>
              <img
                src="/icon-192.png"
                alt="Softwind Labs Logo"
                style={{ width: '64px', height: '64px', borderRadius: '16px', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)', marginBottom: '0.75rem', border: '1px solid rgba(226, 232, 240, 0.8)' }}
              />
              <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Install Softwind Attendance</h3>
              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Tap the <strong>Share</strong> button <span style={{ fontSize: '1.2rem' }}>⎋</span> in your Safari toolbar, then scroll down and tap <strong>"Add to Home Screen"</strong>.
              </p>
              <button className="btn-primary" onClick={() => setShowIosTip(false)} style={{ width: '100%' }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
