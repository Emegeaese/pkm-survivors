import type { Auth } from 'firebase/auth'
import type { Database } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'

/** Public web configuration from Emegeaese/poke-survivors. Data for this game is namespaced. */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAACmZtUVozdXcyhO8vSJ9N9KFh0_qSkmA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pokesurvivors.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pokesurvivors',
  storageBucket: 'pokesurvivors.firebasestorage.app', messagingSenderId: '365955449851',
  appId: '1:365955449851:web:8d8072fbe93c5fa257815e',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://pokesurvivors-default-rtdb.firebaseio.com',
}
export type FirebaseServices = { auth: Auth; database: Database; firestore: Firestore }
let services: Promise<FirebaseServices> | null = null
export const firebaseServices = () => services ??= Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database'), import('firebase/firestore')]).then(([appSdk, authSdk, dbSdk, storeSdk]) => {
  const app = appSdk.getApps().find((a) => a.name === 'pkm-survivors') ?? appSdk.initializeApp(firebaseConfig, 'pkm-survivors')
  const auth = authSdk.getAuth(app), database = dbSdk.getDatabase(app), firestore = storeSdk.getFirestore(app)
  if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
    authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    dbSdk.connectDatabaseEmulator(database, '127.0.0.1', 9000)
    storeSdk.connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  }
  return { auth, database, firestore }
}).catch((e: unknown) => { services = null; throw e })

export const firebaseErrorCode = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unavailable'
