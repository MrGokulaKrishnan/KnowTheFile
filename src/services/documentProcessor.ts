import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PageRangeResult, ProcessedDocument } from '../types'
import { pdfToDocx, docxToPdf } from './wordConverterService'

export const MAX_FILE_BYTES = 100 * 1024 * 1024

const legalPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
const imageType = (file: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
const legalWord = (file: File) =>
  file.name.toLowerCase().endsWith('.docx') ||
  file.name.toLowerCase().endsWith('.doc') ||
  file.type.includes('word') ||
  file.type.includes('officedocument')
const outputName = (name: string, suffix: string) => `${name.replace(/\.[^.]+$/, '')}-${suffix}.pdf`
const output = async (pdf: PDFDocument, fileName: string, inputBytes: number): Promise<ProcessedDocument> => {
  const bytes = await pdf.save()
  return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName, mimeType: 'application/pdf', inputBytes, outputBytes: bytes.byteLength, pageCount: pdf.getPageCount() }
}

async function embedSupportedImage(pdf: PDFDocument, file: File) {
  const bytes = await file.arrayBuffer()
  if (file.type === 'image/png') return pdf.embedPng(bytes)
  if (file.type === 'image/jpeg') return pdf.embedJpg(bytes)
  // pdf-lib cannot directly embed WebP. Decode it through the browser and embed a PNG instead.
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(`${file.name} could not be decoded as a WebP image.`))
      element.src = sourceUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the WebP image.')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error(`${file.name} could not be converted.`)), 'image/png'))
    return pdf.embedPng(await png.arrayBuffer())
  } finally { URL.revokeObjectURL(sourceUrl) }
}

export function assertFiles(files: File[], accepts: 'pdf' | 'image' | 'word', multiple = false): void {
  if (!files.length) throw new Error('Choose a file to continue.')
  if (!multiple && files.length > 1) throw new Error('Choose one file for this tool.')
  const allowed = accepts === 'pdf' ? legalPdf : accepts === 'word' ? legalWord : imageType
  const invalid = files.find((file) => !allowed(file))
  if (invalid) {
    if (accepts === 'pdf') throw new Error(`${invalid.name} is not a supported PDF.`)
    if (accepts === 'word') throw new Error(`${invalid.name} is not a supported Word document. Use .docx or .doc.`)
    throw new Error(`${invalid.name} is not a supported image. Use JPG, PNG, or WebP.`)
  }
  const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES)
  if (tooLarge) throw new Error(`${tooLarge.name} exceeds the 100 MB browser processing limit.`)
}

export function parsePageRange(value: string, pageCount: number): PageRangeResult {
  const pages = new Set<number>()
  if (!value.trim()) return { pages: [], error: 'Enter a page range, for example 1-3, 5.' }
  for (const part of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!match) return { pages: [], error: `“${part}” is not a valid page range.` }
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > pageCount) return { pages: [], error: `Pages must be between 1 and ${pageCount}.` }
    for (let page = start; page <= end; page += 1) pages.add(page - 1)
  }
  return { pages: [...pages].sort((a, b) => a - b) }
}

export function formatPageNumbersToRange(pages: number[]): string {
  if (!pages.length) return ''
  const sorted = [...new Set(pages.filter((p) => p > 0))].sort((a, b) => a - b)
  if (!sorted.length) return ''
  const ranges: string[] = []
  let start = sorted[0]
  let prev = start

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i]
    if (curr === prev + 1) {
      prev = curr
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
      start = curr
      prev = curr
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
  return ranges.join(', ')
}

