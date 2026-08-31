export type ProcessingStatus = 'idle' | 'validating' | 'processing' | 'completed' | 'error'

export type ToolId =
  | 'merge-pdf'
  | 'split-pdf'
  | 'rotate-pdf'
  | 'extract-pdf'
  | 'delete-pages'
  | 'compress-pdf'
  | 'image-to-pdf'
  | 'watermark-pdf'
  | 'page-numbers'
  | 'metadata-pdf'
  | 'pdf-editor'
  | 'pdf-to-image'
  | 'pdf-to-text'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'sign-pdf'
  | 'protect-pdf'
  | 'unlock-pdf'

export type ToolAvailability = 'browser' | 'server'

export interface ToolDefinition {
  id: ToolId
  name: string
  description: string
  category: 'Organize' | 'Create' | 'Edit' | 'Convert' | 'Secure'
  availability: ToolAvailability
  accent: string
  tag?: string
}

export interface ProcessedDocument {
  blob: Blob
  fileName: string
  mimeType: string
  inputBytes: number
  outputBytes: number
  pageCount?: number
}

export interface PageRangeResult {
  pages: number[]
  error?: string
}

export interface FirebaseUserProfile {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  provider: string
}
