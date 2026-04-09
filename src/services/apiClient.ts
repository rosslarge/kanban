import { toast } from 'sonner'
import { config } from '@/config'

const BASE = config.apiBaseUrl
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-User-Id': config.apiUserId,
}

/** Maximum number of retry attempts after the initial request. */
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Makes an HTTP request to the API with automatic retry on transient failures.
 *
 * Retry policy:
 * - Network errors and 5xx responses are retried up to MAX_RETRIES times.
 * - 4xx responses are never retried (client errors are not transient).
 * - Each retry waits 2^(attempt-1) * 1000ms (1s, 2s, 4s).
 * - A loading toast is shown during retries and updated in-place to avoid stacking.
 *
 * @param path - API path relative to the base URL (e.g. '/api/cards').
 * @param options - Fetch options (method, body, etc.).
 * @param toastId - Optional ID for retry toasts; shared across retries so they update in-place.
 * @returns Parsed JSON response body, or undefined for 204 No Content.
 * @throws Error with a user-friendly message if all attempts fail or a 4xx is received.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  toastId?: string,
): Promise<T> {
  const totalAttempts = MAX_RETRIES + 1 // 1 initial + MAX_RETRIES retries
  let lastError: Error | null = null

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.pow(2, attempt - 1) * 1000
      const id = toastId ?? `retry-${path}`
      toast.loading(`Retrying... (attempt ${attempt} of ${MAX_RETRIES})`, { id })
      await sleep(waitMs)
    }

    try {
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { ...DEFAULT_HEADERS, ...(options.headers as Record<string, string> | undefined) },
      })

      if (res.ok) {
        if (toastId) toast.dismiss(toastId)
        return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
      }

      if (res.status >= 400 && res.status < 500) {
        // 4xx: client error, do not retry
        if (toastId) toast.dismiss(toastId)
        const body = await res.text().catch(() => '')
        throw new ClientError(userFriendlyMessage(res.status, body))
      }

      // 5xx: server error, schedule a retry
      lastError = new Error(`Server error (${res.status})`)
    } catch (err) {
      if (err instanceof ClientError) throw err
      lastError = err instanceof Error ? err : new Error('Network error')
    }
  }

  // All retries exhausted
  if (toastId) toast.dismiss(toastId)
  const message = lastError?.message ?? 'Request failed. Please try again.'
  toast.error(message)
  throw new Error(message)
}

/** Marks an error as a non-retriable 4xx response so the retry loop can re-throw it. */
class ClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClientError'
  }
}

/**
 * Maps an HTTP status code to a user-friendly error message.
 * @param status - HTTP status code.
 * @param body - Response body text (may contain additional detail).
 * @returns A human-readable error string.
 */
function userFriendlyMessage(status: number, body: string): string {
  if (status === 404) return 'Item not found. It may have been deleted.'
  if (status === 400) return body.trim() || 'Invalid request. Please check your input.'
  if (status === 401 || status === 403) return 'You don\'t have permission to do that.'
  if (status === 409) return 'A conflict occurred. Please refresh and try again.'
  return `Unexpected error (${status}). Please try again.`
}

/** Typed convenience wrappers around apiFetch. */
export const apiClient = {
  /**
   * Sends a GET request.
   * @param path - API path.
   */
  get<T>(path: string): Promise<T> {
    return apiFetch<T>(path)
  },

  /**
   * Sends a POST request with a JSON body.
   * @param path - API path.
   * @param body - Request payload.
   */
  post<T>(path: string, body: unknown): Promise<T> {
    return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },

  /**
   * Sends a PUT request with a JSON body, supporting retry toasts.
   * @param path - API path.
   * @param body - Request payload.
   * @param toastId - Toast ID for retry feedback.
   */
  put<T>(path: string, body: unknown, toastId?: string): Promise<T> {
    return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }, toastId)
  },

  /**
   * Sends a PATCH request with a JSON body, supporting retry toasts.
   * @param path - API path.
   * @param body - Request payload.
   * @param toastId - Toast ID for retry feedback.
   */
  patch<T>(path: string, body: unknown, toastId?: string): Promise<T> {
    return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, toastId)
  },

  /**
   * Sends a DELETE request, supporting retry toasts.
   * @param path - API path.
   * @param toastId - Toast ID for retry feedback.
   */
  delete(path: string, toastId?: string): Promise<void> {
    return apiFetch<void>(path, { method: 'DELETE' }, toastId)
  },
}
