import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; kind: ToastKind }
interface ToastContextValue { show: (message: string, kind?: ToastKind) => void }
const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const value = useMemo(() => ({ show: (message: string, kind: ToastKind = 'info') => {
    const id = Date.now()
    setToasts((previous) => [...previous, { id, message, kind }])
    window.setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 5000)
  } }), [])
  return <ToastContext.Provider value={value}>{children}<div className="toasts" aria-live="polite">{toasts.map((toast) => <div className={`toast ${toast.kind}`} key={toast.id}>{toast.message}</div>)}</div></ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
