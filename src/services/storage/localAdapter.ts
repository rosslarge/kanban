import type { StorageAdapter } from './types'

/**
 * No-op storage adapter for local mode.
 *
 * In local mode, Zustand's persist middleware handles all localStorage reads and
 * writes automatically. This adapter exists purely to satisfy the StorageAdapter
 * interface in code paths that don't distinguish between modes. Calling any
 * method on this adapter is a programming error.
 */
export const localAdapter: StorageAdapter = {
  loadBoard: () => Promise.reject(new Error('localAdapter.loadBoard should not be called')),
  addCard: () => Promise.reject(new Error('localAdapter.addCard should not be called')),
  updateCard: () => Promise.reject(new Error('localAdapter.updateCard should not be called')),
  deleteCard: () => Promise.reject(new Error('localAdapter.deleteCard should not be called')),
  moveCard: () => Promise.reject(new Error('localAdapter.moveCard should not be called')),
}
