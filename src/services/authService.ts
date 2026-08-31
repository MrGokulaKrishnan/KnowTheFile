import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, firebaseConfigured } from './firebase'

const ready = () => {
  if (!firebaseConfigured || !auth) throw new Error('Firebase is not configured. Add the public VITE_FIREBASE_* values before using account features.')
  return auth
}

export const authService = {
  register: async (email: string, password: string) => {
    const credentials = await createUserWithEmailAndPassword(ready(), email, password)
    await sendEmailVerification(credentials.user)
    return credentials.user
  },
  login: (email: string, password: string) => signInWithEmailAndPassword(ready(), email, password),
  loginWithGoogle: () => signInWithPopup(ready(), new GoogleAuthProvider()),
  logout: () => signOut(ready()),
  resetPassword: (email: string) => sendPasswordResetEmail(ready(), email),
  resendVerification: (user: User) => sendEmailVerification(user),
}
