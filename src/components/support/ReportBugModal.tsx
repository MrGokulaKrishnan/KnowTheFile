import React, { useState, useEffect } from 'react'
import { BugIcon, CloseIcon, CopyIcon, MessageSquareWarningIcon } from '../common/Icons'

interface ReportBugModalProps {
  isOpen: boolean
  onClose: () => void
}

const CATEGORIES = [
  'UI / Design',
  'Login / Authentication',
  'Feature Not Working',
  'Performance',
  'Mobile / Responsive',
  'Data Issue',
  'Error / Crash',
  'Security Concern',
  'Other'
]

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const DEVELOPER_EMAIL = 'gokulakrishnan.k.cseacet@gmail.com'

export function ReportBugModal({ isOpen, onClose }: ReportBugModalProps) {
  const [step, setStep] = useState<'form' | 'ready'>('form')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: CATEGORIES[0],
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    priority: PRIORITIES[0]
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mailtoUrl, setMailtoUrl] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep('form')
      setCopySuccess(false)
      setErrors({})
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getSystemInfo = () => {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      resolution: `${window.screen.width}x${window.screen.height}`,
      pixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString()
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) newErrors.title = 'Title is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const sysInfo = getSystemInfo()

    const body = `BUG REPORT

Reporter Name: ${formData.name || 'Not provided'}
Reporter Email: ${formData.email || 'Not provided'}
Category: ${formData.category}
Priority: ${formData.priority}

Title: ${formData.title}

Description:
${formData.description}

Steps to Reproduce:
${formData.steps || 'Not provided'}

Expected Result:
${formData.expected || 'Not provided'}

Actual Result:
${formData.actual || 'Not provided'}

--- Technical Information ---
Page URL: ${sysInfo.url}
User Agent: ${sysInfo.userAgent}
Platform: ${sysInfo.platform}
Resolution: ${sysInfo.resolution} (DPR: ${sysInfo.pixelRatio})
Reported At: ${sysInfo.timestamp}
`

    const subject = `[Bug Report] ${formData.title}`
    const url = `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    
    setMailtoUrl(url)
    
    // Attempt to open email client immediately
    window.location.href = url
    
    setStep('ready')
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(DEVELOPER_EMAIL)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy email', err)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bug-modal-title">
      <div className="modal-content bug-report-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BugIcon size={24} color="#ffd21a" />
            <h2 id="bug-modal-title">Report a Bug</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={20} />
          </button>
        </header>

        {step === 'form' ? (
          <form className="modal-body form-layout" onSubmit={handleSubmit}>
            <p className="modal-description">
              Found a technical issue? Let us know the details so we can fix it.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bug-name">Name (Optional)</label>
                <input
                  id="bug-name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="bug-email">Email (Optional)</label>
                <input
                  id="bug-email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bug-category">Category *</label>
                <select
                  id="bug-category"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="bug-priority">Priority *</label>
                <select
                  id="bug-priority"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bug-title">Bug Title *</label>
              <input
                id="bug-title"
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief summary of the issue"
                aria-invalid={!!errors.title}
              />
              {errors.title && <span className="error-text">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bug-description">Description *</label>
              <textarea
                id="bug-description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What happened? Please be as detailed as possible."
                rows={4}
                aria-invalid={!!errors.description}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bug-steps">Steps to Reproduce (Optional)</label>
              <textarea
                id="bug-steps"
                value={formData.steps}
                onChange={e => setFormData({ ...formData, steps: e.target.value })}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bug-expected">Expected Result (Optional)</label>
                <textarea
                  id="bug-expected"
                  value={formData.expected}
                  onChange={e => setFormData({ ...formData, expected: e.target.value })}
                  placeholder="What should have happened?"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bug-actual">Actual Result (Optional)</label>
                <textarea
                  id="bug-actual"
                  value={formData.actual}
                  onChange={e => setFormData({ ...formData, actual: e.target.value })}
                  placeholder="What actually happened?"
                  rows={2}
                />
              </div>
            </div>

            <div className="system-info-notice">
              <MessageSquareWarningIcon size={14} />
              <span>Technical info (Browser, OS, URL) will be automatically included to help debugging.</span>
            </div>

            <footer className="modal-footer">
              <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="button button-primary">Prepare Report</button>
            </footer>
          </form>
        ) : (
          <div className="modal-body ready-state">
            <div className="ready-icon-container">
              <BugIcon size={48} color="#ffd21a" />
            </div>
            <h3>Bug Report Ready</h3>
            <p>
              Your bug report has been prepared. Your default email client should have opened to send the message.
              If it didn't open automatically, you can open it manually or copy the developer email address below.
            </p>
            
            <div className="ready-actions">
              <a href={mailtoUrl} className="button button-primary">
                Open Email Client
              </a>
              <button type="button" className="button button-ghost" onClick={handleCopyEmail}>
                <CopyIcon size={16} />
                <span>{copySuccess ? 'Copied!' : 'Copy Developer Email'}</span>
              </button>
            </div>
            
            <div className="developer-contact-info">
              <strong>Developer:</strong> Gokulakrishnan K <br />
              <span>{DEVELOPER_EMAIL}</span>
            </div>

            <footer className="modal-footer" style={{ justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" className="button button-ghost" onClick={onClose}>Close Window</button>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