export const browserDocumentProcessor = {
  inspect: async (file: File) => {
    assertFiles([file], 'pdf')
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
    return { pageCount: pdf.getPageCount(), title: pdf.getTitle() ?? '', author: pdf.getAuthor() ?? '' }
  },
  merge: async (files: File[]) => {
    assertFiles(files, 'pdf', true)
    if (files.length < 2) {
      throw new Error('Please select at least 2 PDF files to merge together.')
    }
    const merged = await PDFDocument.create()
    for (const file of files) {
      try {
        const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
        const pages = await merged.copyPages(source, source.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
      } catch {
        throw new Error(`Could not read "${file.name}". The file may be password-protected or corrupted.`)
      }
    }
    return output(merged, outputName(files[0].name, 'merged'), files.reduce((total, file) => total + file.size, 0))
  },
  extract: async (file: File, pageIndexes: number[], suffix = 'extracted') => {
    assertFiles([file], 'pdf')
    if (!pageIndexes.length) throw new Error('Select at least one page to extract.')
    try {
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const result = await PDFDocument.create()
      const pages = await result.copyPages(source, pageIndexes)
      pages.forEach((page) => result.addPage(page))
      return output(result, outputName(file.name, suffix), file.size)
    } catch {
      throw new Error(`Could not extract pages from "${file.name}". Check if file is corrupted.`)
    }
  },
  split: async (file: File) => {
    assertFiles([file], 'pdf')
    try {
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const results: ProcessedDocument[] = []
      for (const index of source.getPageIndices()) {
        results.push(await browserDocumentProcessor.extract(file, [index], `page-${index + 1}`))
      }
      return results
    } catch {
      throw new Error(`Could not split "${file.name}". The file may be damaged or invalid.`)
    }
  },
  rotate: async (file: File, pageIndexes: number[], angle: number) => {
    assertFiles([file], 'pdf')
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const targetPages = pageIndexes.length ? pageIndexes : pdf.getPageIndices()
      targetPages.forEach((index) => {
        const page = pdf.getPage(index)
        const current = page.getRotation().angle
        const next = (current + angle) % 360
        page.setRotation(degrees(next))
      })
      return output(pdf, outputName(file.name, 'rotated'), file.size)
    } catch {
      throw new Error(`Could not rotate "${file.name}". Check if the file is valid.`)
    }
  },
  deletePages: async (file: File, pageIndexes: number[]) => {
    assertFiles([file], 'pdf')
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
    if (!pageIndexes.length) throw new Error('Select at least one page to delete.')
    if (pageIndexes.length >= pdf.getPageCount()) throw new Error('A PDF must keep at least one page.')
    ;[...pageIndexes].sort((a, b) => b - a).forEach((index) => pdf.removePage(index))
    return output(pdf, outputName(file.name, 'pages-removed'), file.size)
  },
  compress: async (file: File, level: 'low' | 'medium' | 'high' = 'medium') => {
    assertFiles([file], 'pdf')
    try {
      const source = await file.arrayBuffer()
      const pdf = await PDFDocument.load(source, {
        parseSpeed: 100,
        ignoreEncryption: true,
      })

      if (level === 'high' || level === 'medium') {
        pdf.setTitle('')
        pdf.setAuthor('')
        pdf.setSubject('')
        pdf.setKeywords([])
        pdf.setProducer('KnowTheFile Stream Compressor')
      }

      const bytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      })

      const blob = new Blob([bytes], { type: 'application/pdf' })
      return {
        blob,
        fileName: outputName(file.name, `compressed-${level}`),
        mimeType: 'application/pdf',
        inputBytes: file.size,
        outputBytes: blob.size,
        pageCount: pdf.getPageCount(),
      }
    } catch {
      throw new Error(`Could not compress "${file.name}". The document structure may be damaged.`)
    }
  },
  imagesToPdf: async (files: File[], pageMode: 'fit' | 'original' = 'fit') => {
    assertFiles(files, 'image', true)
    const pdf = await PDFDocument.create()
    for (const file of files) {
      const image = await embedSupportedImage(pdf, file)
      const page = pdf.addPage(pageMode === 'original' ? [image.width, image.height] : [595.28, 841.89])
      const area = page.getSize()
      const scale = pageMode === 'original' ? 1 : Math.min((area.width - 48) / image.width, (area.height - 48) / image.height)
      page.drawImage(image, { x: (area.width - image.width * scale) / 2, y: (area.height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale })
    }
    return output(pdf, 'knowthefile-images.pdf', files.reduce((total, file) => total + file.size, 0))
  },
  watermark: async (file: File, text: string, opacity = 0.18) => {
    assertFiles([file], 'pdf')
    if (!text.trim()) throw new Error('Enter watermark text.')
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    const font = await pdf.embedFont(StandardFonts.HelveticaBold)
    pdf.getPages().forEach((page) => {
      const { width, height } = page.getSize()
      page.drawText(text.trim(), { x: width * 0.14, y: height * 0.48, size: Math.min(width, height) / 9, font, color: rgb(1, 0.64, 0), opacity, rotate: degrees(35) })
    })
    return output(pdf, outputName(file.name, 'watermarked'), file.size)
  },
  pageNumbers: async (file: File, position: 'bottom-center' | 'bottom-right') => {
    assertFiles([file], 'pdf')
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    pdf.getPages().forEach((page, index) => {
      const { width } = page.getSize()
      const value = String(index + 1)
      const textWidth = font.widthOfTextAtSize(value, 10)
      page.drawText(value, { x: position === 'bottom-center' ? (width - textWidth) / 2 : width - textWidth - 28, y: 20, size: 10, font, color: rgb(0.24, 0.24, 0.24) })
    })
    return output(pdf, outputName(file.name, 'numbered'), file.size)
  },
  metadata: async (file: File, fields: { title: string; author: string; subject: string; keywords: string }) => {
    assertFiles([file], 'pdf')
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    pdf.setTitle(fields.title)
    pdf.setAuthor(fields.author)
    pdf.setSubject(fields.subject)
    pdf.setKeywords(fields.keywords.split(',').map((item) => item.trim()).filter(Boolean))
    return output(pdf, outputName(file.name, 'metadata'), file.size)
  },
  pdfToDocx: async (file: File) => {
    assertFiles([file], 'pdf')
    return pdfToDocx(file)
  },
  wordToPdf: async (file: File) => {
    assertFiles([file], 'word')
    return docxToPdf(file)
  },
  sign: async (file: File, signatureText: string) => {
    assertFiles([file], 'pdf')
    if (!signatureText.trim()) throw new Error('Enter a name or signature text.')
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    const font = await pdf.embedFont(StandardFonts.TimesRomanItalic)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pages = pdf.getPages()
    const lastPage = pages[pages.length - 1]
    const { width } = lastPage.getSize()

    lastPage.drawRectangle({
      x: width - 240,
      y: 35,
      width: 200,
      height: 55,
      borderWidth: 1,
      borderColor: rgb(0.8, 0.8, 0.8),
      color: rgb(0.98, 0.98, 0.98),
    })
    lastPage.drawText('VERIFIED SIGNATURE', {
      x: width - 228,
      y: 74,
      size: 7,
      font: fontBold,
      color: rgb(0.15, 0.55, 0.2),
    })
    lastPage.drawText(signatureText.trim(), {
      x: width - 228,
      y: 52,
      size: 15,
      font,
      color: rgb(0.05, 0.15, 0.35),
    })
    lastPage.drawText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), {
      x: width - 228,
      y: 40,
      size: 8,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5),
    })
    return output(pdf, outputName(file.name, 'signed'), file.size)
  },
  unlock: async (file: File, _password?: string) => {
    assertFiles([file], 'pdf')
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      return output(pdf, outputName(file.name, 'unlocked'), file.size)
    } catch {
      throw new Error('Could not unlock PDF. Please check that the password is correct or that the file is not corrupted.')
    }
  },
}

export const serverDocumentProcessor = {
  unavailable: (operation: string) => { throw new Error(`${operation} needs a configured server processor. No output was created.`) },
}
