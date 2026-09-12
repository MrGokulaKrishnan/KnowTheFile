import { describe, it, expect } from 'vitest'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { docxToPdf } from '../src/services/wordConverterService'

async function createSampleDocx(): Promise<File> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'KnowTheFile Document Conversion', bold: true, size: 32 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Testing client-side DOCX to PDF vector rendering pipeline.' }),
            ],
          }),
        ],
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  return new File([blob], 'sample.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

describe('Word Document Converter Suite', () => {
  it('converts valid .docx file into standardized vector PDF', async () => {
    const docxFile = await createSampleDocx()
    const result = await docxToPdf(docxFile)

    expect(result.mimeType).toBe('application/pdf')
    expect(result.fileName).toBe('sample.pdf')
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  })

  it('rejects corrupt Word files with clean error message', async () => {
    const badDocx = new File(['CORRUPT_WORD_BYTES'], 'bad.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    await expect(docxToPdf(badDocx)).rejects.toThrow()
  })
})
