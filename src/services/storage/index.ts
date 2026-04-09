import { config } from '@/config'
import { localAdapter } from './localAdapter'
import { apiAdapter } from './apiAdapter'
import type { StorageAdapter } from './types'

export type { StorageAdapter }

/**
 * The active storage adapter, selected once at module load time based on
 * `VITE_STORAGE_BACKEND`. Import this in the board store for all persistence.
 */
export const storageAdapter: StorageAdapter =
  config.storageBackend === 'api' ? apiAdapter : localAdapter
