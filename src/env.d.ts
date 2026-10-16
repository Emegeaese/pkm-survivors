/// <reference types="vite/client" />

/** Optional overrides for the public Firebase web configuration. */
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_DATABASE_URL?: string
  readonly VITE_FIREBASE_EMULATORS?: string
  readonly VITE_FIREBASE_FORCE_RELAY?: string
}

/** The build that's playing (the commit, or `dev`): ranked runs report it. Set in `vite.config.ts`. */
declare const __GAME_VERSION__: string
