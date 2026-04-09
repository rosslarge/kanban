import type { StorageAdapter } from './types'

/**
 * No-op adapter for local mode.
 * Zustand's `persist` middleware handles all localStorage reads/writes automatically.
 * This stub satisfies the `StorageAdapter` interface but should never be called —
 * if it is, a rejected promise makes the mistake obvious in dev tools.
 */
export const localAdapter: StorageAdapter = {
  loadBoard: () => Promise.reject(new Error('localAdapter.loadBoard should not be called')),
  addCard: () => Promise.reject(new Error('localAdapter.addCard should not be called')),
  updateCard: () => Promise.reject(new Error('localAdapter.updateCard should not be called')),
  deleteCard: () => Promise.reject(new Error('localAdapter.deleteCard should not be called')),
  moveCard: () => Promise.reject(new Error('localAdapter.moveCard should not be called')),
}
