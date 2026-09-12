import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProcessedDocument } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export async function pdfToImages(
  file: File,
  format: 'png' | 'jpg',
  dpi: '300' | '150' | '72' = '300',
  onProgress?: (percent: number) => void
): Promise<ProcessedDocument> {
  const source = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: source }).promise
  const zip = new JSZip()
  const scale = dpi === '300' ? 3.0 : dpi === '150' ? 2.0 : 1.0

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create an image canvas.')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not encode the page image.'))),
        format === 'png' ? 'image/png' : 'image/jpeg',
        0.95
      )
    )
    zip.file(`page-${index}.${format === 'png' ? 'png' : 'jpg'}`, blob)
    if (onProgress) onProgress(Math.round((index / pdf.numPages) * 100))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return {
    blob,
    fileName: `${file.name.replace(/\.pdf$/i, '')}-images-${dpi}dpi.zip`,
    mimeType: 'application/zip',
    inputBytes: file.size,
    outputBytes: blob.size,
    pageCount: pdf.numPages,
  }
}

export async function pdfToText(file: File): Promise<ProcessedDocument> {
  const source = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: source }).promise
  const sections: string[] = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ').trim()
    sections.push(`Page ${index}\n${text}`)
  }
  const text = sections.join('\n\n')
  if (!text.replace(/Page \d+/g, '').trim()) throw new Error('No selectable text was found. This document may need OCR; no text file was created.')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  return { blob, fileName: `${file.name.replace(/\.pdf$/i, '')}.txt`, mimeType: 'text/plain', inputBytes: file.size, outputBytes: blob.size, pageCount: pdf.numPages }
}
