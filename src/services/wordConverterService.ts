import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
} from 'docx'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ProcessedDocument } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface TextItemInfo {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontName: string
  hasEOL?: boolean
}

/**
 * Converts a PDF document into an editable Microsoft Word (.docx) file directly on-device.
 */
export async function pdfToDocx(file: File): Promise<ProcessedDocument> {
  const source = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: source }).promise
  const docxParagraphs: Paragraph[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const rawItems: TextItemInfo[] = []

    for (const item of textContent.items) {
      if ('str' in item && item.str) {
        const transform = item.transform
        const x = transform[4]
        const y = transform[5]
        const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]) || 12
        rawItems.push({
          str: item.str,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
          fontName: item.fontName || '',
          hasEOL: item.hasEOL,
        })
      }
    }

    if (rawItems.length === 0) {
      docxParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[Page ${pageNum}: No selectable text detected]`,
              italics: true,
              color: '888888',
            }),
          ],
          spacing: { after: 200 },
        })
      )
    } else {
      rawItems.sort((a, b) => {
        const yDiff = b.y - a.y
        if (Math.abs(yDiff) > 4) return yDiff
        return a.x - b.x
      })

      const lines: TextItemInfo[][] = []
      let currentLine: TextItemInfo[] = []
      let currentY: number | null = null

      for (const item of rawItems) {
        if (currentY === null || Math.abs(currentY - item.y) <= 4) {
          currentLine.push(item)
          currentY = item.y
        } else {
          lines.push(currentLine)
          currentLine = [item]
          currentY = item.y
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine)
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineText = line.map((item) => item.str).join(' ').trim()
        if (!lineText) continue

        const avgFontSize = line.reduce((acc, cur) => acc + cur.fontSize, 0) / line.length
        const isHeading = avgFontSize > 16 || (avgFontSize > 13 && lineText.length < 60 && !lineText.endsWith('.'))
        const isBold = line.some((item) => item.fontName.toLowerCase().includes('bold'))

        const runs: TextRun[] = line.map((item, idx) => {
          const itemText = item.str + (idx < line.length - 1 && !item.str.endsWith(' ') ? ' ' : '')
          return new TextRun({
            text: itemText,
            size: Math.round(item.fontSize * 2),
            bold: isBold || item.fontName.toLowerCase().includes('bold') || isHeading,
            italics: item.fontName.toLowerCase().includes('italic') || item.fontName.toLowerCase().includes('oblique'),
            font: 'Calibri',
          })
        })

        if (isHeading && avgFontSize > 18) {
          docxParagraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: runs,
              spacing: { before: 240, after: 120 },
            })
          )
        } else if (isHeading) {
          docxParagraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: runs,
              spacing: { before: 180, after: 80 },
            })
          )
        } else {
          docxParagraphs.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120, line: 276 },
            })
          )
        }
      }
    }

    if (pageNum < pdf.numPages) {
      docxParagraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      )
    }
  }

  const doc = new Document({
    title: file.name.replace(/\.pdf$/i, ''),
    creator: 'KnowTheFile On-Device Document Suite',
    description: 'Converted from PDF with KnowTheFile client-side processor.',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxParagraphs.length > 0 ? docxParagraphs : [
          new Paragraph({
            children: [new TextRun({ text: 'Converted Document', bold: true, size: 28 })],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const baseName = file.name.replace(/\.[^.]+$/, '')

  return {
    blob,
    fileName: `${baseName}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    inputBytes: file.size,
    outputBytes: blob.size,
    pageCount: pdf.numPages,
  }
}

interface ParsedDocxBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'bullet'
  text: string
  bold?: boolean
  italic?: boolean
}

/**
 * Converts a Microsoft Word (.docx) document into a standard PDF directly on-device.
 */
