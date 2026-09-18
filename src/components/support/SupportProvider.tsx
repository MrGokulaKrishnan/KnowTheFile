import React, { createContext, useContext, useState } from 'react'
import { ReportBugModal } from './ReportBugModal'
import { ContactDeveloperModal } from './ContactDeveloperModal'

interface SupportContextType {
  openReportBug: () => void
  openContactDeveloper: () => void
  closeModals: () => void
}

const SupportContext = createContext<SupportContextType | undefined>(undefined)

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [bugModalOpen, setBugModalOpen] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)

  const openReportBug = () => {
    setContactModalOpen(false)
    setBugModalOpen(true)
  }

  const openContactDeveloper = () => {
    setBugModalOpen(false)
    setContactModalOpen(true)
  }

  const closeModals = () => {
    setBugModalOpen(false)
    setContactModalOpen(false)
  }

  return (
    <SupportContext.Provider value={{ openReportBug, openContactDeveloper, closeModals }}>
      {children}
      <ReportBugModal isOpen={bugModalOpen} onClose={() => setBugModalOpen(false)} />
      <ContactDeveloperModal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </SupportContext.Provider>
  )
}

export function useSupportModal() {
  const context = useContext(SupportContext)
  if (!context) {
    throw new Error('useSupportModal must be used within a SupportProvider')
  }
  return context
}
