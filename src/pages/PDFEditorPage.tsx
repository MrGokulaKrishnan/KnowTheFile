import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { Link } from 'react-router-dom'
import { FileUploader } from '../components/upload/FileUploader'
import { useToast } from '../components/common/Toast'
import {
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  TrashIcon,
  EditorIcon,
  WordIcon,
  CheckIcon,
} from '../components/common/Icons'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export interface EditorElement {
  id: number
  page: number
  type: 'text' | 'whiteout'
  x: number // percentage 0 to 100
  y: number // percentage 0 to 100
  width: number // percentage 0 to 100
  height: number // percentage 0 to 100
  text: string
  fontSize: number
  fontFamily: 'Helvetica' | 'HelveticaBold' | 'Times' | 'Courier'
  color: string
  backgroundColor: string
  bold: boolean
  italic: boolean
}

export interface DetectedTextSnippet {
  id: string
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

const COLOR_PRESETS = [
  { label: 'Black', value: '#000000' },
  { label: 'Gold', value: '#ffd21a' },
  { label: 'White', value: '#ffffff' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
]

const BG_PRESETS = [
  { label: 'None', value: 'transparent' },
  { label: 'Whiteout', value: '#ffffff' },
  { label: 'Redact (Black)', value: '#000000' },
  { label: 'Highlight', value: 'rgba(254, 240, 138, 0.65)' },
]

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (hex.startsWith('rgba') || hex === 'transparent') {
    return { r: 1, g: 1, b: 1 }
  }
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255
    const g = parseInt(clean[1] + clean[1], 16) / 255
    const b = parseInt(clean[2] + clean[2], 16) / 255
    return { r, g, b }
  }
  const num = parseInt(clean, 16)
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function PDFEditorPage({ defaultMode = 'word' }: { defaultMode?: 'word' | 'canvas' }) {
  const toast = useToast()
  const [activeMode, setActiveMode] = useState<'word' | 'canvas'>(defaultMode)
  const [files, setFiles] = useState<File[]>([])
  const [pageCount, setPageCount] = useState(0)
  const [activePage, setActivePage] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [toolMode, setToolMode] = useState<'select' | 'text' | 'whiteout'>('text')
  const [elements, setElements] = useState<EditorElement[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 })

  // Solution B: In-place text snippets
  const [detectedSnippets, setDetectedSnippets] = useState<DetectedTextSnippet[]>([])
  const [hoveredSnippetId, setHoveredSnippetId] = useState<string | null>(null)

  // Solution A: Word Document Mode State
  const [wordHtml, setWordHtml] = useState<string>('')
  const [isExtractingWord, setIsExtractingWord] = useState(false)
  const wordEditorRef = useRef<HTMLDivElement | null>(null)

  // Draft state for new text tools
  const [draftText, setDraftText] = useState('Edited Text')
  const [draftSize, setDraftSize] = useState(16)
  const [draftColor, setDraftColor] = useState('#000000')
  const draftBg = '#ffffff'
  const [draftFont, setDraftFont] = useState<'Helvetica' | 'HelveticaBold' | 'Times' | 'Courier'>('HelveticaBold')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const file = files[0]

  // Reset scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  // Sync defaultMode if changed from props
  useEffect(() => {
    if (defaultMode) setActiveMode(defaultMode)
  }, [defaultMode])

  // Load PDF into PDF.js document proxy and extract Word structure
  useEffect(() => {
    if (!file) {
      setPageCount(0)
      setActivePage(0)
      setElements([])
      setSelectedId(null)
      setPdfDocProxy(null)
      setWordHtml('')
      setDetectedSnippets([])
      return
    }

    let isSubscribed = true

    void (async () => {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        if (!isSubscribed) return

        setPdfDocProxy(pdf)
        setPageCount(pdf.numPages)
        setActivePage(0)

        // Extract Word Mode HTML structure
        setIsExtractingWord(true)
        const htmlParts: string[] = []

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p)
          const textContent = await page.getTextContent()

          // Group by vertical position (Y)
          const lineMap = new Map<number, { text: string; fontSize: number; isBold: boolean }[]>()

          for (const item of textContent.items) {
            if ('str' in item && item.str.trim()) {
              const y = Math.round(item.transform[5] / 5) * 5
              const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]) || 12
              const isBold = (item.fontName || '').toLowerCase().includes('bold')

              if (!lineMap.has(y)) lineMap.set(y, [])
              lineMap.get(y)!.push({ text: item.str, fontSize, isBold })
            }
          }

          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)

