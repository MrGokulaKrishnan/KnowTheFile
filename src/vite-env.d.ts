/// <reference types="vite/client" />

declare module 'mammoth' {
  export interface MammothResult {
    value: string
    messages: Array<{ type: string; message: string }>
  }
  export function extractRawText(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }): Promise<MammothResult>
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }): Promise<MammothResult>
}
