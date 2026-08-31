import { onAuthStateChanged, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { auth, firebaseConfigured } from '../../services/firebase'
import { authService } from '../../services/authService'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  authError: string | null
  clearAuthError: () => void
  service: typeof authService
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(firebaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    }, (error) => {
      setAuthError(error.message)
      setLoading(false)
    })
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    configured: firebaseConfigured,
    authError,
    clearAuthError: () => setAuthError(null),
    service: authService,
  }), [user, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