export async function docxToPdf(file: File): Promise<ProcessedDocument> {
  const source = await file.arrayBuffer()
  const blocks: ParsedDocxBlock[] = []

  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: source })
    const html = htmlResult.value

    if (html && html.trim()) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const elements = doc.body.children

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        const tag = el.tagName.toLowerCase()
        const text = el.textContent?.trim() || ''
        if (!text) continue

        if (tag === 'h1') {
          blocks.push({ type: 'h1', text, bold: true })
        } else if (tag === 'h2') {
          blocks.push({ type: 'h2', text, bold: true })
        } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
          blocks.push({ type: 'h3', text, bold: true })
        } else if (tag === 'ul' || tag === 'ol') {
          const items = el.querySelectorAll('li')
          items.forEach((li) => {
            const itemText = li.textContent?.trim()
            if (itemText) blocks.push({ type: 'bullet', text: itemText })
          })
        } else {
          const isBold = el.querySelector('strong, b') !== null
          const isItalic = el.querySelector('em, i') !== null
          blocks.push({ type: 'p', text, bold: isBold, italic: isItalic })
        }
      }
    }
  } catch (error) {
    console.warn('Mammoth HTML parse failed, falling back to raw text extraction:', error)
  }

  if (blocks.length === 0) {
    try {
      const rawResult = await mammoth.extractRawText({ arrayBuffer: source })
      const rawText = rawResult.value
      if (rawText && rawText.trim()) {
        const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        lines.forEach((line) => {
          if (line.length < 50 && !line.endsWith('.')) {
            blocks.push({ type: 'h2', text: line, bold: true })
          } else {
            blocks.push({ type: 'p', text: line })
          }
        })
      }
    } catch {
      try {
        const zip = await JSZip.loadAsync(source)
        const docXml = await zip.file('word/document.xml')?.async('text')
        if (docXml) {
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(docXml, 'application/xml')
          const pElements = xmlDoc.getElementsByTagName('w:p')
          for (let i = 0; i < pElements.length; i++) {
            const p = pElements[i]
            const textNodes = p.getElementsByTagName('w:t')
            let pText = ''
            for (let j = 0; j < textNodes.length; j++) {
              pText += textNodes[j].textContent || ''
            }
            pText = pText.trim()
            if (pText) {
              blocks.push({ type: 'p', text: pText })
            }
          }
        }
      } catch {
        throw new Error('Could not parse Word document. Please ensure the file is a valid .docx file.')
      }
    }
  }

  if (blocks.length === 0) {
    throw new Error('No readable text or content found in this Word document.')
  }

  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 54
  const contentWidth = pageWidth - margin * 2
  const bottomMargin = 54

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - margin

  const addPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    cursorY = pageHeight - margin
  }

  const wrapText = (text: string, font: typeof fontRegular, fontSize: number, maxWidth: number): string[] => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, fontSize)
      if (width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  for (const block of blocks) {
    let font = fontRegular
    let fontSize = 10.5
    let lineHeight = 15
    let spacingAfter = 8
    let textColor = rgb(0.12, 0.12, 0.12)
    let leftIndent = 0

    if (block.type === 'h1') {
      font = fontBold
      fontSize = 18
      lineHeight = 24
      spacingAfter = 14
      textColor = rgb(0.05, 0.05, 0.05)
    } else if (block.type === 'h2') {
      font = fontBold
      fontSize = 14
      lineHeight = 19
      spacingAfter = 10
      textColor = rgb(0.1, 0.1, 0.1)
    } else if (block.type === 'h3') {
      font = fontBold
      fontSize = 12
      lineHeight = 16
      spacingAfter = 8
      textColor = rgb(0.15, 0.15, 0.15)
    } else if (block.type === 'bullet') {
      leftIndent = 16
      if (block.bold) font = fontBold
      else if (block.italic) font = fontItalic
    } else {
      if (block.bold) font = fontBold
      else if (block.italic) font = fontItalic
    }

    const availableWidth = contentWidth - leftIndent
    const lines = wrapText(block.text, font, fontSize, availableWidth)

    const totalBlockHeight = lines.length * lineHeight + spacingAfter
    if (cursorY - totalBlockHeight < bottomMargin && cursorY < pageHeight - margin - 50) {
      addPage()
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (cursorY - lineHeight < bottomMargin) {
        addPage()
      }

      if (block.type === 'bullet' && i === 0) {
        currentPage.drawText('•', {
          x: margin + 4,
          y: cursorY - fontSize,
          size: fontSize,
          font: fontBold,
          color: rgb(1, 0.65, 0),
        })
      }

      currentPage.drawText(line, {
        x: margin + leftIndent,
        y: cursorY - fontSize,
        size: fontSize,
        font,
        color: textColor,
      })

      cursorY -= lineHeight
    }

    cursorY -= spacingAfter
  }

  const totalPages = pdfDoc.getPageCount()
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i)
    const pageNum = i + 1

    p.drawRectangle({
      x: margin,
      y: pageHeight - 24,
      width: contentWidth,
      height: 1.5,
      color: rgb(1, 0.82, 0.1),
    })

    p.drawText('KnowTheFile · On-Device Document Processor', {
      x: margin,
      y: pageHeight - 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    })

    const pageText = `Page ${pageNum} of ${totalPages}`
    const pageTextWidth = fontRegular.widthOfTextAtSize(pageText, 9)
    p.drawText(pageText, {
      x: pageWidth - margin - pageTextWidth,
      y: 24,
      size: 9,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.45),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const baseName = file.name.replace(/\.[^.]+$/, '')

  return {
    blob,
    fileName: `${baseName}.pdf`,
    mimeType: 'application/pdf',
    inputBytes: file.size,
    outputBytes: blob.size,
    pageCount: totalPages,
  }
}
