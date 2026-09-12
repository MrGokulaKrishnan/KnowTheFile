import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Link } from 'react-router-dom'
import { browserDocumentProcessor, formatPageNumbersToRange, parsePageRange, serverDocumentProcessor } from '../../services/documentProcessor'
import { pdfToImages, pdfToText } from '../../services/pdfReadService'
import type { ProcessedDocument, ToolDefinition } from '../../types'
import { useToast } from '../common/Toast'
import { FileUploader, formatBytes } from '../upload/FileUploader'
import {
  ToolIconRenderer,
  DownloadIcon,
  EyeIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  TrashIcon,
  EditorIcon
} from '../common/Icons'

export function ToolRunner({ tool }: { tool: ToolDefinition }) {
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProcessedDocument | null>(null)
  const [manyResults, setManyResults] = useState<ProcessedDocument[]>([])
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState('')

  // Tool specific configurations
  const [range, setRange] = useState('')
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [angle, setAngle] = useState(90)
  const [compressLevel, setCompressLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right'>('bottom-center')
  const [imageFit, setImageFit] = useState<'fit' | 'original'>('fit')
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png')
  const [imageDpi, setImageDpi] = useState<'300' | '150' | '72'>('300')
  const [metadata, setMetadata] = useState({ title: '', author: '', subject: '', keywords: '' })
  const [signature, setSignature] = useState('Authorized Signature')
  const [password, setPassword] = useState('')

  const multiple = tool.id === 'merge-pdf' || tool.id === 'image-to-pdf'
  const imageTool = tool.id === 'image-to-pdf'
  const wordTool = tool.id === 'word-to-pdf'
  const first = files[0]

  useEffect(() => {
    setStatus('idle')
    setResult(null)
    setManyResults([])
    setError('')
    setPageCount(null)
    setRange('')
    setPassword('')
    setProgress(0)
    setProgressStage('')
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [tool.id])

  useEffect(() => {
    if (!first || imageTool || wordTool) return
    void browserDocumentProcessor
      .inspect(first)
      .then((data) => {
        setPageCount(data.pageCount)
        setMetadata((previous) => ({ ...previous, title: data.title, author: data.author }))
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not inspect this PDF document.'))
  }, [first, imageTool, wordTool])

  const rangeIsNeeded = ['split-pdf', 'extract-pdf', 'delete-pages', 'rotate-pdf'].includes(tool.id)

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= files.length) return
    const updated = [...files]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setFiles(updated)
  }

  // Synchronized set of 1-indexed page numbers
  const selectedPagesSet = useMemo(() => {
    if (!range.trim() || !pageCount) return new Set<number>()
    const parsed = parsePageRange(range, pageCount)
    if (parsed.error || !parsed.pages) return new Set<number>()
    return new Set<number>(parsed.pages.map((p) => p + 1))
  }, [range, pageCount])

  const togglePage = (pageNumber: number) => {
    const next = new Set(selectedPagesSet)
    if (next.has(pageNumber)) {
      next.delete(pageNumber)
    } else {
      next.add(pageNumber)
    }
    setRange(formatPageNumbersToRange(Array.from(next)))
  }

  const setAllPages = () => {
    if (!pageCount) return
    const all = Array.from({ length: pageCount }, (_, i) => i + 1)
    setRange(formatPageNumbersToRange(all))
  }

  const setOddPages = () => {
    if (!pageCount) return
    const odd = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 1)
    setRange(formatPageNumbersToRange(odd))
  }

  const setEvenPages = () => {
    if (!pageCount) return
    const even = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 0)
    setRange(formatPageNumbersToRange(even))
  }

  const addFirstPage = () => {
    const next = new Set(selectedPagesSet)
    next.add(1)
    setRange(formatPageNumbersToRange(Array.from(next)))
  }

  const addLastPage = () => {
    if (!pageCount) return
    const next = new Set(selectedPagesSet)
    next.add(pageCount)
    setRange(formatPageNumbersToRange(Array.from(next)))
  }

  const clearSelection = () => {
    setRange('')
  }

  const settings = useMemo(() => {
    if (tool.id === 'pdf-editor') {
      return (
        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,210,26,0.08)', border: '1px solid rgba(255,210,26,0.25)' }}>
          <strong style={{ color: '#ffd21a', display: 'block', marginBottom: '6px' }}>Interactive Canvas Studio</strong>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#d4d4d4', lineHeight: 1.5 }}>
            Add text, whiteout/erase existing text, annotate, and re-position items directly on high-resolution PDF pages.
          </p>
          <Link to="/editor" className="button button-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <EditorIcon size={16} />
            <span>Launch PDF Studio Canvas</span>
          </Link>
        </div>
      )
    }
    if (tool.id === 'compress-pdf') {
      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <label>
            Compression Mode
            <select value={compressLevel} onChange={(e) => setCompressLevel(e.target.value as typeof compressLevel)}>
              <option value="high">High Compression (Maximum Size Reduction)</option>
              <option value="medium">Balanced (Recommended for general use)</option>
              <option value="low">Low Compression (Preserve maximum fidelity)</option>
            </select>
          </label>
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#a3a3a3' }}>
            {compressLevel === 'high' && '• Strips duplicate objects, removes metadata streams, and enables cross-reference object compression.'}
            {compressLevel === 'medium' && '• Compresses content streams and reorganizes document trees without degrading vector text.'}
            {compressLevel === 'low' && '• Optimizes object streams while preserving all metadata and structural tags.'}
          </div>
        </div>
      )
    }
    if (tool.id === 'split-pdf') {
      const selectedCount = selectedPagesSet.size
      const total = pageCount ?? 0

      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <label>
            Split Method
            <select
              value={splitMode}
              onChange={(e) => {
                const mode = e.target.value as typeof splitMode
                setSplitMode(mode)
                if (mode === 'all') setRange('')
              }}
            >
              <option value="all">Split All Pages into Separate PDFs (ZIP)</option>
              <option value="custom">Extract Specific Page Range</option>
            </select>
          </label>

          {splitMode === 'custom' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <label>
                Page Range or Numbers
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                />
              </label>

              {total > 1 && (
                <div>
                  <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Quick Selection:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={setAllPages}
                      style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={setOddPages}
                      style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Odd Pages
                    </button>
                    <button
                      type="button"
                      onClick={setEvenPages}
                      style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Even Pages
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fb7185', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {total > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600 }}>Click pages to select ({total} pages):</span>
                    <span style={{ fontSize: '11px', color: selectedCount > 0 ? '#ffd21a' : '#737373', fontWeight: 700 }}>
                      {selectedCount} selected
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
                      const isSelected = selectedPagesSet.has(num)
                      return (
                        <button
                          type="button"
                          key={num}
                          onClick={() => togglePage(num)}
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: isSelected ? '#ffd21a' : 'rgba(255,255,255,0.06)',
                            color: isSelected ? '#000000' : '#ffffff',
                            border: isSelected ? '1px solid #ffd21a' : '1px solid rgba(255,255,255,0.12)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {num}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    if (tool.id === 'rotate-pdf') {
      const total = pageCount ?? 0
      const selectedCount = selectedPagesSet.size

      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <label>
            Rotation Angle
            <select value={angle} onChange={(event) => setAngle(Number(event.target.value))}>
              <option value={90}>90° Clockwise</option>
              <option value={180}>180° Half-Turn (Flip Upside Down)</option>
              <option value={270}>270° Clockwise (90° Counter-Clockwise)</option>
            </select>
          </label>
          <label>
            Target Pages (Optional)
            <input
              value={range}
              onChange={(event) => setRange(event.target.value)}
              placeholder="Leave blank for all pages, or e.g. 1, 3-5"
            />
            <small style={{ color: '#737373', marginTop: '4px', display: 'block' }}>
              {range.trim()
                ? `Rotating ${selectedCount} specific ${selectedCount === 1 ? 'page' : 'pages'}.`
                : 'Leaving blank will rotate every page in the PDF.'}
            </small>
          </label>

          {total > 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600 }}>Target Specific Pages:</span>
                {range.trim() && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    style={{ background: 'none', border: 'none', color: '#ffd21a', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    Reset to All Pages
                  </button>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  padding: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
                  const isSelected = selectedPagesSet.has(num)
                  return (
                    <button
                      type="button"
                      key={num}
                      onClick={() => togglePage(num)}
                      style={{
                        minWidth: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: isSelected ? '#ffd21a' : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#000000' : '#ffffff',
                        border: isSelected ? '1px solid #ffd21a' : '1px solid rgba(255,255,255,0.12)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    }
    if (tool.id === 'watermark-pdf') {
      return (
        <label>
          Watermark Text
          <input
            value={watermark}
            maxLength={60}
            onChange={(event) => setWatermark(event.target.value)}
            placeholder="e.g. CONFIDENTIAL, DRAFT"
          />
        </label>
      )
    }
    if (tool.id === 'sign-pdf') {
      return (
        <label>
          Signature Stamp / Name
          <input
            value={signature}
            maxLength={60}
            onChange={(event) => setSignature(event.target.value)}
            placeholder="e.g. John Doe, Authorized Officer"
          />
        </label>
      )
    }
    if (tool.id === 'unlock-pdf') {
      return (
        <label>
          PDF Password (if encrypted)
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter document password"
          />
        </label>
      )
    }
    if (tool.id === 'page-numbers') {
      return (
        <label>
          Page Number Placement
          <select value={position} onChange={(event) => setPosition(event.target.value as typeof position)}>
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </label>
      )
    }
    if (tool.id === 'image-to-pdf') {
      return (
        <label>
          Page Sizing & Fit
          <select value={imageFit} onChange={(event) => setImageFit(event.target.value as typeof imageFit)}>
            <option value="fit">Fit to Standard A4 Page</option>
            <option value="original">Preserve Original Dimensions</option>
          </select>
        </label>
      )
    }
    if (tool.id === 'pdf-to-image') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label>
            Export Format
            <select value={imageFormat} onChange={(event) => setImageFormat(event.target.value as typeof imageFormat)}>
              <option value="png">PNG (Lossless)</option>
              <option value="jpg">JPG (Compact)</option>
            </select>
          </label>
          <label>
            Resolution / Quality
            <select value={imageDpi} onChange={(event) => setImageDpi(event.target.value as typeof imageDpi)}>
              <option value="300">300 DPI (High Quality Print)</option>
              <option value="150">150 DPI (HD Screen)</option>
              <option value="72">72 DPI (Web Speed)</option>
            </select>
          </label>
        </div>
      )
    }
    if (tool.id === 'metadata-pdf') {
      return (
        <div className="meta-fields">
          {(['title', 'author', 'subject', 'keywords'] as const).map((key) => (
            <label key={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <input
                value={metadata[key]}
                onChange={(event) => setMetadata({ ...metadata, [key]: event.target.value })}
                placeholder={key === 'keywords' ? 'finance, 2026, report' : ''}
              />
            </label>
          ))}
        </div>
      )
    }
    if (tool.id === 'delete-pages') {
      const deleteCount = selectedPagesSet.size
      const total = pageCount ?? 0
      const remainCount = total ? total - deleteCount : 0
      const allSelected = total > 0 && deleteCount >= total

      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label>
              Pages to Delete
              <input
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g. 1-3, 5, 8"
              />
            </label>
            <small style={{ color: '#a3a3a3', marginTop: '4px', display: 'block', fontSize: '11px' }}>
              Enter page numbers/ranges or click buttons below to mark pages for removal.
            </small>
          </div>

          {total > 1 && (
            <div>
              <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Quick Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={addFirstPage}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  + First Page
                </button>
                <button
                  type="button"
                  onClick={addLastPage}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  + Last Page
                </button>
                <button
                  type="button"
                  onClick={setOddPages}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Odd Pages
                </button>
                <button
                  type="button"
                  onClick={setEvenPages}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Even Pages
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(251,113,133,0.1)',
                    border: '1px solid rgba(251,113,133,0.3)',
                    color: '#fb7185',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600 }}>
                  Select Pages to Delete ({total} total):
                </span>
                <span style={{ fontSize: '11px', color: deleteCount > 0 ? '#fb7185' : '#737373', fontWeight: 700 }}>
                  {deleteCount} to delete
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
                  const isMarked = selectedPagesSet.has(num)
                  return (
                    <button
                      type="button"
                      key={num}
                      onClick={() => togglePage(num)}
                      style={{
                        minWidth: '34px',
                        height: '34px',
                        borderRadius: '6px',
                        background: isMarked ? '#ef4444' : 'rgba(255,255,255,0.06)',
                        color: isMarked ? '#ffffff' : '#e5e5e5',
                        border: isMarked ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: isMarked ? 'line-through' : 'none',
                        boxShadow: isMarked ? '0 0 10px rgba(239,68,68,0.4)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      title={isMarked ? `Page ${num} will be deleted` : `Click to mark Page ${num} for deletion`}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {total > 0 && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: allSelected ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: allSelected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '12px',
                lineHeight: 1.5
              }}
            >
              {allSelected ? (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ Cannot delete all pages. A PDF must retain at least one page.
                </span>
              ) : deleteCount === 0 ? (
                <span style={{ color: '#ffd21a' }}>
                  ℹ️ Click pages above or enter page numbers to mark them for deletion.
                </span>
              ) : (
                <div style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ color: '#fb7185', fontWeight: 600 }}>
                    🗑️ {deleteCount} {deleteCount === 1 ? 'page' : 'pages'} will be permanently removed
                  </span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>
                    ✓ {remainCount} {remainCount === 1 ? 'page' : 'pages'} will remain in your document
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    if (tool.id === 'extract-pdf') {
      const extractCount = selectedPagesSet.size
      const total = pageCount ?? 0

      return (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label>
              Pages to Extract
              <input
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g. 1-3, 5, 8"
              />
            </label>
            <small style={{ color: '#a3a3a3', marginTop: '4px', display: 'block', fontSize: '11px' }}>
              Enter page numbers/ranges or click buttons below to select pages to export.
            </small>
          </div>

          {total > 1 && (
            <div>
              <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Quick Selection:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={setAllPages}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={setOddPages}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Odd Pages
                </button>
                <button
                  type="button"
                  onClick={setEvenPages}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Even Pages
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(251,113,133,0.1)',
                    border: '1px solid rgba(251,113,133,0.3)',
                    color: '#fb7185',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 600 }}>
                  Pages to Extract ({total} total):
                </span>
                <span style={{ fontSize: '11px', color: extractCount > 0 ? '#ffd21a' : '#737373', fontWeight: 700 }}>
                  {extractCount} selected
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
                  const isSelected = selectedPagesSet.has(num)
                  return (
                    <button
                      type="button"
                      key={num}
                      onClick={() => togglePage(num)}
                      style={{
                        minWidth: '34px',
                        height: '34px',
                        borderRadius: '6px',
                        background: isSelected ? '#ffd21a' : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#000000' : '#ffffff',
                        border: isSelected ? '1px solid #ffd21a' : '1px solid rgba(255,255,255,0.12)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? '0 0 10px rgba(255,210,26,0.35)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      title={isSelected ? `Page ${num} will be extracted` : `Click to select Page ${num} for extraction`}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {total > 0 && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '12px',
                lineHeight: 1.5
              }}
            >
              {extractCount === 0 ? (
                <span style={{ color: '#ffd21a' }}>
                  ℹ️ Click pages above or enter page numbers to extract them.
                </span>
              ) : (
                <span style={{ color: '#ffd21a', fontWeight: 600 }}>
                  📄 {extractCount} {extractCount === 1 ? 'page' : 'pages'} will be extracted into a new PDF.
                </span>
              )}
            </div>
          )}
        </div>
      )
    }
    if (tool.id === 'pdf-to-text') {
      return (
        <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#d4d4d4', lineHeight: 1.6 }}>
          <strong style={{ color: '#ffd21a', display: 'block', marginBottom: '6px' }}>On-Device Text Extraction</strong>
          Extracts all selectable vector and body text directly from the document into a clean, searchable plain text (.txt) file. 100% private in-browser execution.
        </div>
      )
    }
    if (tool.id === 'pdf-to-word') {
      return (
        <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#d4d4d4', lineHeight: 1.6 }}>
          <strong style={{ color: '#ffd21a', display: 'block', marginBottom: '6px' }}>Client-Side DOCX Engine</strong>
          Extracts and converts document text, headings, and paragraph structures directly into an editable Microsoft Word (.docx) file without cloud uploads.
        </div>
      )
    }
    if (tool.id === 'word-to-pdf') {
      return (
        <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#d4d4d4', lineHeight: 1.6 }}>
          <strong style={{ color: '#ffd21a', display: 'block', marginBottom: '6px' }}>Word to Standard PDF</strong>
          Converts .docx documents directly in your browser with standard typography and headings into a universal PDF file.
        </div>
      )
    }
    return null
  }, [tool.id, compressLevel, splitMode, range, pageCount, angle, watermark, signature, password, position, imageFit, imageFormat, imageDpi, metadata, selectedPagesSet])

  const run = async () => {
    setError('')
    setResult(null)
    setManyResults([])

    if (tool.availability === 'server') {
      try {
        serverDocumentProcessor.unavailable(tool.name)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'This operation is not available.')
      }
      return
    }

    if (tool.id === 'merge-pdf' && files.length < 2) {
      setError('Please upload at least 2 PDF files to merge into a single document.')
      toast.show('Please select at least 2 PDF files to merge.', 'error')
      return
    }

    setStatus('processing')
    setProgress(15)
    setProgressStage('Initializing browser document engine…')

    try {
      let processed: ProcessedDocument | undefined
      let splitResults: ProcessedDocument[] = []
      const pages = rangeIsNeeded && range.trim() ? parsePageRange(range, pageCount ?? 0) : { pages: [] }
      if (pages.error) throw new Error(pages.error)

      setProgress(40)
      setProgressStage('Processing document stream on-device…')

      switch (tool.id) {
        case 'merge-pdf':
          processed = await browserDocumentProcessor.merge(files)
          break
        case 'split-pdf':
          splitResults = range.trim()
            ? [await browserDocumentProcessor.extract(first!, pages.pages, 'split')]
            : await browserDocumentProcessor.split(first!)
          break
        case 'extract-pdf':
          processed = await browserDocumentProcessor.extract(first!, pages.pages)
          break
        case 'delete-pages':
          processed = await browserDocumentProcessor.deletePages(first!, pages.pages)
          break
        case 'rotate-pdf':
          processed = await browserDocumentProcessor.rotate(first!, pages.pages, angle)
          break
        case 'compress-pdf':
          processed = await browserDocumentProcessor.compress(first!, compressLevel)
          break
        case 'image-to-pdf':
          processed = await browserDocumentProcessor.imagesToPdf(files, imageFit)
          break
        case 'watermark-pdf':
          processed = await browserDocumentProcessor.watermark(first!, watermark)
          break
        case 'page-numbers':
          processed = await browserDocumentProcessor.pageNumbers(first!, position)
          break
        case 'metadata-pdf':
          processed = await browserDocumentProcessor.metadata(first!, metadata)
          break
        case 'pdf-to-image':
          processed = await pdfToImages(first!, imageFormat, imageDpi, (pct) => {
            setProgress(40 + Math.round(pct * 0.5))
          })
          break
        case 'pdf-to-text':
          processed = await pdfToText(first!)
          break
        case 'pdf-to-word':
          processed = await browserDocumentProcessor.pdfToDocx(first!)
          break
        case 'word-to-pdf':
          processed = await browserDocumentProcessor.wordToPdf(first!)
          break
        case 'sign-pdf':
          processed = await browserDocumentProcessor.sign(first!, signature)
          break
        case 'unlock-pdf':
          processed = await browserDocumentProcessor.unlock(first!, password)
          break
        default:
          throw new Error('This tool is not connected yet.')
      }

      setProgress(90)
      setProgressStage('Finalizing output archive…')

      if (processed && processed.blob.size === 0) {
        throw new Error('The output file was empty, so it was discarded.')
      }

      setResult(processed ?? null)
      setManyResults(splitResults)
      setProgress(100)
      setStatus('completed')
      toast.show('Your document has been processed successfully.', 'success')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Processing failed. Try another file.')
      setStatus('error')
    }
  }

  const download = (item: ProcessedDocument) => {
    const url = URL.createObjectURL(item.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = item.fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadAll = async () => {
    const zip = new JSZip()
    manyResults.forEach((item) => zip.file(item.fileName, item.blob))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    download({
      blob,
      fileName: `${first?.name.replace(/\.pdf$/i, '') ?? 'pages'}-split.zip`,
      mimeType: 'application/zip',
      inputBytes: first?.size ?? 0,
      outputBytes: blob.size
    })
  }

  const canProcess = () => {
    if (status === 'processing') return false
    if (!files.length) return false
    if (tool.id === 'merge-pdf' && files.length < 2) return false
    if (tool.id === 'delete-pages') {
      if (!range.trim() || selectedPagesSet.size === 0) return false
      if (pageCount && selectedPagesSet.size >= pageCount) return false
    }
    if (tool.id === 'extract-pdf') {
      if (!range.trim() || selectedPagesSet.size === 0) return false
    }
    if (tool.id === 'split-pdf' && splitMode === 'custom') {
      if (!range.trim() || selectedPagesSet.size === 0) return false
    }
    if (tool.id === 'watermark-pdf' && !watermark.trim()) return false
    if (tool.id === 'sign-pdf' && !signature.trim()) return false
    return true
  }

  return (
    <section className="tool-workbench">
      <Link to="/tools" className="back-link">
        ← Back to All Tools
      </Link>
      <div className="tool-intro">
        <div className="tool-icon-avatar">
          <ToolIconRenderer name={tool.id} size={28} />
        </div>
        <div>
          <p className="eyebrow">
            {tool.category} · {tool.availability === 'browser' ? 'On-Device Browser Accelerated' : 'Server Engine'}
          </p>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>

      {tool.availability === 'server' ? (
        <ServerUnavailable tool={tool} />
      ) : (
        <>
          <div className="tool-grid">
            <div>
              <FileUploader
                accept={
                  imageTool
                    ? 'image/jpeg,image/png,image/webp'
                    : wordTool
                    ? '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
                    : 'application/pdf,.pdf'
                }
                multiple={multiple}
                files={files}
                onFiles={setFiles}
                label={
                  tool.id === 'merge-pdf'
                    ? 'Drop 2 or more PDF files here to merge'
                    : multiple
                    ? 'Drop files here or browse multiple'
                    : wordTool
                    ? 'Drop your Word document (.docx) here or browse'
                    : 'Drop your document here or browse'
                }
              />

              {/* Multi-File Merge Order & Manager */}
              {tool.id === 'merge-pdf' && files.length > 0 && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '13px', color: '#ffffff' }}>Merge Sequence ({files.length} files)</strong>
                    <span style={{ fontSize: '11px', color: '#ffd21a' }}>Files will merge top to bottom</span>
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {files.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(20,20,20,0.8)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '4px', background: '#ffd21a', color: '#000000', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '12px', color: '#f5f5f7', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {file.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveFile(idx, 'up')}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            title="Move Up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === files.length - 1}
                            onClick={() => moveFile(idx, 'down')}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            title="Move Down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: '4px' }}
                            title="Remove file"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {files.length === 1 && (
                    <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#ffd21a' }}>
                      ⚠️ Please add at least 1 more PDF file to perform a merge.
                    </p>
                  )}
                </div>
              )}

              {pageCount && (
                <div className="file-insight">
                  <ShieldCheckIcon size={16} />
                  <span>Document loaded · {pageCount} {pageCount === 1 ? 'page' : 'pages'} verified</span>
                </div>
              )}

              {/* Interactive Document Page Gallery for Delete & Extract Tools */}
              {(tool.id === 'delete-pages' || tool.id === 'extract-pdf') && first && pageCount && pageCount > 0 && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#ffffff', display: 'block' }}>
                        {tool.id === 'delete-pages' ? 'Document Pages — Click Any Page to Delete' : 'Document Pages — Click Any Page to Extract'}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#a3a3a3' }}>
                        {tool.id === 'delete-pages'
                          ? `${selectedPagesSet.size} of ${pageCount} pages marked for deletion`
                          : `${selectedPagesSet.size} of ${pageCount} pages selected for export`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {tool.id === 'delete-pages' ? (
                        <>
                          <button
                            type="button"
                            onClick={setOddPages}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Odd
                          </button>
                          <button
                            type="button"
                            onClick={setEvenPages}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Even
                          </button>
                          <button
                            type="button"
                            onClick={clearSelection}
                            style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fb7185', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Keep All
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={setAllPages}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={clearSelection}
                            style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fb7185', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                      gap: '12px',
                      maxHeight: '440px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}
                  >
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => {
                      const isDeleteMode = tool.id === 'delete-pages'
                      const isMarked = selectedPagesSet.has(num)

                      return (
                        <div
                          key={num}
                          onClick={() => togglePage(num)}
                          style={{
                            position: 'relative',
                            borderRadius: '10px',
                            border: isDeleteMode
                              ? isMarked
                                ? '2px solid #ef4444'
                                : '1px solid rgba(255,255,255,0.1)'
                              : isMarked
                              ? '2px solid #ffd21a'
                              : '1px solid rgba(255,255,255,0.1)',
                            background: isDeleteMode
                              ? isMarked
                                ? 'rgba(239,68,68,0.12)'
                                : 'rgba(20,20,20,0.85)'
                              : isMarked
                              ? 'rgba(255,210,26,0.1)'
                              : 'rgba(20,20,20,0.85)',
                            padding: '10px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            boxShadow: isDeleteMode && isMarked ? '0 0 16px rgba(239,68,68,0.25)' : 'none'
                          }}
                        >
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff' }}>Page {num}</span>
                            {isDeleteMode ? (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isMarked ? '#ef4444' : 'rgba(34,197,94,0.15)',
                                  color: isMarked ? '#ffffff' : '#4ade80',
                                  border: isMarked ? 'none' : '1px solid rgba(34,197,94,0.3)',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                {isMarked ? 'DELETE' : 'KEEP'}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isMarked ? '#ffd21a' : 'rgba(255,255,255,0.06)',
                                  color: isMarked ? '#000000' : '#a3a3a3',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                {isMarked ? 'EXTRACT' : 'SKIP'}
                              </span>
                            )}
                          </div>

                          {/* Document sheet representation */}
                          <div
                            style={{
                              width: '64px',
                              height: '84px',
                              background: isDeleteMode && isMarked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                              borderRadius: '6px',
                              border: isDeleteMode && isMarked ? '1px dashed rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.12)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              gap: '4px'
                            }}
                          >
                            {isDeleteMode && isMarked ? (
                              <TrashIcon size={24} color="#ef4444" />
                            ) : (
                              <>
                                <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
                                <div style={{ width: '42px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
                                <div style={{ width: '28px', height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px' }} />
                                <span style={{ position: 'absolute', bottom: '4px', fontSize: '10px', color: '#a3a3a3', fontWeight: 700 }}>
                                  {num}
                                </span>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            style={{
                              width: '100%',
                              padding: '4px 0',
                              borderRadius: '5px',
                              border: 'none',
                              background: isDeleteMode
                                ? isMarked
                                  ? 'rgba(239,68,68,0.2)'
                                  : 'rgba(255,255,255,0.06)'
                                : isMarked
                                ? '#ffd21a'
                                : 'rgba(255,255,255,0.06)',
                              color: isDeleteMode
                                ? isMarked
                                  ? '#fb7185'
                                  : '#e5e5e5'
                                : isMarked
                                ? '#000000'
                                : '#e5e5e5',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isDeleteMode ? (isMarked ? 'Marked' : 'Delete') : isMarked ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="settings-card">
              <h2>Tool Configuration</h2>
              {settings}

              {/* Dynamic Live Progress Bar */}
              {status === 'processing' && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#ffd21a', fontWeight: 700, marginBottom: '6px' }}>
                    <span>{progressStage || 'Processing…'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ffd21a, #ff9f0a)',
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                className="button button-primary process-button"
                disabled={!canProcess()}
                onClick={() => void run()}
              >
                {status === 'processing' ? (
                  <>
                    <RefreshCwIcon size={18} className="animate-spin" />
                    <span>Processing Document…</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon size={18} />
                    <span>
                      {tool.id === 'merge-pdf'
                        ? files.length >= 2
                          ? `Merge ${files.length} PDFs`
                          : 'Select 2+ PDFs to Merge'
                        : tool.id === 'delete-pages'
                        ? !first
                          ? 'Upload PDF to Delete Pages'
                          : selectedPagesSet.size === 0
                          ? 'Select Pages to Delete'
                          : pageCount && selectedPagesSet.size >= pageCount
                          ? 'Cannot Delete All Pages'
                          : `Delete ${selectedPagesSet.size} ${selectedPagesSet.size === 1 ? 'Page' : 'Pages'}`
                        : tool.id === 'extract-pdf'
                        ? !first
                          ? 'Upload PDF to Extract Pages'
                          : selectedPagesSet.size === 0
                          ? 'Select Pages to Extract'
                          : `Extract ${selectedPagesSet.size} ${selectedPagesSet.size === 1 ? 'Page' : 'Pages'}`
                        : `Process ${tool.name}`}
                    </span>
                  </>
                )}
              </button>
              <p className="privacy-note">
                <ShieldCheckIcon size={14} />
                <span>Source file remains on your device. Zero server upload.</span>
              </p>
            </aside>
          </div>

          {error && (
            <div className="notice notice-error">
              <strong>Processing Alert</strong>
              <span>{error}</span>
              {status === 'error' && (
                <button type="button" className="text-button" onClick={() => void run()}>
                  Retry Operation
                </button>
              )}
            </div>
          )}

          {result && <ResultCard result={result} onDownload={download} />}

          {manyResults.length > 0 && (
            <section className="result-card">
              <div>
                <p className="eyebrow">SUCCESS · BATCH COMPLETED</p>
                <h2>{manyResults.length} Files Ready</h2>
                <p>Each page or split section has been processed cleanly. Download as a single ZIP or choose individual files.</p>
              </div>
              <div className="result-actions">
                <button type="button" className="button button-primary" onClick={() => void downloadAll()}>
                  <DownloadIcon size={16} />
                  <span>Download ZIP Archive</span>
                </button>
                {manyResults.map((item) => (
                  <button type="button" className="button button-ghost" key={item.fileName} onClick={() => download(item)}>
                    <DownloadIcon size={14} />
                    <span>{item.fileName}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}

function ResultCard({
  result,
  onDownload
}: {
  result: ProcessedDocument
  onDownload: (result: ProcessedDocument) => void
}) {
  const reduction = result.inputBytes ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0
  const isPdf = result.mimeType === 'application/pdf'

  return (
    <section className="result-card">
      <div>
        <p className="eyebrow">READY FOR DOWNLOAD</p>
        <h2>Your document is ready.</h2>
        <p>
          {result.fileName} · {formatBytes(result.outputBytes)}
          {isPdf && result.pageCount ? ` · ${result.pageCount} pages` : ''}
        </p>
        {result.fileName.includes('compressed') && (
          <p className="result-stat">
            Compression Result: {reduction >= 0 ? `${reduction}% smaller` : `${Math.abs(reduction)}% larger`}
          </p>
        )}
      </div>
      <div className="result-actions">
        <button type="button" className="button button-primary" onClick={() => onDownload(result)}>
          <DownloadIcon size={16} />
          <span>{result.fileName.endsWith('.docx') ? 'Download Word Document (.docx)' : 'Download Document'}</span>
        </button>
        {isPdf && (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const url = URL.createObjectURL(result.blob)
              window.open(url, '_blank', 'noopener,noreferrer')
              // Revoke after 60 s — enough time for the new tab to load the blob
              setTimeout(() => URL.revokeObjectURL(url), 60000)
            }}
          >
            <EyeIcon size={16} />
            <span>Live Preview</span>
          </button>
        )}
      </div>
    </section>
  )
}

function ServerUnavailable({ tool }: { tool: ToolDefinition }) {
  return (
    <section className="server-notice">
      <div className="tool-icon-avatar">
        <ShieldAlertIcon size={26} />
      </div>
      <div>
        <p className="eyebrow">SECURE SERVER ENGINE REQUIRED</p>
        <h2>{tool.name} requires a backend conversion microservice</h2>
        <p>
          This operation (such as faithful DOCX conversion or hardware HSM signature verification) requires a dedicated server engine for 100% format fidelity. KnowTheFile will never generate a dummy or corrupted file.
        </p>
        <Link className="button button-ghost" to="/security" style={{ marginTop: '16px' }}>
          <span>Explore Security Architecture</span>
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </section>
  )
}
