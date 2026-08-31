import { useEffect, useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Link } from 'react-router-dom'
import { browserDocumentProcessor } from '../services/documentProcessor'
import { FileUploader } from '../components/upload/FileUploader'
import { useToast } from '../components/common/Toast'
import {
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  SparklesIcon,
  TrashIcon,
  EditorIcon
} from '../components/common/Icons'

interface TextElement {
  id: number
  page: number
  x: number
  y: number
  text: string
  size: number
}

export function PDFEditorPage() {
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [pageCount, setPageCount] = useState(0)
  const [activePage, setActivePage] = useState(0)
  const [preview, setPreview] = useState('')
  const [zoom, setZoom] = useState(100)
  const [elements, setElements] = useState<TextElement[]>([])
  const [draftText, setDraftText] = useState('Confidential Note')
  const [draftSize, setDraftSize] = useState(18)
  const [dirty, setDirty] = useState(false)
  const file = files[0]

  useEffect(() => {
    if (!file) {
      setPreview('')
      setPageCount(0)
      setElements([])
      setDirty(false)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    void browserDocumentProcessor
      .inspect(file)
      .then(({ pageCount: count }) => {
        setPageCount(count)
        setActivePage(0)
      })
      .catch((error: unknown) => toast.show(error instanceof Error ? error.message : 'Could not read this PDF.', 'error'))
    return () => URL.revokeObjectURL(url)
  }, [file, toast])

  const addText = () => {
    if (!file) return
    setElements([
      ...elements,
      {
        id: Date.now(),
        page: activePage,
        x: 50,
        y: 50,
        text: draftText.trim() || 'Text Overlay',
        size: draftSize
      }
    ])
    setDirty(true)
  }

  const updateElement = (id: number, field: 'text' | 'x' | 'y' | 'size', value: string | number) => {
    setElements(
      elements.map((element) =>
        element.id === id ? { ...element, [field]: field === 'text' ? String(value) : Number(value) } : element
      )
    )
    setDirty(true)
  }

  const removeElement = (id: number) => {
    setElements(elements.filter((element) => element.id !== id))
    setDirty(true)
  }

  const exportPdf = async () => {
    if (!file) return
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer())
      const font = await pdf.embedFont(StandardFonts.HelveticaBold)
      elements.forEach((element) => {
        const page = pdf.getPage(element.page)
        const { width, height } = page.getSize()
        page.drawText(element.text, {
          x: (width * element.x) / 100,
          y: (height * (100 - element.y)) / 100,
          size: element.size,
          font,
          color: rgb(0.1, 0.1, 0.1)
        })
      })
      const blob = new Blob([await pdf.save()], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${file.name.replace(/\.pdf$/i, '')}-edited.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      setDirty(false)
      toast.show('Edited PDF has been exported successfully.', 'success')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not export this PDF.', 'error')
    }
  }

  const visibleElements = elements.filter((element) => element.page === activePage)

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
        <div className="editor-toolbar-actions">
          <button
            type="button"
            className="icon-btn"
            disabled={!file}
            onClick={() => setZoom(Math.max(60, zoom - 10))}
            aria-label="Zoom out"
          >
            <ZoomOutIcon size={18} />
          </button>
          <span>{zoom}%</span>
          <button
            type="button"
            className="icon-btn"
            disabled={!file}
            onClick={() => setZoom(Math.min(160, zoom + 10))}
            aria-label="Zoom in"
          >
            <ZoomInIcon size={18} />
          </button>
          <button type="button" className="button button-primary" disabled={!file} onClick={() => void exportPdf()}>
            <DownloadIcon size={16} />
            <span>Export Edited PDF</span>
          </button>
        </div>
      </header>

      {!file ? (
        <div className="editor-empty">
          <p className="eyebrow">LOCAL PDF CANVAS</p>
          <h1>Upload a Document to Edit</h1>
          <p>
            Add interactive text annotations, notes, and stamps in a private, browser-accelerated studio. Your original file remains untouched.
          </p>
          <FileUploader accept="application/pdf,.pdf" files={files} onFiles={setFiles} />
        </div>
      ) : (
        <div className="editor-layout">
          <aside className="thumbnail-sidebar">
            <p className="eyebrow">DOCUMENT PAGES</p>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                type="button"
                className={`page-thumb ${activePage === index ? 'selected' : ''}`}
                key={index}
                onClick={() => setActivePage(index)}
              >
                <span>{index + 1}</span>
                <small>Page {index + 1}</small>
              </button>
            ))}
          </aside>

          <section className="editor-canvas-wrap">
            <div
              className="canvas-stage"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <iframe
                title={`Preview of page ${activePage + 1}`}
                src={`${preview}#page=${activePage + 1}&toolbar=0&navpanes=0`}
              />
              <div className="canvas-overlay">
                {visibleElements.map((element) => (
                  <div
                    className="editor-text"
                    key={element.id}
                    style={{ left: `${element.x}%`, top: `${element.y}%`, fontSize: `${element.size}px` }}
                  >
                    {element.text}
                  </div>
                ))}
              </div>
            </div>
            <p className="canvas-caption">
              Viewing Page {activePage + 1} of {pageCount}. Overlays are positioned relative to the PDF coordinate grid.
            </p>
          </section>

          <aside className="properties-panel">
            <p className="eyebrow">OVERLAY INSPECTOR</p>
            <h2>Add Text Annotation</h2>
            <label>
              Text Content
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                rows={3}
                placeholder="Enter text to overlay"
              />
            </label>
            <label>
              Font Size (px)
              <input
                type="number"
                min="8"
                max="72"
                value={draftSize}
                onChange={(event) => setDraftSize(Number(event.target.value))}
              />
            </label>
            <button type="button" className="button button-primary" style={{ width: '100%', marginTop: '8px' }} onClick={addText}>
              <SparklesIcon size={16} />
              <span>Add to Page {activePage + 1}</span>
            </button>

            <div className="element-list">
              <h3>Placed Overlays ({visibleElements.length})</h3>
              {visibleElements.length ? (
                visibleElements.map((element) => (
                  <div className="element-control" key={element.id}>
                    <input
                      aria-label="Element text"
                      value={element.text}
                      onChange={(event) => updateElement(element.id, 'text', event.target.value)}
                    />
                    <div>
                      <label>
                        X Position %
                        <input
                          type="number"
                          min="0"
                          max="95"
                          value={element.x}
                          onChange={(event) => updateElement(element.id, 'x', event.target.value)}
                        />
                      </label>
                      <label>
                        Y Position %
                        <input
                          type="number"
                          min="0"
                          max="95"
                          value={element.y}
                          onChange={(event) => updateElement(element.id, 'y', event.target.value)}
                        />
                      </label>
                    </div>
                    <button type="button" className="text-button danger" onClick={() => removeElement(element.id)}>
                      <TrashIcon size={14} />
                      <span>Remove Overlay</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="privacy-note">No overlays added on this page yet.</p>
              )}
            </div>

            {dirty && (
              <p className="file-insight" style={{ marginTop: '20px' }}>
                <SparklesIcon size={14} />
                <span>Unsaved annotations ready for export.</span>
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