          for (const y of sortedYs) {
            const lineItems = lineMap.get(y)!
            const lineText = lineItems.map((i) => i.text).join(' ').trim()
            if (!lineText) continue

            const maxFontSize = Math.max(...lineItems.map((i) => i.fontSize))
            const isBold = lineItems.some((i) => i.isBold)

            if (maxFontSize >= 20) {
              htmlParts.push(`<h1>${escapeHtml(lineText)}</h1>`)
            } else if (maxFontSize >= 15) {
              htmlParts.push(`<h2>${escapeHtml(lineText)}</h2>`)
            } else if (maxFontSize >= 13) {
              htmlParts.push(`<h3>${escapeHtml(lineText)}</h3>`)
            } else if (lineText.startsWith('•') || lineText.startsWith('-')) {
              htmlParts.push(`<ul><li>${escapeHtml(lineText.replace(/^[•\-]\s*/, ''))}</li></ul>`)
            } else {
              htmlParts.push(`<p>${isBold ? `<strong>${escapeHtml(lineText)}</strong>` : escapeHtml(lineText)}</p>`)
            }
          }

          if (p < pdf.numPages) {
            htmlParts.push('<div class="page-break-divider"><span>--- Page Break ---</span></div>')
          }
        }

        const initialHtml = htmlParts.join('\n') || '<p>Start typing or pasting your document content here...</p>'
        if (isSubscribed) {
          setWordHtml(initialHtml)
          setIsExtractingWord(false)
        }
      } catch (error) {
        toast.show(error instanceof Error ? error.message : 'Could not load this PDF document.', 'error')
        if (isSubscribed) setIsExtractingWord(false)
      }
    })()

    return () => {
      isSubscribed = false
    }
  }, [file, toast])

  // Render current page onto HTML5 canvas & extract in-place text snippets
  useEffect(() => {
    if (!pdfDocProxy || !canvasRef.current) return

    let isCurrent = true
    setIsRendering(true)

    void (async () => {
      try {
        const page = await pdfDocProxy.getPage(activePage + 1)
        const unscaledViewport = page.getViewport({ scale: 1 })
        if (isCurrent) {
          setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height })
        }

        // Render at 2x resolution for retina-crispness
        const renderScale = 2.0
        const viewport = page.getViewport({ scale: renderScale })

        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height

        const context = canvas.getContext('2d')
        if (!context) return

        await page.render({ canvas, canvasContext: context, viewport }).promise

        // Extract in-place clickable text snippets for Solution B
        const textContent = await page.getTextContent()
        const snippets: DetectedTextSnippet[] = []

        for (let i = 0; i < textContent.items.length; i++) {
          const item = textContent.items[i]
          if ('str' in item && item.str.trim()) {
            const tx = item.transform
            const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) || 12
            const x = (tx[4] / unscaledViewport.width) * 100
            const y = ((unscaledViewport.height - tx[5] - fontSize) / unscaledViewport.height) * 100
            const width = ((item.width || (item.str.length * fontSize * 0.55)) / unscaledViewport.width) * 100
            const height = (fontSize / unscaledViewport.height) * 100 * 1.35

            snippets.push({
              id: `snippet-${activePage}-${i}`,
              str: item.str,
              x: Math.max(0, Math.min(95, x)),
              y: Math.max(0, Math.min(95, y)),
              width: Math.max(2, Math.min(98, width)),
              height: Math.max(2, Math.min(20, height)),
              fontSize,
            })
          }
        }

        if (isCurrent) {
          setDetectedSnippets(snippets)
          setIsRendering(false)
        }
      } catch (error) {
        console.error('PDF render error:', error)
        if (isCurrent) setIsRendering(false)
      }
    })()

    return () => {
      isCurrent = false
    }
  }, [pdfDocProxy, activePage])

  // In Solution B: Click an existing text snippet on the PDF to edit in-place
  const handleEditExistingSnippet = (snippet: DetectedTextSnippet) => {
    // Check if snippet is already an active element
    const existing = elements.find(
      (el) => el.page === activePage && Math.abs(el.x - snippet.x) < 3 && Math.abs(el.y - snippet.y) < 3
    )
    if (existing) {
      setSelectedId(existing.id)
      return
    }

    const newId = Date.now()
    const newElement: EditorElement = {
      id: newId,
      page: activePage,
      type: 'text',
      x: snippet.x,
      y: snippet.y,
      width: Math.max(snippet.width + 2, 16),
      height: Math.max(snippet.height, 4),
      text: snippet.str,
      fontSize: Math.round(snippet.fontSize) || 14,
      fontFamily: 'HelveticaBold',
      color: '#000000',
      backgroundColor: '#ffffff', // Clean whiteout masks original text underneath!
      bold: true,
      italic: false,
    }

    setElements((prev) => [...prev, newElement])
    setSelectedId(newId)
    toast.show(`Editing in-place: "${snippet.str.slice(0, 30)}"`, 'success')
  }

  // Click on stage to place a text box or whiteout
  const handleStageClick = (e: MouseEvent<HTMLDivElement>) => {
    if (toolMode === 'select') return
    if (!stageRef.current) return

    if ((e.target as HTMLElement).closest('.editor-element-box')) return
    if ((e.target as HTMLElement).closest('.pdf-text-snippet')) return

    const rect = stageRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    const clickY = ((e.clientY - rect.top) / rect.height) * 100

    const newId = Date.now()
    const newElement: EditorElement = {
      id: newId,
      page: activePage,
      type: toolMode === 'whiteout' ? 'whiteout' : 'text',
      x: Math.max(1, Math.min(90, Math.round(clickX))),
      y: Math.max(1, Math.min(90, Math.round(clickY))),
      width: toolMode === 'whiteout' ? 24 : 30,
      height: toolMode === 'whiteout' ? 5 : 6,
      text: toolMode === 'whiteout' ? '' : (draftText.trim() || 'New Text'),
      fontSize: draftSize,
      fontFamily: draftFont,
      color: draftColor,
      backgroundColor: toolMode === 'whiteout' ? '#ffffff' : draftBg,
      bold: draftFont === 'HelveticaBold',
      italic: false,
    }

    setElements((prev) => [...prev, newElement])
    setSelectedId(newId)
    toast.show(toolMode === 'whiteout' ? 'Whiteout placed. Drag to position.' : 'Text added. Edit in inspector.', 'success')
  }

  // Pointer drag for re-positioning overlays
  const handleElementMouseDown = (e: MouseEvent, id: number) => {
    e.stopPropagation()
    setSelectedId(id)
    const el = elements.find((item) => item.id === id)
    if (!el) return

    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    }

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!dragRef.current || !stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      const deltaXPercent = ((moveEvent.clientX - dragRef.current.startX) / rect.width) * 100
      const deltaYPercent = ((moveEvent.clientY - dragRef.current.startY) / rect.height) * 100

      const newX = Math.max(0, Math.min(95, dragRef.current.origX + deltaXPercent))
      const newY = Math.max(0, Math.min(95, dragRef.current.origY + deltaYPercent))

      setElements((prev) =>
        prev.map((item) => (item.id === dragRef.current?.id ? { ...item, x: newX, y: newY } : item))
      )
    }

    const handleMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const updateSelected = (field: keyof EditorElement, value: string | number | boolean) => {
    if (selectedId === null) return
    setElements((prev) =>
      prev.map((item) => (item.id === selectedId ? { ...item, [field]: value } : item))
    )
  }

  const removeSelected = (idToRemove?: number) => {
    const target = idToRemove ?? selectedId
    if (target === null) return
    setElements((prev) => prev.filter((item) => item.id !== target))
    if (selectedId === target) setSelectedId(null)
  }

  // Delete page from active document
  const deletePage = async (pageIndexToDelete: number) => {
    if (!file || pageCount <= 1) {
      toast.show('A PDF document must keep at least one page.', 'error')
      return
    }

    try {
      const bytes = await file.arrayBuffer()
      const pdf = await PDFDocument.load(bytes)
      if (pageIndexToDelete < 0 || pageIndexToDelete >= pdf.getPageCount()) return

      pdf.removePage(pageIndexToDelete)
      const outBytes = await pdf.save()
      const newFile = new File([outBytes], file.name, { type: 'application/pdf' })

      setElements((prev) =>
        prev
          .filter((el) => el.page !== pageIndexToDelete)
          .map((el) => (el.page > pageIndexToDelete ? { ...el, page: el.page - 1 } : el))
      )
      setSelectedId(null)

      const nextActive = pageIndexToDelete >= pageCount - 1 ? Math.max(0, pageCount - 2) : pageIndexToDelete
      setActivePage(nextActive)
      setFiles([newFile])
      toast.show(`Page ${pageIndexToDelete + 1} deleted.`, 'success')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not delete this page.', 'error')
    }
  }

  // Export edited PDF in Canvas Mode via pdf-lib
  const exportCanvasPdf = async () => {
    if (!file) return
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await PDFDocument.load(bytes)

      const fontHelv = await pdf.embedFont(StandardFonts.Helvetica)
      const fontHelvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
      const fontTimes = await pdf.embedFont(StandardFonts.TimesRoman)
      const fontCourier = await pdf.embedFont(StandardFonts.Courier)

      const getFont = (f: EditorElement['fontFamily']) => {
        if (f === 'HelveticaBold') return fontHelvBold
        if (f === 'Times') return fontTimes
        if (f === 'Courier') return fontCourier
        return fontHelv
      }

      for (const el of elements) {
        if (el.page >= pdf.getPageCount()) continue
        const page = pdf.getPage(el.page)
        const { width: pWidth, height: pHeight } = page.getSize()

        const pdfX = (el.x / 100) * pWidth
        const pdfY = pHeight - ((el.y / 100) * pHeight) - (el.fontSize * 1.1)
        const boxWidth = (el.width / 100) * pWidth
        const boxHeight = (el.height / 100) * pHeight

        if (el.backgroundColor && el.backgroundColor !== 'transparent') {
          const bgRgb = hexToRgb(el.backgroundColor)
          const rectY = pHeight - ((el.y / 100) * pHeight) - boxHeight
          page.drawRectangle({
            x: pdfX,
            y: Math.max(0, rectY),
            width: Math.max(10, boxWidth),
            height: Math.max(10, boxHeight),
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          })
        }

        if (el.text && el.text.trim()) {
          const textRgb = hexToRgb(el.color)
          const chosenFont = getFont(el.fontFamily)
          page.drawText(el.text, {
            x: pdfX + 2,
            y: Math.max(0, pdfY),
            size: el.fontSize,
            font: chosenFont,
            color: rgb(textRgb.r, textRgb.g, textRgb.b),
          })
        }
      }

      const outBytes = await pdf.save()
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.show('Edited PDF has been exported successfully.', 'success')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not export this PDF.', 'error')
    }
  }

  // Solution A (Word Mode): Format text using standard document commands
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value)
    if (wordEditorRef.current) {
      setWordHtml(wordEditorRef.current.innerHTML)
    }
  }

  // Solution A: Export Word Document to PDF via pdf-lib
  const exportWordToPdf = async () => {
    const editorEl = wordEditorRef.current
    if (!editorEl) return
    const currentHtml = editorEl.innerHTML

    try {
      const pdfDoc = await PDFDocument.create()
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

      const pageWidth = 595.28 // A4 width
      const pageHeight = 841.89 // A4 height
      const margin = 54
      const contentWidth = pageWidth - margin * 2
      const bottomMargin = 54

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      let cursorY = pageHeight - margin

      const parser = new DOMParser()
      const doc = parser.parseFromString(currentHtml, 'text/html')
      const elementsList = Array.from(doc.body.children)

      const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
        const words = text.split(/\s+/)
        const lines: string[] = []
        let currentLine = ''

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const width = font.widthOfTextAtSize(testLine, size)
          if (width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)
        return lines
      }

      const checkPageBreak = (neededHeight: number) => {
        if (cursorY - neededHeight < bottomMargin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight])
          cursorY = pageHeight - margin
        }
      }

      const itemsToProcess = elementsList.length > 0 ? elementsList : [doc.body]

      for (const el of itemsToProcess) {
        const tag = el.tagName.toLowerCase()
        const rawText = el.textContent?.trim() || ''

        if (el.classList.contains('page-break-divider') || tag === 'hr') {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight])
          cursorY = pageHeight - margin
          continue
        }

        if (!rawText && tag === 'p') {
          cursorY -= 12
          continue
        }

        let fontSize = 11
        let font = fontRegular
        let lineHeight = 16
        let spacingAfter = 8

        if (tag === 'h1') {
          fontSize = 20
          font = fontBold
          lineHeight = 26
          spacingAfter = 14
        } else if (tag === 'h2') {
          fontSize = 16
          font = fontBold
          lineHeight = 22
          spacingAfter = 10
        } else if (tag === 'h3') {
          fontSize = 13
          font = fontBold
          lineHeight = 18
          spacingAfter = 8
        } else if (tag === 'ul' || tag === 'ol') {
          const lis = el.querySelectorAll('li')
          lis.forEach((li, index) => {
            const liText = li.textContent?.trim() || ''
            if (!liText) return
            const bullet = tag === 'ol' ? `${index + 1}. ` : '• '
            const lines = wrapText(liText, fontRegular, 11, contentWidth - 20)
            checkPageBreak(lines.length * 16 + 6)
            lines.forEach((line, idx) => {
              currentPage.drawText(idx === 0 ? `${bullet}${line}` : `   ${line}`, {
                x: margin + 12,
                y: cursorY - 11,
                size: 11,
                font: fontRegular,
                color: rgb(0.1, 0.1, 0.1),
              })
              cursorY -= 16
            })
            cursorY -= 4
          })
          cursorY -= 6
          continue
        } else {
          const isBold = el.querySelector('strong, b') !== null || (el as HTMLElement).style.fontWeight === 'bold'
          const isItalic = el.querySelector('em, i') !== null || (el as HTMLElement).style.fontStyle === 'italic'
          font = isBold ? fontBold : isItalic ? fontItalic : fontRegular
        }

        const lines = wrapText(rawText, font, fontSize, contentWidth)
        checkPageBreak(lines.length * lineHeight + spacingAfter)

        for (const line of lines) {
          currentPage.drawText(line, {
            x: margin,
            y: cursorY - fontSize,
            size: fontSize,
            font,
            color: rgb(0.1, 0.1, 0.1),
          })
          cursorY -= lineHeight
        }
        cursorY -= spacingAfter
      }

      const bytes = await pdfDoc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file?.name?.replace(/\.[^/.]+$/, '') || 'document'}-word-edited.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.show('Word-edited document exported as PDF!', 'success')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not export to PDF.', 'error')
    }
  }

  // Solution A: Export Word Document to Native Word (.docx) via docx
  const exportWordToDocx = async () => {
    const editorEl = wordEditorRef.current
    if (!editorEl) return
    const currentHtml = editorEl.innerHTML

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(currentHtml, 'text/html')
      const paragraphs: Paragraph[] = []
      const elementsList = Array.from(doc.body.children)
      const items = elementsList.length > 0 ? elementsList : [doc.body]

      for (const el of items) {
        const tag = el.tagName.toLowerCase()
        const text = el.textContent || ''
        if (!text.trim() && tag === 'p') continue

        if (tag === 'h1') {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: text.trim(), bold: true, size: 36 })],
              spacing: { before: 240, after: 120 },
            })
          )
        } else if (tag === 'h2') {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: text.trim(), bold: true, size: 28 })],
              spacing: { before: 200, after: 100 },
            })
          )
        } else if (tag === 'h3') {
          paragraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun({ text: text.trim(), bold: true, size: 24 })],
              spacing: { before: 160, after: 80 },
            })
          )
        } else if (tag === 'ul' || tag === 'ol') {
          const lis = el.querySelectorAll('li')
          lis.forEach((li) => {
            paragraphs.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: li.textContent || '', size: 22 })],
                spacing: { before: 40, after: 40 },
              })
            )
          })
        } else {
          const runs: TextRun[] = []
          if (el.childNodes.length > 0) {
            el.childNodes.forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent) runs.push(new TextRun({ text: node.textContent, size: 22 }))
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const childEl = node as HTMLElement
                const childTag = childEl.tagName.toLowerCase()
                const isBold = childTag === 'strong' || childTag === 'b' || childEl.style.fontWeight === 'bold'
                const isItalic = childTag === 'em' || childTag === 'i' || childEl.style.fontStyle === 'italic'
                const isUnderline = childTag === 'u' || childEl.style.textDecoration?.includes('underline')
                runs.push(
                  new TextRun({
                    text: childEl.textContent || '',
                    bold: isBold,
                    italics: isItalic,
                    underline: isUnderline ? {} : undefined,
                    size: 22,
                  })
                )
              }
            })
          } else {
            runs.push(new TextRun({ text, size: 22 }))
          }

          paragraphs.push(
            new Paragraph({
              children: runs.length > 0 ? runs : [new TextRun({ text, size: 22 })],
              spacing: { before: 60, after: 100 },
            })
          )
        }
      }

      if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'Edited Document', size: 22 })] }))
      }

      const docxDoc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      })

      const blob = await Packer.toBlob(docxDoc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file?.name?.replace(/\.[^/.]+$/, '') || 'document'}-edited.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.show('Word document (.docx) exported successfully!', 'success')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not export to Word DOCX.', 'error')
    }
  }

  const selectedElement = elements.find((item) => item.id === selectedId)
  const visibleElements = elements.filter((item) => item.page === activePage)

  return (
    <div className="editor-page">
      {/* Top Header & Mode Switcher */}
      <header className="editor-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/tools" className="back-link" style={{ margin: 0 }}>
            ← Back to Tools
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EditorIcon size={20} color="#ffd21a" />
            <strong style={{ letterSpacing: '-0.02em', fontSize: '15px' }}>PDF Studio Workspace</strong>
          </div>
        </div>

        {/* Studio Mode Selector (Solution A vs Solution B) */}
        <div className="studio-mode-toggle" role="tablist" aria-label="Editor Modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'word'}
            className={`mode-btn ${activeMode === 'word' ? 'active' : ''}`}
            onClick={() => setActiveMode('word')}
          >
            <WordIcon size={15} />
            <span>Word Document Mode (Reflow & Edit)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'canvas'}
            className={`mode-btn ${activeMode === 'canvas' ? 'active' : ''}`}
            onClick={() => setActiveMode('canvas')}
          >
            <EditorIcon size={15} />
            <span>Direct PDF Click & Edit Mode</span>
          </button>
        </div>

        {/* Global Export & Zoom Actions */}
        <div className="editor-toolbar-actions">
          {activeMode === 'canvas' ? (
            <>
              <button
                type="button"
                className="icon-btn"
                disabled={!file}
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                aria-label="Zoom out"
              >
                <ZoomOutIcon size={18} />
              </button>
              <span>{zoom}%</span>
              <button
                type="button"
                className="icon-btn"
                disabled={!file}
                onClick={() => setZoom((z) => Math.min(200, z + 15))}
                aria-label="Zoom in"
              >
                <ZoomInIcon size={18} />
              </button>
              {file && pageCount > 1 && (
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ minHeight: '36px', padding: '0 12px', fontSize: '11px', color: '#fb7185', borderColor: 'rgba(251,113,133,0.3)' }}
                  onClick={() => void deletePage(activePage)}
                  title={`Delete Page ${activePage + 1}`}
                >
                  <TrashIcon size={14} />
                  <span>Delete Page {activePage + 1}</span>
                </button>
              )}
              <button
                type="button"
                className="button button-primary"
                disabled={!file}
                onClick={() => void exportCanvasPdf()}
              >
                <DownloadIcon size={16} />
                <span>Export PDF</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="button button-ghost"
                disabled={!file}
                onClick={() => void exportWordToDocx()}
              >
                <WordIcon size={16} color="#ffd21a" />
                <span>Export Word (.docx)</span>
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!file}
                onClick={() => void exportWordToPdf()}
              >
                <DownloadIcon size={16} />
                <span>Export PDF</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {!file ? (
        <div className="editor-empty">
          <p className="eyebrow">BROWSER-ACCELERATED STUDIO</p>
          <h1>
            {activeMode === 'word'
              ? 'Word-Style PDF Document Editor'
              : 'Direct In-Place PDF Canvas Editor'}
          </h1>
          <p style={{ maxWidth: '640px', margin: '0 auto 28px' }}>
            {activeMode === 'word'
              ? 'Edit document text with full word reflow, paragraph headings, formatting toolbar, and type/backspace just like Microsoft Word. Download as PDF or Word DOCX with 100% on-device privacy.'
              : 'Click directly on any existing text in your PDF to edit it in place, wipe old text cleanly, add annotations, or stamp signatures with zero server uploads.'}
          </p>
          <FileUploader accept="application/pdf,.pdf,.docx" files={files} onFiles={setFiles} />
        </div>
      ) : activeMode === 'word' ? (
        /* =========================================================================
           SOLUTION A: FULL WORD PROCESSOR / DOCUMENT REFLOW EDITOR
           ========================================================================= */
        <div className="word-editor-shell">
          {/* Word Formatting Ribbon Toolbar */}
          <div className="word-toolbar">
            <div className="word-toolbar-group">
              <select
                onChange={(e) => {
                  const val = e.target.value
                  if (val.startsWith('h')) applyFormat('formatBlock', `<${val}>`)
                  else if (val === 'p') applyFormat('formatBlock', '<p>')
                  else if (val === 'ul') applyFormat('insertUnorderedList')
                  else if (val === 'ol') applyFormat('insertOrderedList')
                }}
                className="word-select"
                title="Style"
              >
                <option value="p">Normal Text</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="ul">Bulleted List</option>
                <option value="ol">Numbered List</option>
              </select>

              <select
                onChange={(e) => applyFormat('fontName', e.target.value)}
                className="word-select"
                title="Font Family"
              >
                <option value="Inter, sans-serif">Sans-Serif (Modern)</option>
                <option value="Georgia, serif">Serif (Editorial)</option>
                <option value="'Courier New', monospace">Monospace (Code)</option>
              </select>

              <select
                onChange={(e) => applyFormat('fontSize', e.target.value)}
                className="word-select"
                title="Font Size"
              >
                <option value="3">12 pt (Normal)</option>
                <option value="4">14 pt (Medium)</option>
                <option value="5">18 pt (Large)</option>
                <option value="6">24 pt (X-Large)</option>
                <option value="7">36 pt (Title)</option>
              </select>
            </div>

            <div className="word-toolbar-divider" />

            <div className="word-toolbar-group">
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('bold')}
                title="Bold (Ctrl+B)"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('italic')}
                title="Italic (Ctrl+I)"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('underline')}
                title="Underline (Ctrl+U)"
              >
                <u>U</u>
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('strikeThrough')}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
            </div>

            <div className="word-toolbar-divider" />

            <div className="word-toolbar-group">
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('justifyLeft')}
                title="Align Left"
              >
                ≡
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('justifyCenter')}
                title="Align Center"
              >
                ⫸⫷
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('justifyRight')}
                title="Align Right"
              >
                ⫸
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('insertUnorderedList')}
                title="Bullet List"
              >
                • List
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('insertOrderedList')}
                title="Numbered List"
              >
                1. List
              </button>
            </div>

            <div className="word-toolbar-divider" />

            <div className="word-toolbar-group">
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('foreColor', '#ffd21a')}
                title="Gold Text"
                style={{ color: '#ffd21a' }}
              >
                A
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('foreColor', '#000000')}
                title="Black Text"
                style={{ color: '#000000', background: '#e5e5e5' }}
              >
                A
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('hiliteColor', '#fef08a')}
                title="Highlight Yellow"
                style={{ background: '#fef08a', color: '#000000' }}
              >
                🖍
              </button>
              <button
                type="button"
                className="word-tool-btn"
                onClick={() => applyFormat('removeFormat')}
                title="Clear Formatting"
              >
                🧹
              </button>
            </div>
          </div>

          {/* Word Canvas Page Sheet */}
          <div className="word-canvas-wrapper">
            <div className="word-paper-sheet">
              {isExtractingWord ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ffd21a' }}>
                  <p>Extracting flowing document paragraphs on-device…</p>
                </div>
              ) : (
                <div
                  ref={wordEditorRef}
                  className="word-editable-content"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: wordHtml }}
                  onBlur={(e) => setWordHtml(e.currentTarget.innerHTML)}
                  spellCheck
                  aria-label="Word document editable body"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           SOLUTION B: IN-PLACE DIRECT PDF CANVAS CLICK & EDIT
           ========================================================================= */
        <div className="editor-layout">
          {/* Page Thumbnail Sidebar */}
          <aside className="thumbnail-sidebar">
            <p className="eyebrow">PAGES ({pageCount})</p>
            {Array.from({ length: pageCount }, (_, index) => (
              <div key={index} style={{ position: 'relative', width: '100%', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`page-thumb ${activePage === index ? 'selected' : ''}`}
                  style={{ width: '100%' }}
                  onClick={() => {
                    setActivePage(index)
                    setSelectedId(null)
                  }}
                >
                  <span>{index + 1}</span>
                  <small>Page {index + 1}</small>
                </button>
                {pageCount > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deletePage(index)
                    }}
                    title={`Delete Page ${index + 1}`}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#fb7185',
                      borderRadius: '6px',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      zIndex: 2,
                    }}
                  >
                    <TrashIcon size={12} />
                  </button>
                )}
              </div>
            ))}
          </aside>

          {/* Interactive Document Stage */}
          <section className="editor-canvas-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', maxWidth: '820px', margin: '0 auto 14px' }}>
              <div className="pill-badge" style={{ margin: 0, fontSize: '11px' }}>
                <span>💡 Click any existing text in the PDF to edit it in-place</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`button ${toolMode === 'text' ? 'button-primary' : 'button-ghost'}`}
                  style={{ minHeight: '32px', padding: '0 12px', fontSize: '11px' }}
                  onClick={() => setToolMode('text')}
                >
                  <span>+ Add Text</span>
                </button>
                <button
                  type="button"
                  className={`button ${toolMode === 'whiteout' ? 'button-primary' : 'button-ghost'}`}
                  style={{ minHeight: '32px', padding: '0 12px', fontSize: '11px' }}
                  onClick={() => setToolMode('whiteout')}
                >
                  <span>⬜ Whiteout</span>
                </button>
                <button
                  type="button"
                  className={`button ${toolMode === 'select' ? 'button-primary' : 'button-ghost'}`}
                  style={{ minHeight: '32px', padding: '0 12px', fontSize: '11px' }}
                  onClick={() => setToolMode('select')}
                >
                  <span>✋ Select</span>
                </button>
              </div>
            </div>

            <div
              className="canvas-stage"
              ref={stageRef}
              onClick={handleStageClick}
              style={{
                width: `${(pageDimensions.width * zoom) / 100}px`,
                height: `${(pageDimensions.height * zoom) / 100}px`,
                cursor: toolMode === 'select' ? 'default' : 'crosshair',
                position: 'relative',
                background: '#ffffff',
                boxShadow: '0 20px 50px rgba(0,0,0,0.95)',
                margin: '0 auto',
                overflow: 'hidden',
                borderRadius: '4px',
              }}
            >
              {/* High-DPI Real PDF Render Canvas */}
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />

              {isRendering && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffd21a',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  Rendering Page {activePage + 1}…
                </div>
              )}

              {/* Solution B: In-Place Text Detection Layer */}
              <div className="pdf-detected-text-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
                {detectedSnippets.map((snippet) => {
                  const isHovered = hoveredSnippetId === snippet.id
                  return (
                    <div
                      key={snippet.id}
                      className={`pdf-text-snippet ${isHovered ? 'hovered' : ''}`}
                      style={{
                        position: 'absolute',
                        left: `${snippet.x}%`,
                        top: `${snippet.y}%`,
                        width: `${snippet.width}%`,
                        height: `${snippet.height}%`,
                        border: isHovered ? '1px dashed #ffd21a' : '1px solid transparent',
                        background: isHovered ? 'rgba(255, 210, 26, 0.15)' : 'transparent',
                        cursor: 'text',
                        borderRadius: '2px',
                        zIndex: 3,
                      }}
                      title={`Click to edit: "${snippet.str}"`}
                      onMouseEnter={() => setHoveredSnippetId(snippet.id)}
                      onMouseLeave={() => setHoveredSnippetId(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditExistingSnippet(snippet)
                      }}
                    />
                  )
                })}
              </div>

              {/* Interactive Overlays Layer */}
              <div className="canvas-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
                {visibleElements.map((element) => {
                  const isSelected = element.id === selectedId
                  return (
                    <div
                      key={element.id}
                      className="editor-element-box"
                      onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                      style={{
                        position: 'absolute',
                        left: `${element.x}%`,
                        top: `${element.y}%`,
                        minWidth: element.type === 'whiteout' ? `${element.width}%` : 'auto',
                        minHeight: element.type === 'whiteout' ? `${element.height}%` : 'auto',
                        fontSize: `${(element.fontSize * zoom) / 100}px`,
                        fontFamily:
                          element.fontFamily === 'Times'
                            ? 'serif'
                            : element.fontFamily === 'Courier'
                            ? 'monospace'
                            : 'sans-serif',
                        fontWeight: element.bold || element.fontFamily === 'HelveticaBold' ? 'bold' : 'normal',
                        color: element.color,
                        backgroundColor: element.backgroundColor,
                        padding: element.type === 'whiteout' ? '4px' : '2px 6px',
                        border: isSelected
                          ? '2px solid #ffd21a'
                          : '1px dashed rgba(255, 170, 0, 0.6)',
                        boxShadow: isSelected ? '0 0 10px rgba(255, 210, 26, 0.5)' : 'none',
                        cursor: 'move',
                        userSelect: 'none',
                        zIndex: isSelected ? 10 : 4,
                        borderRadius: '2px',
                        whiteSpace: 'pre',
                      }}
                    >
                      {element.type === 'whiteout' && !element.text ? (
                        <span style={{ fontSize: '10px', color: '#999', userSelect: 'none', opacity: 0.7 }}>
                          [Whiteout Box]
                        </span>
                      ) : (
                        element.text
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
              <button
                type="button"
                className="button button-ghost"
                disabled={activePage === 0}
                onClick={() => {
                  setActivePage((p) => Math.max(0, p - 1))
                  setSelectedId(null)
                }}
                style={{ minHeight: '36px', padding: '0 16px' }}
              >
                ← Previous Page
              </button>
              <span style={{ color: '#a3a3a3', fontSize: '13px', fontWeight: 700 }}>
                Page {activePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="button button-ghost"
                disabled={activePage >= pageCount - 1}
                onClick={() => {
                  setActivePage((p) => Math.min(pageCount - 1, p + 1))
                  setSelectedId(null)
                }}
                style={{ minHeight: '36px', padding: '0 16px' }}
              >
                Next Page →
              </button>
            </div>
          </section>

          {/* Properties & Tool Inspector */}
          <aside className="properties-panel">
            <p className="eyebrow">DIRECT EDIT CONTROLS</p>
            <h2>{selectedElement ? 'Edit Text Item' : 'Add Content'}</h2>

            {selectedElement ? (
              <div style={{ display: 'grid', gap: '14px' }}>
                <label>
                  Text Content
                  <textarea
                    rows={3}
                    value={selectedElement.text}
                    onChange={(e) => updateSelected('text', e.target.value)}
                    placeholder="Enter text or leave blank for pure whiteout"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    Font Size ({selectedElement.fontSize}px)
                    <input
                      type="range"
                      min="8"
                      max="72"
                      value={selectedElement.fontSize}
                      onChange={(e) => updateSelected('fontSize', Number(e.target.value))}
                    />
                  </label>

                  <label>
                    Font Family
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) => updateSelected('fontFamily', e.target.value as EditorElement['fontFamily'])}
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="HelveticaBold">Helvetica Bold</option>
                      <option value="Times">Times New Roman</option>
                      <option value="Courier">Courier Monospace</option>
                    </select>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Text Color</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {COLOR_PRESETS.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        title={c.label}
                        onClick={() => updateSelected('color', c.value)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: c.value,
                          border: selectedElement.color === c.value ? '2px solid #ffd21a' : '1px solid #555',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Background Fill</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {BG_PRESETS.map((bg) => (
                      <button
                        type="button"
                        key={bg.value}
                        onClick={() => updateSelected('backgroundColor', bg.value)}
                        className={`button ${selectedElement.backgroundColor === bg.value ? 'button-primary' : 'button-ghost'}`}
                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '10px' }}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => removeSelected()}
                    style={{ color: '#fb7185', borderColor: 'rgba(251,113,133,0.3)', flex: 1 }}
                  >
                    <TrashIcon size={14} />
                    <span>Delete Item</span>
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setSelectedId(null)}
                    style={{ flex: 1 }}
                  >
                    <CheckIcon size={14} />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <p style={{ color: '#a3a3a3', fontSize: '13px', lineHeight: 1.6 }}>
                  Click directly on any word or sentence in the PDF canvas to edit it in place. Or configure new text below to stamp onto the document:
                </p>

                <label>
                  Default Stamp Text
                  <input
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="e.g. Approved, Paid, Note"
                  />
                </label>

                <label>
                  Font Size ({draftSize}px)
                  <input
                    type="range"
                    min="10"
                    max="48"
                    value={draftSize}
                    onChange={(e) => setDraftSize(Number(e.target.value))}
                  />
                </label>

                <label>
                  Font Family
                  <select
                    value={draftFont}
                    onChange={(e) => setDraftFont(e.target.value as EditorElement['fontFamily'])}
                  >
                    <option value="Helvetica">Helvetica</option>
                    <option value="HelveticaBold">Helvetica Bold</option>
                    <option value="Times">Times New Roman</option>
                    <option value="Courier">Courier</option>
                  </select>
                </label>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Text Color</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {COLOR_PRESETS.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        title={c.label}
                        onClick={() => setDraftColor(c.value)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: c.value,
                          border: draftColor === c.value ? '2px solid #ffd21a' : '1px solid #555',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pill-badge" style={{ margin: '10px 0 0', fontSize: '11px', width: '100%', justifyContent: 'center' }}>
                  <span>✓ 100% On-Device Client Processing</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
