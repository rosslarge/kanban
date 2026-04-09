import { toast } from 'sonner'
import { config } from '@/config'
import { showErrorToast, showRetryingToast } from '@/lib/toast'

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
 * Carries both a user-friendly message and raw technical context.
 * Thrown by `apiFetch` after all retries are exhausted or a non-retriable
 * error is received.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** Technical context shown in the expandable toast section. */
    public readonly technicalDetails: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Optional context that wires up toast notifications for an API request.
 * When provided, `apiFetch` owns the full toast lifecycle:
 * - "Retrying… (N of M)" loading toasts during each retry
 * - On final failure the *same* toast is updated in-place to the error state
 *   (no dismiss + new toast flash)
 * - On success the toast is dismissed silently
 */
export interface ToastContext {
  /** Stable ID shared across retry and error toasts so they replace each other. */
  toastId: string
  /** User-friendly message shown if all retries are exhausted. */
  failureMessage: string
}

/**
 * Makes an HTTP request with automatic retry on transient failures.
 *
 * Retry policy:
 * - Network errors and 5xx responses are retried up to MAX_RETRIES times.
 * - 4xx responses are never retried (client errors are not transient).
 * - Each retry waits 2^(attempt-1) × 1000 ms (1 s, 2 s, 4 s).
 * - When `context` is supplied the same toast ID is used throughout so the
 *   "Retrying…" notification transitions directly to the error state without
 *   a dismiss + re-appear flash.
 *
 * @param path - API path relative to the base URL.
 * @param options - Fetch options.
 * @param context - Toast wiring; if omitted no toasts are shown.
 * @returns Parsed JSON body, or `undefined` for 204 No Content.
 * @throws ApiError after all retries are exhausted or a 4xx is received.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  context?: ToastContext,
): Promise<T> {
  const totalAttempts = MAX_RETRIES + 1
  const method = options.method ?? 'GET'
  let lastDetails = `${method} ${BASE}${path}`

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.pow(2, attempt - 1) * 1000
      if (context) {
        showRetryingToast(attempt, MAX_RETRIES, context.toastId)
      }
      await sleep(waitMs)
    }

    try {
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          ...DEFAULT_HEADERS,
          ...(options.headers as Record<string, string> | undefined),
        },
      })

      if (res.ok) {
        if (context) toast.dismiss(context.toastId)
        return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
      }

      if (res.status >= 400 && res.status < 500) {
        // 4xx — non-retriable; show error in-place and throw
        const body = await res.text().catch(() => '')
        const msg = context?.failureMessage ?? friendlyMessage(res.status, body)
        const details = `${method} ${BASE}${path}\nHTTP ${res.status}\n${body.trim()}`
        if (context) {
          showErrorToast(msg, details, context.toastId)
        }
        throw new ApiError(msg, details)
      }

      // 5xx — schedule a retry
      lastDetails = `${method} ${BASE}${path}\nHTTP ${res.status} — server error`
    } catch (err) {
      if (err instanceof ApiError) throw err
      const msg = err instanceof Error ? err.message : 'Network error'
      lastDetails = `${method} ${BASE}${path}\n${msg}`
    }
  }

  // All retries exhausted — transition the retry toast to the error state in-place
  const details = `${lastDetails}\nRetries exhausted (${MAX_RETRIES})`
  const msg = context?.failureMessage ?? 'The request failed after several retries. Please check your connection.'
  if (context) {
    showErrorToast(msg, details, context.toastId)
  }
  throw new ApiError(msg, details)
}

/**
 * Returns a fallback user-friendly message for a given HTTP status code.
 * Used when no `failureMessage` is provided in the toast context.
 */
function friendlyMessage(status: number, body: string): string {
  if (status === 404) return 'That item no longer exists — it may have been deleted.'
  if (status === 400) return body.trim() || 'Invalid request — please check your input.'
  if (status === 401 || status === 403) return "You don't have permission to do that."
  if (status === 409) return 'A conflict occurred. Please refresh and try again.'
  return `Unexpected error (${status}). Please try again.`
}

/** Typed convenience wrappers around `apiFetch`. */
export const apiClient = {
  /**
   * Sends a GET request.
   * @param path - API path.
   * @param context - Optional toast wiring.
   */
  get<T>(path: string, context?: ToastContext): Promise<T> {
    return apiFetch<T>(path, {}, context)
  },
  /**
   * Sends a POST request with a JSON body.
   * @param path - API path.
   * @param body - Request payload.
   * @param context - Optional toast wiring.
   */
  post<T>(path: string, body: unknown, context?: ToastContext): Promise<T> {
    return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, context)
  },
  /**
   * Sends a PUT request with a JSON body.
   * @param path - API path.
   * @param body - Request payload.
   * @param context - Optional toast wiring.
   */
  put<T>(path: string, body: unknown, context?: ToastContext): Promise<T> {
    return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }, context)
  },
  /**
   * Sends a PATCH request with a JSON body.
   * @param path - API path.
   * @param body - Request payload.
   * @param context - Optional toast wiring.
   */
  patch<T>(path: string, body: unknown, context?: ToastContext): Promise<T> {
    return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, context)
  },
  /**
   * Sends a DELETE request.
   * @param path - API path.
   * @param context - Optional toast wiring.
   */
  delete(path: string, context?: ToastContext): Promise<void> {
    return apiFetch<void>(path, { method: 'DELETE' }, context)
  },
}
