/**
 * Application-level configuration derived from environment variables.
 * Evaluated once at module load time so values are consistent across the app.
 */
const backend = import.meta.env.VITE_STORAGE_BACKEND ?? 'local'

export const config = {
  /** Which storage backend to use: 'local' (localStorage) or 'api' (HTTP API). */
  storageBackend: backend as 'local' | 'api',
  /** Base URL for the API (used only when storageBackend === 'api'). */
  apiBaseUrl: 'http://localhost:5029',
  /** User ID header value sent with every API request. */
  apiUserId: 'dev-user',
} as const
