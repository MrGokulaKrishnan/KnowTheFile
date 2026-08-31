import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ProcessedDocument } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export async function pdfToImages(file: File, format: 'png' | 'jpg', scale = 1.5): Promise<ProcessedDocument> {
  const source = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: source }).promise
  const zip = new JSZip()
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create an image canvas.')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode the page image.')), format === 'png' ? 'image/png' : 'image/jpeg', 0.92))
    zip.file(`page-${index}.${format === 'png' ? 'png' : 'jpg'}`, blob)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, fileName: `${file.name.replace(/\.pdf$/i, '')}-pages.zip`, mimeType: 'application/zip', inputBytes: file.size, outputBytes: blob.size, pageCount: pdf.numPages }
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
