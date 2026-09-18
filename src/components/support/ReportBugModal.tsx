import React, { useState, useEffect, useRef } from 'react'
import { BugIcon, CloseIcon, CheckIcon, CopyIcon, MailIcon, CircleAlertIcon } from '../common/Icons'

const DEVELOPER_EMAIL = 'gokulakrishnan.k.cseacet@gmail.com'

export interface ReportBugModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ReportBugModal({ isOpen, onClose }: ReportBugModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('Feature Not Working')
  const [priority, setPriority] = useState('Medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [expectedResult, setExpectedResult] = useState('')
  const [actualResult, setActualResult] = useState('')

  // Validation & UI states
  const [errors, setErrors] = useState<{ title?: string; description?: string; email?: string }>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)

  // Environment Telemetry
  const [telemetry, setTelemetry] = useState({
    pageUrl: '',
    browser: '',
    os: '',
    screenResolution: '',
    devicePixelRatio: 1,
    userAgent: '',
    timestamp: ''
  })

  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Capture browser & device environment info safely
      const ua = navigator.userAgent
      let browserName = 'Browser'
      if (ua.includes('Firefox/')) browserName = `Firefox (${ua.split('Firefox/')[1]?.split(' ')[0]})`
      else if (ua.includes('Edg/')) browserName = `Edge (${ua.split('Edg/')[1]?.split(' ')[0]})`
      else if (ua.includes('Chrome/')) browserName = `Chrome (${ua.split('Chrome/')[1]?.split(' ')[0]})`
      else if (ua.includes('Safari/')) browserName = `Safari (${ua.split('Version/')[1]?.split(' ')[0] || ''})`

      let osName = 'OS'
      if (ua.includes('Win')) osName = 'Windows'
      else if (ua.includes('Mac')) osName = 'macOS'
      else if (ua.includes('Linux')) osName = 'Linux'
      else if (ua.includes('Android')) osName = 'Android'
      else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS'

      setTelemetry({
        pageUrl: window.location.href,
        browser: browserName,
        os: osName,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        devicePixelRatio: window.devicePixelRatio || 1,
        userAgent: ua,
        timestamp: new Date().toISOString()
      })

      // Auto-focus title input when modal opens
      setTimeout(() => titleInputRef.current?.focus(), 100)
    } else {
      // Reset form state on close
      setIsSubmitted(false)
      setCopiedEmail(false)
      setCopiedReport(false)
      setErrors({})
    }
  }, [isOpen])

  // ESC Key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const validateForm = () => {
    const newErrors: { title?: string; description?: string; email?: string } = {}
    if (!title.trim()) {
      newErrors.title = 'Bug title is required'
    }
    if (!description.trim()) {
      newErrors.description = 'Bug description is required'
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildReportText = () => {
    return [
      `=== BUG REPORT: ${title.trim()} ===`,
      `Reporter Name: ${name.trim() || 'Anonymous'}`,
      `Reporter Email: ${email.trim() || 'Not provided'}`,
      `Category: ${category}`,
      `Priority: ${priority}`,
      `Page URL: ${telemetry.pageUrl}`,
      `Timestamp: ${telemetry.timestamp}`,
      ``,
      `--- ISSUE DESCRIPTION ---`,
      description.trim(),
      ``,
      steps.trim() ? `--- STEPS TO REPRODUCE ---\n${steps.trim()}\n` : '',
      expectedResult.trim() ? `--- EXPECTED RESULT ---\n${expectedResult.trim()}\n` : '',
      actualResult.trim() ? `--- ACTUAL RESULT ---\n${actualResult.trim()}\n` : '',
      `--- TECHNICAL TELEMETRY ---`,
      `Browser: ${telemetry.browser}`,
      `Operating System: ${telemetry.os}`,
      `Screen Resolution: ${telemetry.screenResolution} (DPR: ${telemetry.devicePixelRatio})`,
      `User Agent: ${telemetry.userAgent}`
    ].filter(Boolean).join('\n')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const reportText = buildReportText()
    const subject = encodeURIComponent(`[Bug Report] ${title.trim()} (${category})`)
    const body = encodeURIComponent(reportText)
    const mailtoUrl = `mailto:${DEVELOPER_EMAIL}?subject=${subject}&body=${body}`

    // Trigger mailto client open
    window.location.href = mailtoUrl
    setIsSubmitted(true)
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(DEVELOPER_EMAIL)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 3000)
  }

  const handleCopyReport = () => {
    navigator.clipboard.writeText(buildReportText())
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 3000)
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="modal-card support-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-bug-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-disc bug-disc">
              <BugIcon size={20} color="#ffd21a" />
            </div>
            <div>
              <h2 id="report-bug-title">Report a Bug</h2>
              <p className="modal-subtitle">Direct technical report to Gokulakrishnan K</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="support-form" noValidate>
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="bug-name">Your Name <small>(Optional)</small></label>
                <input
                  id="bug-name"
                  type="text"
                  className="support-input"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bug-email">Your Email <small>(Optional)</small></label>
                <input
                  id="bug-email"
                  type="email"
                  className={`support-input ${errors.email ? 'has-error' : ''}`}
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  maxLength={120}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="bug-category">Category <span className="required-star">*</span></label>
                <select
                  id="bug-category"
                  className="support-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="UI / Design">UI / Design</option>
                  <option value="Login / Authentication">Login / Authentication</option>
                  <option value="Feature Not Working">Feature Not Working</option>
                  <option value="Performance">Performance</option>
                  <option value="Mobile / Responsive">Mobile / Responsive</option>
                  <option value="Data Issue">Data Issue</option>
                  <option value="Error / Crash">Error / Crash</option>
                  <option value="Security Concern">Security Concern</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="bug-priority">Priority <span className="required-star">*</span></label>
                <select
                  id="bug-priority"
                  className="support-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="Low">Low — Minor issue</option>
                  <option value="Medium">Medium — Normal bug</option>
                  <option value="High">High — Prevents workflow</option>
                  <option value="Critical">Critical — Crash or data loss</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bug-title">Bug Title <span className="required-star">*</span></label>
              <input
                id="bug-title"
                ref={titleInputRef}
                type="text"
                className={`support-input ${errors.title ? 'has-error' : ''}`}
                placeholder="e.g. PDF editor page fails to render text on mobile Safari"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                }}
                maxLength={150}
                required
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bug-description">Bug Description <span className="required-star">*</span></label>
              <textarea
                id="bug-description"
                className={`support-textarea ${errors.description ? 'has-error' : ''}`}
                placeholder="Describe what happened, error messages shown, and any relevant context…"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }))
                }}
                rows={3}
                maxLength={2000}
                required
              />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bug-steps">Steps to Reproduce <small>(Optional)</small></label>
              <textarea
                id="bug-steps"
                className="support-textarea"
                placeholder="1. Go to '/tools/pdf-editor'&#10;2. Upload a 5MB document&#10;3. Click on the text toolbar button"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={2}
                maxLength={1000}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="bug-expected">Expected Result <small>(Optional)</small></label>
                <input
                  id="bug-expected"
                  type="text"
                  className="support-input"
                  placeholder="e.g. Text element should insert"
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  maxLength={300}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bug-actual">Actual Result <small>(Optional)</small></label>
                <input
                  id="bug-actual"
                  type="text"
                  className="support-input"
                  placeholder="e.g. Page froze with blank canvas"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>

            {/* Auto-Captured Telemetry Info */}
            <div className="telemetry-box">
              <div className="telemetry-header">
                <CircleAlertIcon size={14} color="#ffd21a" />
                <span>Auto-Captured Environment Telemetry</span>
              </div>
              <div className="telemetry-chips">
                <span className="tele-chip">URL: {telemetry.pageUrl || '/'}</span>
                <span className="tele-chip">Browser: {telemetry.browser}</span>
                <span className="tele-chip">OS: {telemetry.os}</span>
                <span className="tele-chip">Res: {telemetry.screenResolution}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="button button-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="button button-primary">
                <MailIcon size={16} />
                <span>Prepare Bug Report Email</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="submission-success-card">
            <div className="success-badge">
              <CheckIcon size={28} color="#000000" />
            </div>
            <h3>Bug Report Ready</h3>
            <p className="success-copy">
              Your bug report has been formatted. Your default email client will launch so you can send it directly to developer <strong>Gokulakrishnan K</strong>.
            </p>

            <div className="email-target-box">
              <span className="target-label">Developer Email:</span>
              <strong className="target-address">{DEVELOPER_EMAIL}</strong>
              <button
                type="button"
                className="button button-ghost btn-sm"
                onClick={handleCopyEmail}
              >
                {copiedEmail ? <CheckIcon size={14} color="#ffd21a" /> : <CopyIcon size={14} />}
                <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
              </button>
            </div>

            <div className="modal-actions full-width-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const subject = encodeURIComponent(`[Bug Report] ${title.trim()} (${category})`)
                  const body = encodeURIComponent(buildReportText())
                  window.location.href = `mailto:${DEVELOPER_EMAIL}?subject=${subject}&body=${body}`
                }}
              >
                <MailIcon size={16} />
                <span>Open Mail App Again</span>
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={handleCopyReport}
              >
                {copiedReport ? <CheckIcon size={16} color="#ffd21a" /> : <CopyIcon size={16} />}
                <span>{copiedReport ? 'Report Copied to Clipboard!' : 'Copy Full Report Text'}</span>
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
