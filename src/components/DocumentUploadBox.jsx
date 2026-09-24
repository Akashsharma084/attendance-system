import { useRef, useState } from 'react'

/**
 * Modern Document Upload Box with Drag & Drop, file preview, and zoom.
 * Supports images and PDF documents.
 */
export default function DocumentUploadBox({
  value = null,
  fileName = '',
  onChange,
  onClear,
  onPreview,
  label = 'Upload Document',
  optional = true,
  title = 'Click or drag & drop document to upload',
  subtitle = 'Supports PDF, JPG, PNG or medical/support documents (up to 10MB)',
  accept = 'image/*,application/pdf',
  accentColor = '#f59e0b',
  theme = 'dark',
  disabled = false
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileSizeText, setFileSizeText] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const isPdf = value?.startsWith('data:application/pdf') || fileName?.toLowerCase().endsWith('.pdf')

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return ''
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function processFile(file) {
    if (!file) return
    setUploadError('')

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large. Maximum file size allowed is 10MB.')
      return
    }

    const sizeStr = formatBytes(file.size)
    setFileSizeText(sizeStr)

    // Handle PDF documents
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        onChange?.({
          dataUrl: e.target.result,
          name: file.name,
          size: sizeStr,
          type: 'pdf'
        })
      }
      reader.onerror = () => {
        setUploadError('Failed to read PDF document. Please try another file.')
      }
      reader.readAsDataURL(file)
      return
    }

    // Handle images (compress/scale on canvas for fast uploads)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1200
          let w = img.width
          let h = img.height
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

          onChange?.({
            dataUrl,
            name: file.name,
            size: sizeStr,
            type: 'image'
          })
        }
        img.onerror = () => {
          setUploadError('Invalid image file format. Please upload a valid PNG or JPG.')
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
      return
    }

    // Unsupported format
    setUploadError('Unsupported file type. Please upload a PDF, JPG, or PNG document.')
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isDragOver) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (disabled) return

    const file = e.dataTransfer?.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  function handleBoxClick(e) {
    // Avoid re-triggering file input if clicking an action button
    if (e.target.closest('button') || e.target.closest('a')) {
      return
    }
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className={`sw-doc-upload-container theme-${theme}`}>
      {label && (
        <div className="sw-doc-upload-header">
          <label className="sw-doc-upload-label" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
            <span>{label}</span>
            {optional && (
              <span className="sw-doc-upload-optional" style={{ color: accentColor }}>
                (Optional)
              </span>
            )}
          </label>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Upload Dropzone Box */}
      {!value ? (
        <div
          className={`sw-doc-upload-box ${isDragOver ? 'drag-over' : ''}`}
          onClick={handleBoxClick}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            '--accent-color': accentColor,
            borderColor: isDragOver ? accentColor : undefined
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className="sw-doc-upload-icon-ring" style={{ background: `${accentColor}18`, borderColor: `${accentColor}40` }}>
            <svg
              className="sw-doc-upload-svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3-3 3 3" />
            </svg>
          </div>

          <div className="sw-doc-upload-content">
            <h5 className="sw-doc-upload-title" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
              {isDragOver ? 'Drop your document here' : title}
            </h5>
            <p className="sw-doc-upload-subtitle" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            className="sw-doc-upload-browse-btn"
            style={{
              borderColor: accentColor,
              color: accentColor,
              background: `${accentColor}12`
            }}
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            <span>📁 Browse File</span>
          </button>
        </div>
      ) : (
        /* Uploaded Document Card State */
        <div
          className="sw-doc-upload-card"
          style={{
            '--accent-color': accentColor,
            borderColor: `${accentColor}50`
          }}
        >
          <div className="sw-doc-upload-card-left">
            {isPdf ? (
              <div className="sw-doc-preview-pdf" onClick={() => onPreview?.({ url: value, name: fileName })}>
                <span className="sw-doc-pdf-badge">PDF</span>
                <span style={{ fontSize: '1.4rem' }}>📄</span>
              </div>
            ) : (
              <div
                className="sw-doc-preview-thumb-wrap"
                onClick={() => onPreview?.({ url: value, name: fileName })}
                title="Click to view full preview"
              >
                <img
                  src={value}
                  alt={fileName || 'Uploaded document preview'}
                  className="sw-doc-preview-thumb"
                  style={{ borderColor: accentColor }}
                />
                <span className="sw-doc-thumb-zoom-icon">🔍</span>
              </div>
            )}

            <div className="sw-doc-upload-card-info">
              <div className="sw-doc-file-name" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }} title={fileName}>
                ✓ {fileName || 'Attached Document'}
              </div>
              <div className="sw-doc-file-meta">
                <span className="sw-doc-status-chip" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
                  ✓ Document Verified
                </span>
                {fileSizeText && <span className="sw-doc-size-tag">{fileSizeText}</span>}
              </div>
            </div>
          </div>

          <div className="sw-doc-upload-card-actions">
            {onPreview && (
              <button
                type="button"
                className="sw-doc-btn-action zoom"
                onClick={() => onPreview({ url: value, name: fileName })}
                title="Zoom / Preview Document"
              >
                🔍 View
              </button>
            )}

            <button
              type="button"
              className="sw-doc-btn-action replace"
              onClick={() => fileInputRef.current?.click()}
              title="Replace with another file"
            >
              🔄 Change
            </button>

            <button
              type="button"
              className="sw-doc-btn-action remove"
              onClick={onClear}
              title="Remove document"
            >
              ✕ Remove
            </button>
          </div>
        </div>
      )}

      {/* Error notification if file reading failed */}
      {uploadError && (
        <div className="sw-doc-upload-error">
          <span>⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  )
}
