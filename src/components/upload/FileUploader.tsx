import { useId, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { UploadCloudIcon, FolderUploadIcon, TrashIcon, CheckIcon } from '../common/Icons'

interface Props {
  accept: string
  multiple?: boolean
  files: File[]
  onFiles: (files: File[]) => void
  label?: string
}

export function FileUploader({
  accept,
  multiple = false,
  files,
  onFiles,
  label = 'Drop your document here or browse'
}: Props) {
  const inputId = useId()
  const folderInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const isFileAccepted = (file: File) => {
    if (!accept || accept === '*' || accept === '*/*') return true
    const acceptedParts = accept.split(',').map((p) => p.trim().toLowerCase())
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    const mime = file.type.toLowerCase()

    return acceptedParts.some((part) => {
      if (part.startsWith('.')) {
        return ext === part
      }
      if (part.endsWith('/*')) {
        const typePrefix = part.replace('/*', '')
        return mime.startsWith(typePrefix)
      }
      return mime === part || ext === part
    })
  }

  const handleFiles = (incomingList: FileList | File[]) => {
    const rawFiles = Array.from(incomingList)
    const validFiles = rawFiles.filter(isFileAccepted)

    if (validFiles.length === 0) return

    if (multiple) {
      const existingKeys = new Set(files.map((f) => `${f.name}-${f.size}-${f.lastModified}`))
      const uniqueNewFiles = validFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`))
      onFiles([...files, ...uniqueNewFiles])
    } else {
      onFiles(validFiles.slice(0, 1))
    }
  }

  const triggerFileInput = (e?: MouseEvent) => {
    e?.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const triggerFolderInput = (e?: MouseEvent) => {
    e?.stopPropagation()
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
      folderInputRef.current.click()
    }
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => {
    setDragging(false)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files)
    }
  }

  const handleZoneClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('.file-row')) return
    triggerFileInput()
  }

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''} ${files.length > 0 ? 'has-files' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleZoneClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          triggerFileInput()
        }
      }}
      aria-label="Upload files or folder dropzone"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id={inputId}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => event.target.files && handleFiles(event.target.files)}
      />

      {/* Hidden Folder Input */}
      <input
        ref={folderInputRef}
        id={folderInputId}
        className="sr-only"
        type="file"
        // @ts-expect-error folder upload directory attribute
        webkitdirectory=""
        directory=""
        multiple
        onChange={(event) => event.target.files && handleFiles(event.target.files)}
      />

      <button
        type="button"
        className={`upload-glyph ${dragging || isHovered ? 'hovered' : ''}`}
        onClick={(e) => triggerFileInput(e)}
        title="Click to select files from device"
        aria-label="Upload file icon button"
      >
        {files.length > 0 ? (
          <CheckIcon size={30} />
        ) : (
          <UploadCloudIcon size={30} />
        )}
      </button>

      <strong>{label}</strong>
      <span>
        Drag and drop files here, or <span className="browse-highlight" onClick={(e) => triggerFileInput(e)}>browse files</span> / <span className="browse-highlight" onClick={(e) => triggerFolderInput(e)}>upload folder</span>
      </span>

      <div className="upload-actions-bar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="button button-primary upload-picker-btn"
          onClick={(e) => triggerFileInput(e)}
          title="Choose individual files from device"
        >
          <UploadCloudIcon size={16} />
          <span>{files.length > 0 ? (multiple ? 'Add Files' : 'Change File') : 'Select File'}</span>
        </button>

        <button
          type="button"
          className="button button-ghost upload-picker-btn"
          onClick={(e) => triggerFolderInput(e)}
          title="Choose a folder of files"
        >
          <FolderUploadIcon size={16} />
          <span>Upload Folder</span>
        </button>
      </div>

      <small>
        {accept.includes('pdf')
          ? 'Standard PDF files up to 100 MB · 100% on-device'
          : 'JPG, PNG, or WebP images up to 100 MB each'}
      </small>

      {files.length > 0 && (
        <div className="upload-file-list" onClick={(e) => e.stopPropagation()}>
          <div className="file-list-header">
            <span>Uploaded Files ({files.length})</span>
            {files.length > 1 && (
              <button
                type="button"
                className="text-button danger"
                onClick={() => onFiles([])}
                title="Clear all files"
              >
                Clear All
              </button>
            )}
          </div>
          {files.map((file, index) => (
            <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
              <span className="file-type">
                {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
              </span>
              <span className="file-name" title={file.name}>
                {file.name}
              </span>
              <em>{formatBytes(file.size)}</em>
              <button
                type="button"
                className="file-remove-btn"
                aria-label={`Remove ${file.name}`}
                title="Remove file"
                onClick={(e) => {
                  e.stopPropagation()
                  onFiles(files.filter((_, itemIndex) => itemIndex !== index))
                }}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`
}
