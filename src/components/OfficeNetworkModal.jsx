import { useState, useEffect } from 'react'
import {
  getLocalOfficeNetwork,
  saveOfficeNetworkConfig,
  getCurrentGpsCoordinates
} from '../services/networkService'

export default function OfficeNetworkModal({ isOpen, onClose, onSaved, adminName }) {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radiusMeters, setRadiusMeters] = useState(100)
  const [officeAddress, setOfficeAddress] = useState('')
  const [acquiringGps, setAcquiringGps] = useState(false)
  const [gpsNotice, setGpsNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      const cfg = getLocalOfficeNetwork()
      setLatitude(cfg.latitude != null ? String(cfg.latitude) : '')
      setLongitude(cfg.longitude != null ? String(cfg.longitude) : '')
      setRadiusMeters(cfg.radiusMeters || 100)
      setOfficeAddress(cfg.officeAddress || '')
      setSaveSuccess(false)
      setErrorMsg('')
      setGpsNotice('')
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSetCurrentLocation() {
    setAcquiringGps(true)
    setErrorMsg('')
    setGpsNotice('Fetching live GPS coordinates...')

    try {
      const pos = await getCurrentGpsCoordinates()
      setLatitude(pos.latitude.toFixed(6))
      setLongitude(pos.longitude.toFixed(6))
      setGpsNotice(`✓ Location locked: ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)} (Accuracy: ±${Math.round(pos.accuracy)}m)`)
    } catch (err) {
      console.warn('GPS acquire error:', err)
      setErrorMsg('Could not fetch GPS. Please make sure Location permission is allowed in your browser.')
      setGpsNotice('')
    } finally {
      setAcquiringGps(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSaveSuccess(false)

    try {
      const numLat = latitude ? parseFloat(latitude) : null
      const numLng = longitude ? parseFloat(longitude) : null

      if ((latitude && isNaN(numLat)) || (longitude && isNaN(numLng))) {
        throw new Error('Please enter valid numeric latitude and longitude.')
      }

      const saved = await saveOfficeNetworkConfig({
        latitude: numLat,
        longitude: numLng,
        radiusMeters: Number(radiusMeters) || 100,
        officeAddress: officeAddress.trim(),
        updatedBy: adminName || 'Admin'
      })

      setSaveSuccess(true)
      if (onSaved) onSaved(saved)
      setTimeout(() => {
        onClose()
      }, 1300)
    } catch (err) {
      console.error('Save geofence error:', err)
      setErrorMsg(err.message || 'Failed to save office settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid #e2e8f0',
          padding: '1.35rem 1.5rem',
          margin: 'auto',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📍</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Office Geofence Setup</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Punch will ONLY be allowed inside this office radius
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.35rem', cursor: 'pointer', color: '#64748b', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: '1rem' }}>
          {/* Quick One-Click Current Location Picker */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Office GPS Location:
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: latitude ? '#047857' : '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                  {latitude && longitude ? `${latitude}, ${longitude}` : 'Not set yet'}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}
                onClick={handleSetCurrentLocation}
                disabled={acquiringGps}
              >
                <span>📍</span>
                <span>{acquiringGps ? 'Locking GPS...' : 'Set Current Location'}</span>
              </button>
            </div>
            {gpsNotice && (
              <div style={{ fontSize: '0.76rem', color: '#15803d', marginTop: '6px', fontWeight: 600 }}>
                {gpsNotice}
              </div>
            )}
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px', lineHeight: 1.35 }}>
              💡 Office building ke andar baith kar <strong>"Set Current Location"</strong> par tap karein. Isse office ka live GPS lock ho jayega.
            </div>
          </div>

          {/* Radius Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
              Allowed Punch Radius (Meters)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {[50, 100, 150, 200].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRadiusMeters(m)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: radiusMeters === m ? '#0284c7' : '#cbd5e1',
                    background: radiusMeters === m ? '#e0f2fe' : '#ffffff',
                    color: radiusMeters === m ? '#0369a1' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {m} Meters {m === 100 ? '⭐' : ''}
                </button>
              ))}
            </div>
            <input
              type="number"
              className="sw-input"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              placeholder="Radius in meters (e.g. 100)"
              min={10}
              max={1000}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
            />
            <span style={{ fontSize: '0.73rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
              Is radius se bahar hone par employee ki attendance <strong>block</strong> ho jayegi aur punch nahi hoga.
            </span>
          </div>

          {/* Office Address / Note (Optional) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
              Office Branch / Building Name (Optional)
            </label>
            <input
              type="text"
              className="sw-input"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              placeholder="e.g. Head Office, Sector 62"
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
            />
          </div>

          {/* Manual Latitude & Longitude */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                Latitude
              </label>
              <input
                type="text"
                className="sw-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 28.5355"
                style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                Longitude
              </label>
              <input
                type="text"
                className="sw-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 77.3910"
                style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div style={{ padding: '0.65rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {saveSuccess && (
            <div style={{ padding: '0.65rem', background: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
              ✓ Office Geofence radius saved successfully!
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
