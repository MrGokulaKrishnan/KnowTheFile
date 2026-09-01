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
  ShieldAlertIcon
} from '../common/Icons'

export function ToolRunner({ tool }: { tool: ToolDefinition }) {
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProcessedDocument | null>(null)
  const [manyResults, setManyResults] = useState<ProcessedDocument[]>([])
  const [range, setRange] = useState('')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [angle, setAngle] = useState(90)
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right'>('bottom-center')
  const [imageFit, setImageFit] = useState<'fit' | 'original'>('fit')
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png')
  const [metadata, setMetadata] = useState({ title: '', author: '', subject: '', keywords: '' })
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
  }, [tool.id])

  useEffect(() => {
    if (!first || imageTool || wordTool) return
    void browserDocumentProcessor
      .inspect(first)
      .then((data) => {
        setPageCount(data.pageCount)
        setMetadata((previous) => ({ ...previous, title: data.title, author: data.author }))
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not read this PDF.'))
  }, [first, imageTool, wordTool])

  const rangeIsNeeded = ['split-pdf', 'extract-pdf', 'delete-pages', 'rotate-pdf'].includes(tool.id)

  const settings = useMemo(() => {
    if (tool.id === 'rotate-pdf') {
      return (
        <label>
          Rotation Angle
          <select value={angle} onChange={(event) => setAngle(Number(event.target.value))}>
            <option value={90}>90° Clockwise</option>
            <option value={180}>180° Flip</option>
            <option value={270}>270° Clockwise (90° CCW)</option>
          </select>
        </label>
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
        <label>
          Export Format
          <select value={imageFormat} onChange={(event) => setImageFormat(event.target.value as typeof imageFormat)}>
            <option value="png">PNG (Lossless & Crisp)</option>
            <option value="jpg">JPG (Smaller Size)</option>
          </select>
        </label>
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
    if (tool.id === 'pdf-to-word') {
      return (
        <div className="tool-info-card">
          <p style={{ margin: 0, fontSize: '13px', color: '#d4d4d4', lineHeight: 1.6 }}>
            Extracts PDF text, paragraphs, and headings directly into an editable Microsoft Word (.docx) file on your machine.
          </p>
        </div>
      )
    }
    if (tool.id === 'word-to-pdf') {
      return (
        <div className="tool-info-card">
          <p style={{ margin: 0, fontSize: '13px', color: '#d4d4d4', lineHeight: 1.6 }}>
            Transforms Microsoft Word (.docx) documents into clean, standardized vector PDF pages with headers and page numbers.
          </p>
        </div>
      )
    }
    return null
  }, [tool.id, angle, watermark, position, imageFit, imageFormat, metadata])

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

    setStatus('processing')
    try {
      let processed: ProcessedDocument | undefined
      let splitResults: ProcessedDocument[] = []
      const pages = rangeIsNeeded && range.trim() ? parsePageRange(range, pageCount ?? 0) : { pages: [] }
      if (pages.error) throw new Error(pages.error)

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
          processed = await browserDocumentProcessor.compress(first!)
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
          processed = await pdfToImages(first!, imageFormat)
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
        default:
          throw new Error('This tool is not connected yet.')
      }

      if (processed && processed.blob.size === 0) {
        throw new Error('The output file was empty, so it was discarded.')
      }

      setResult(processed ?? null)
      setManyResults(splitResults)
      setStatus('completed')
      toast.show('Your document is ready.', 'success')
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
    anchor.click()
    URL.revokeObjectURL(url)
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
                  multiple
                    ? 'Drop files here or browse multiple'
                    : wordTool
                    ? 'Drop your Word document (.docx) here or browse'
                    : 'Drop your document here or browse'
                }
              />
              {pageCount && (
                <div className="file-insight">
                  <ShieldCheckIcon size={16} />
                  <span>Document loaded · {pageCount} {pageCount === 1 ? 'page' : 'pages'} verified</span>
                </div>
              )}
            </div>

            <aside className="settings-card">
              <h2>Tool Configuration</h2>
              {rangeIsNeeded && (
                <label>
                  Target Pages
                  <input
                    value={range}
                    onChange={(event) => setRange(event.target.value)}
                    placeholder={tool.id === 'split-pdf' ? 'Leave blank for all pages' : 'e.g. 1-3, 5'}
                  />
                  <small>
                    {tool.id === 'delete-pages'
                      ? 'Specified pages will be removed permanently from the result.'
                      : 'Separate page numbers and ranges with commas.'}
                  </small>
                </label>
              )}
              {settings}
              <button
                type="button"
                className="button button-primary process-button"
                disabled={status === 'processing' || !files.length}
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
                    <span>Process {tool.name}</span>
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
        {result.fileName.includes('optimized') && (
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
