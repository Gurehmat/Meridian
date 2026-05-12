import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  onAuthChange,
  signInWithGoogle,
  signOut as firebaseSignOut,
} from '../lib/firebase'
import { AuthContext } from './AuthContextValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthChange((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({
      loading,
      signIn: signInWithGoogle,
      signOut: firebaseSignOut,
      user,
    }),
    [loading, user],
  )

  if (loading) {
    return null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
