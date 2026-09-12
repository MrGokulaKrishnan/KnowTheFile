import { describe, it, expect } from 'vitest'
import { PDFDocument, rgb } from 'pdf-lib'
import {
  assertFiles,
  parsePageRange,
  browserDocumentProcessor,
  MAX_FILE_BYTES,
} from '../src/services/documentProcessor'

async function createSamplePdf(pageCount = 3, title = 'Test Document'): Promise<File> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setAuthor('Test Author')
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([400, 400])
    page.drawText(`Page ${i + 1}`, { x: 50, y: 350, size: 24, color: rgb(0, 0, 0) })
  }
  const bytes = await pdf.save()
  return new File([bytes], 'sample.pdf', { type: 'application/pdf' })
}

describe('Document Processor & Validation Suite', () => {
  describe('assertFiles validation', () => {
    it('throws error when no files provided', () => {
      expect(() => assertFiles([], 'pdf')).toThrow('Choose a file to continue.')
    })

    it('throws error when multiple files provided for single-file tool', () => {
      const file1 = new File(['a'], 'a.pdf', { type: 'application/pdf' })
      const file2 = new File(['b'], 'b.pdf', { type: 'application/pdf' })
      expect(() => assertFiles([file1, file2], 'pdf', false)).toThrow('Choose one file for this tool.')
    })

    it('rejects unsupported file extension for PDF', () => {
      const file = new File(['data'], 'test.exe', { type: 'application/octet-stream' })
      expect(() => assertFiles([file], 'pdf')).toThrow('test.exe is not a supported PDF.')
    })

    it('rejects files exceeding 100 MB processing limit', () => {
      const largeFile = new File([''], 'huge.pdf', { type: 'application/pdf' })
      Object.defineProperty(largeFile, 'size', { value: MAX_FILE_BYTES + 1024 })
      expect(() => assertFiles([largeFile], 'pdf')).toThrow(/exceeds the 100 MB browser processing limit/)
    })

    it('accepts valid PDF, Word, and Image files', () => {
      const pdf = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
      const docx = new File(['PK'], 'doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const img = new File(['img'], 'photo.png', { type: 'image/png' })

      expect(() => assertFiles([pdf], 'pdf')).not.toThrow()
      expect(() => assertFiles([docx], 'word')).not.toThrow()
      expect(() => assertFiles([img], 'image')).not.toThrow()
    })
  })

  describe('parsePageRange', () => {
    it('parses comma-separated and hyphenated page ranges', () => {
      const result = parsePageRange('1-2, 4', 5)
      expect(result.error).toBeUndefined()
      expect(result.pages).toEqual([0, 1, 3])
    })

    it('returns error on empty or invalid string', () => {
      expect(parsePageRange('', 5).error).toBeDefined()
      expect(parsePageRange('abc', 5).error).toBeDefined()
    })

    it('returns error when page numbers exceed document count', () => {
      const result = parsePageRange('1-10', 3)
      expect(result.error).toContain('Pages must be between 1 and 3.')
    })
  })

  describe('browserDocumentProcessor operations', () => {
    it('inspects page count, title, and metadata correctly', async () => {
      const file = await createSamplePdf(3, 'Audit Report')
      const info = await browserDocumentProcessor.inspect(file)
      expect(info.pageCount).toBe(3)
      expect(info.title).toBe('Audit Report')
      expect(info.author).toBe('Test Author')
    })

    it('merges multiple PDFs into one document', async () => {
      const file1 = await createSamplePdf(2)
      const file2 = await createSamplePdf(3)
      const result = await browserDocumentProcessor.merge([file1, file2])
      expect(result.pageCount).toBe(5)
      expect(result.mimeType).toBe('application/pdf')
      expect(result.blob.size).toBeGreaterThan(0)
    })

    it('splits and extracts specific page ranges', async () => {
      const file = await createSamplePdf(4)
      const extracted = await browserDocumentProcessor.extract(file, [0, 2])
      expect(extracted.pageCount).toBe(2)
      expect(extracted.fileName).toContain('extracted')
    })

    it('splits all pages into individual documents', async () => {
      const file = await createSamplePdf(3)
      const splitList = await browserDocumentProcessor.split(file)
      expect(splitList.length).toBe(3)
      expect(splitList[0].pageCount).toBe(1)
      expect(splitList[1].pageCount).toBe(1)
      expect(splitList[2].pageCount).toBe(1)
    })

    it('rotates document pages by specified angles', async () => {
      const file = await createSamplePdf(2)
      const rotated = await browserDocumentProcessor.rotate(file, [0], 90)
      expect(rotated.pageCount).toBe(2)
      expect(rotated.blob.size).toBeGreaterThan(0)
    })

    it('deletes selected pages from document', async () => {
      const file = await createSamplePdf(4)
      const result = await browserDocumentProcessor.deletePages(file, [0, 1])
      expect(result.pageCount).toBe(2)
    })

    it('prevents deleting all pages in a document', async () => {
      const file = await createSamplePdf(2)
      await expect(browserDocumentProcessor.deletePages(file, [0, 1])).rejects.toThrow(
        'A PDF must keep at least one page.'
      )
    })

    it('stamps watermarks across document pages', async () => {
      const file = await createSamplePdf(2)
      const watermarked = await browserDocumentProcessor.watermark(file, 'TOP SECRET')
      expect(watermarked.pageCount).toBe(2)
      expect(watermarked.blob.size).toBeGreaterThan(0)
    })

    it('adds automated sequential page numbers', async () => {
      const file = await createSamplePdf(3)
      const numbered = await browserDocumentProcessor.pageNumbers(file, 'bottom-center')
      expect(numbered.pageCount).toBe(3)
      expect(numbered.blob.size).toBeGreaterThan(0)
    })

    it('updates document metadata fields', async () => {
      const file = await createSamplePdf(2)
      const updated = await browserDocumentProcessor.metadata(file, {
        title: 'New Annual 2026',
        author: 'Chief Engineer',
        subject: 'Finance',
        keywords: 'q4, audit, 2026',
      })
      expect(updated.pageCount).toBe(2)
      expect(updated.blob.size).toBeGreaterThan(0)
    })

    it('digitally signs PDF with verification badge', async () => {
      const file = await createSamplePdf(2)
      const signed = await browserDocumentProcessor.sign(file, 'Gokula Krishnan')
      expect(signed.pageCount).toBe(2)
      expect(signed.fileName).toContain('signed')
      expect(signed.blob.size).toBeGreaterThan(0)
    })

    it('handles malformed / corrupt PDF gracefully', async () => {
      const badFile = new File(['NOT_A_REAL_PDF_DATA_STREAM'], 'corrupt.pdf', { type: 'application/pdf' })
      await expect(browserDocumentProcessor.inspect(badFile)).rejects.toThrow()
    })
  })
})
