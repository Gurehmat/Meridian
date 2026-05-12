import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { signInWithGoogle, signOut as firebaseSignOut } from '../lib/firebase'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: typeof signInWithGoogle
  signOut: typeof firebaseSignOut
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
