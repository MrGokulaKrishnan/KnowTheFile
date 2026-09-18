import React, { useState, useEffect, useRef } from 'react'
import { MailIcon, CloseIcon, CheckIcon, CopyIcon } from '../common/Icons'

const DEVELOPER_EMAIL = 'gokulakrishnan.k.cseacet@gmail.com'

export interface ContactDeveloperModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactDeveloperModal({ isOpen, onClose }: ContactDeveloperModalProps) {
  const [subject, setSubject] = useState('Website Contact / Feedback')
  const [message, setMessage] = useState('')
  const [copiedEmail, setCopiedEmail] = useState(false)

  const subjectInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => subjectInputRef.current?.focus(), 100)
    } else {
      setSubject('Website Contact / Feedback')
      setMessage('')
      setCopiedEmail(false)
    }
  }, [isOpen])

  // ESC key dismiss
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

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault()
    const encodedSubject = encodeURIComponent(subject.trim() || 'Website Contact')
    const encodedBody = encodeURIComponent(message.trim())
    const mailtoUrl = `mailto:${DEVELOPER_EMAIL}?subject=${encodedSubject}&body=${encodedBody}`
    window.location.href = mailtoUrl
    onClose()
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(DEVELOPER_EMAIL)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 3000)
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
        aria-labelledby="contact-dev-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-disc mail-disc">
              <MailIcon size={20} color="#ffd21a" />
            </div>
            <div>
              <h2 id="contact-dev-title">Contact Developer</h2>
              <p className="modal-subtitle">Direct message to Gokulakrishnan K</p>
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

        <div className="email-target-box" style={{ marginTop: '4px', marginBottom: '20px' }}>
          <span className="target-label">Developer:</span>
          <strong className="target-address">Gokulakrishnan K ({DEVELOPER_EMAIL})</strong>
          <button
            type="button"
            className="button button-ghost btn-sm"
            onClick={handleCopyEmail}
          >
            {copiedEmail ? <CheckIcon size={14} color="#ffd21a" /> : <CopyIcon size={14} />}
            <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
          </button>
        </div>

        <form onSubmit={handleSendEmail} className="support-form">
          <div className="form-group">
            <label htmlFor="contact-subject">Subject</label>
            <input
              id="contact-subject"
              ref={subjectInputRef}
              type="text"
              className="support-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Question about KnowTheFile PDF Engine"
              maxLength={150}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              className="support-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your feedback, feature suggestion, or technical query here…"
              rows={4}
              maxLength={2000}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              <MailIcon size={16} />
              <span>Open Email Client</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
