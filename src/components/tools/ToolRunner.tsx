import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Link } from 'react-router-dom'
import { browserDocumentProcessor, parsePageRange, serverDocumentProcessor } from '../../services/documentProcessor'
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

  const togglePageInCustomRange = (pageNumber: number) => {
    const current = range.split(',').map((s) => s.trim()).filter(Boolean)
    const pageStr = String(pageNumber)
    let next: string[]
    if (current.includes(pageStr)) {
      next = current.filter((p) => p !== pageStr)
    } else {
      next = [...current, pageStr].sort((a, b) => Number(a) - Number(b))
    }
    setRange(next.join(', '))
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
            <div>
              <label>
                Page Range or Numbers
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="e.g. 1-3, 5"
                />
              </label>
              {pageCount && pageCount > 1 && pageCount <= 24 && (
                <div style={{ marginTop: '10px' }}>
                  <small style={{ color: '#a3a3a3', display: 'block', marginBottom: '6px' }}>Click to select pages:</small>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => {
                      const isSelected = range.split(',').map((s) => s.trim()).includes(String(num))
                      return (
                        <button
                          type="button"
                          key={num}
                          onClick={() => togglePageInCustomRange(num)}
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
          )}
        </div>
      )
    }
    if (tool.id === 'rotate-pdf') {
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
              placeholder="Leave blank for entire document or enter e.g. 1, 3"
            />
            <small style={{ color: '#737373', marginTop: '4px', display: 'block' }}>
              Leave blank to rotate all pages in the PDF.
            </small>
          </label>
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
    return null
  }, [tool.id, compressLevel, splitMode, range, pageCount, angle, watermark, signature, password, position, imageFit, imageFormat, imageDpi, metadata])

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
            onClick={() => window.open(URL.createObjectURL(result.blob), '_blank', 'noopener,noreferrer')}
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
