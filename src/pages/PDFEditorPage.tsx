import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Link } from 'react-router-dom'
import { FileUploader } from '../components/upload/FileUploader'
import { useToast } from '../components/common/Toast'
import {
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  TrashIcon,
  EditorIcon,
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

export function PDFEditorPage() {
  const toast = useToast()
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

  // Draft state for new text tools
  const [draftText, setDraftText] = useState('Edited Text')
  const [draftSize, setDraftSize] = useState(16)
  const [draftColor, setDraftColor] = useState('#000000')
  const [draftBg, setDraftBg] = useState('#ffffff')
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

  // Load PDF into PDF.js document proxy
  useEffect(() => {
    if (!file) {
      setPageCount(0)
      setActivePage(0)
      setElements([])
      setSelectedId(null)
      setPdfDocProxy(null)
      return
    }

    let isSubscribed = true
    void (async () => {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        if (isSubscribed) {
          setPdfDocProxy(pdf)
          setPageCount(pdf.numPages)
          setActivePage(0)
        }
      } catch (error) {
        toast.show(error instanceof Error ? error.message : 'Could not load this PDF document.', 'error')
      }
    })()

    return () => {
      isSubscribed = false
    }
  }, [file, toast])

  // Render current page onto HTML5 canvas
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
        if (isCurrent) setIsRendering(false)
      } catch (error) {
        console.error('PDF render error:', error)
        if (isCurrent) setIsRendering(false)
      }
    })()

    return () => {
      isCurrent = false
    }
  }, [pdfDocProxy, activePage])

  // Click on stage to place a text box or whiteout
  const handleStageClick = (e: MouseEvent<HTMLDivElement>) => {
    if (toolMode === 'select') return
    if (!stageRef.current) return

    if ((e.target as HTMLElement).closest('.editor-element-box')) return

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
    toast.show(toolMode === 'whiteout' ? 'Whiteout box placed. Drag to position.' : 'Text added. Edit in inspector.', 'success')
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

  // Export edited PDF via pdf-lib
  const exportPdf = async () => {
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

  const selectedElement = elements.find((item) => item.id === selectedId)
  const visibleElements = elements.filter((item) => item.page === activePage)

  return (
    <div className="editor-page">
      <header className="editor-toolbar">
        <Link to="/tools" className="back-link" style={{ margin: 0 }}>
          ← Back to Tools
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EditorIcon size={20} color="#ffd21a" />
          <strong>PDF Studio Editor</strong>
        </div>

        {file && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px' }}>
            <button
              type="button"
              className={`button ${toolMode === 'text' ? 'button-primary' : 'button-ghost'}`}
              style={{ minHeight: '36px', padding: '0 14px', fontSize: '11px' }}
              onClick={() => setToolMode('text')}
            >
              <span>+ Add / Edit Text</span>
            </button>
            <button
              type="button"
              className={`button ${toolMode === 'whiteout' ? 'button-primary' : 'button-ghost'}`}
              style={{ minHeight: '36px', padding: '0 14px', fontSize: '11px' }}
              onClick={() => setToolMode('whiteout')}
            >
              <span>⬜ Whiteout / Erase</span>
            </button>
            <button
              type="button"
              className={`button ${toolMode === 'select' ? 'button-primary' : 'button-ghost'}`}
              style={{ minHeight: '36px', padding: '0 14px', fontSize: '11px' }}
              onClick={() => setToolMode('select')}
            >
              <span>✋ Select & Move</span>
            </button>
          </div>
        )}

        <div className="editor-toolbar-actions">
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
          <button
            type="button"
            className="button button-primary"
            disabled={!file}
            onClick={() => void exportPdf()}
          >
            <DownloadIcon size={16} />
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      {!file ? (
        <div className="editor-empty">
          <p className="eyebrow">BROWSER-ACCELERATED STUDIO</p>
          <h1>Interactive PDF Canvas Editor</h1>
          <p>
            Add text, whiteout/erase existing content, annotate, and replace text directly on high-resolution vector PDF pages with 100% on-device privacy.
          </p>
          <FileUploader accept="application/pdf,.pdf" files={files} onFiles={setFiles} />
        </div>
      ) : (
        <div className="editor-layout">
          {/* Page Thumbnail Sidebar */}
          <aside className="thumbnail-sidebar">
            <p className="eyebrow">PAGES ({pageCount})</p>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                type="button"
                className={`page-thumb ${activePage === index ? 'selected' : ''}`}
                key={index}
                onClick={() => {
                  setActivePage(index)
                  setSelectedId(null)
                }}
              >
                <span>{index + 1}</span>
                <small>Page {index + 1}</small>
              </button>
            ))}
          </aside>

          {/* Interactive Document Stage */}
          <section className="editor-canvas-wrap">
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
                        zIndex: isSelected ? 10 : 2,
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
            <p className="eyebrow">STUDIO CONTROLS</p>
            <h2>{selectedElement ? 'Edit Selected Item' : 'Add Content'}</h2>

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
                    className="button button-danger"
                    style={{ flex: 1, minHeight: '36px' }}
                    onClick={() => removeSelected()}
                  >
                    <TrashIcon size={14} />
                    <span>Delete Item</span>
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ minHeight: '36px' }}
                    onClick={() => setSelectedId(null)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 210, 26, 0.05)', border: '1px solid rgba(255, 210, 26, 0.2)' }}>
                  <strong style={{ color: '#ffd21a', display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                    💡 How to Edit Text:
                  </strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3', lineHeight: 1.5 }}>
                    1. Select <strong>+ Add / Edit Text</strong> or <strong>⬜ Whiteout</strong> mode above.<br />
                    2. Click anywhere on the document to place text or cover existing text.<br />
                    3. Drag items directly on the document to position them.
                  </p>
                </div>

                <label>
                  Default Text for Next Click
                  <input
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Enter text to place"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    Size ({draftSize}px)
                    <input
                      type="range"
                      min="8"
                      max="72"
                      value={draftSize}
                      onChange={(e) => setDraftSize(Number(e.target.value))}
                    />
                  </label>

                  <label>
                    Font
                    <select
                      value={draftFont}
                      onChange={(e) => setDraftFont(e.target.value as typeof draftFont)}
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="HelveticaBold">Helvetica Bold</option>
                      <option value="Times">Times New Roman</option>
                      <option value="Courier">Courier</option>
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
                        onClick={() => setDraftColor(c.value)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: c.value,
                          border: draftColor === c.value ? '2px solid #ffd21a' : '1px solid #555',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Background Style</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {BG_PRESETS.map((bg) => (
                      <button
                        type="button"
                        key={bg.value}
                        onClick={() => setDraftBg(bg.value)}
                        className={`button ${draftBg === bg.value ? 'button-primary' : 'button-ghost'}`}
                        style={{ minHeight: '32px', padding: '0 8px', fontSize: '10px' }}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Overlays on active page */}
            <div className="element-list">
              <h3>Items on Page {activePage + 1} ({visibleElements.length})</h3>
              {visibleElements.length ? (
                visibleElements.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: item.id === selectedId ? 'rgba(255, 210, 26, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: item.id === selectedId ? '1px solid #ffd21a' : '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', maxWidth: '180px' }}>
                      <strong style={{ color: item.color }}>
                        {item.type === 'whiteout' ? '⬜ Whiteout' : item.text || 'Empty Text'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSelected(item.id)
                      }}
                      style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: '2px' }}
                      aria-label="Delete"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="privacy-note">No items added on this page yet.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
