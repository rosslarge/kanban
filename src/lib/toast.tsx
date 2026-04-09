import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Retrying toast — shown in-place during each retry attempt
// ---------------------------------------------------------------------------

interface RetryingToastProps {
  attempt: number
  maxRetries: number
}

function RetryingToast({ attempt, maxRetries }: RetryingToastProps) {
  return (
    <div
      className="rounded-xl p-3.5 flex items-center gap-2.5 w-80"
      style={{
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 24px var(--shadow-b)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Loader2 size={15} className="text-amber-400 shrink-0 animate-spin" />
      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--ink-primary)' }}>
        Retrying… ({attempt} of {maxRetries})
      </p>
    </div>
  )
}

/**
 * Shows or updates a custom retrying toast in-place.
 * Using toast.custom (rather than toast.loading) ensures the same toast type
 * is used throughout the retry lifecycle, so the transition to the error state
 * is seamless with no spinner left behind.
 * @param attempt - The current retry attempt number (1-based).
 * @param maxRetries - The maximum number of retries.
 * @param toastId - Stable ID shared across retry and error toasts.
 */
export function showRetryingToast(attempt: number, maxRetries: number, toastId: string) {
  toast.custom(
    () => <RetryingToast attempt={attempt} maxRetries={maxRetries} />,
    { id: toastId, duration: Infinity },
  )
}

// ---------------------------------------------------------------------------
// Error toast — expandable, dismissible
// ---------------------------------------------------------------------------

interface ErrorToastProps {
  message: string
  details?: string
  toastId: string | number
}

/**
 * A dismissible toast card that shows a user-friendly error message.
 * A chevron button reveals a scrollable pre-formatted block of technical
 * context (endpoint, status, etc.). An X button dismisses the toast.
 */
function ErrorToast({ message, details, toastId }: ErrorToastProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2 w-80"
      style={{
        background: 'var(--bg-sidebar)',
        border: '1px solid rgba(220, 53, 69, 0.22)',
        boxShadow: '0 4px 24px var(--shadow-b)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
        <p
          className="text-sm font-medium leading-snug flex-1"
          style={{ color: 'var(--ink-primary)' }}
        >
          {message}
        </p>
        <div className="flex items-center gap-0.5 shrink-0">
          {details && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="rounded p-0.5 transition-colors cursor-pointer"
              style={{ color: 'var(--ink-faint)' }}
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={() => toast.dismiss(toastId)}
            className="rounded p-0.5 transition-colors cursor-pointer"
            style={{ color: 'var(--ink-faint)' }}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && details && (
        <pre
          className="text-[11px] rounded-lg px-2.5 py-2 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all leading-relaxed max-h-40"
          style={{
            background: 'rgba(220, 53, 69, 0.07)',
            color: 'var(--ink-muted)',
            border: '1px solid rgba(220, 53, 69, 0.12)',
            fontFamily: "'Fira Code', monospace",
          }}
        >
          {details}
        </pre>
      )}
    </div>
  )
}

/**
 * Shows an expandable, dismissible error toast.
 * When `id` is supplied and matches an existing toast (e.g. a retrying toast),
 * sonner updates it in-place so the retry notification transitions directly to
 * the error state without a dismiss + re-appear flash.
 *
 * @param message - User-friendly summary shown in the collapsed state.
 * @param details - Technical context (endpoint, status, raw error) revealed on expand.
 * @param id - Optional toast ID; used to replace an in-flight retry toast.
 */
export function showErrorToast(message: string, details?: string, id?: string | number) {
  const toastId = id ?? `error-${Date.now()}`
  toast.custom(
    () => <ErrorToast message={message} details={details} toastId={toastId} />,
    { id: toastId, duration: 10_000 },
  )
}
