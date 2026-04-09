/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_BACKEND?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
