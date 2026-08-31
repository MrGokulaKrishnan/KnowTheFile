import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF documents into a single file in your custom order.', category: 'Organize', availability: 'browser', accent: 'merge-pdf', tag: 'Lossless' },
  { id: 'split-pdf', name: 'Split PDF', description: 'Separate pages into individual files or extract custom page ranges.', category: 'Organize', availability: 'browser', accent: 'split-pdf', tag: 'Fast' },
  { id: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate document pages by 90°, 180°, or 270° with live orientation preview.', category: 'Organize', availability: 'browser', accent: 'rotate-pdf', tag: 'Visual' },
  { id: 'extract-pdf', name: 'Extract Pages', description: 'Select and export only the specific pages you need into a new PDF.', category: 'Organize', availability: 'browser', accent: 'extract-pdf', tag: 'Precision' },
  { id: 'delete-pages', name: 'Delete Pages', description: 'Remove unnecessary or sensitive pages permanently from any document.', category: 'Organize', availability: 'browser', accent: 'delete-pages', tag: 'Clean' },
  { id: 'compress-pdf', name: 'Compress PDF', description: 'Optimize PDF structure to reduce file size while preserving high visual quality.', category: 'Organize', availability: 'browser', accent: 'compress-pdf', tag: 'Optimizer' },
  { id: 'image-to-pdf', name: 'Image to PDF', description: 'Convert JPG, PNG, or WebP images into a crisp, unified PDF document.', category: 'Create', availability: 'browser', accent: 'image-to-pdf', tag: 'High-Res' },
  { id: 'watermark-pdf', name: 'Watermark PDF', description: 'Stamp custom semi-transparent text watermarks across selected pages.', category: 'Edit', availability: 'browser', accent: 'watermark-pdf', tag: 'Protection' },
  { id: 'page-numbers', name: 'Add Page Numbers', description: 'Stamp automated sequential page numbering with customized positioning.', category: 'Edit', availability: 'browser', accent: 'page-numbers', tag: 'Layout' },
  { id: 'metadata-pdf', name: 'Edit Metadata', description: 'Inspect and modify title, author, subject, and keyword document tags.', category: 'Edit', availability: 'browser', accent: 'metadata-pdf', tag: 'Inspector' },
  { id: 'pdf-editor', name: 'PDF Editor', description: 'Add dynamic text overlays, notes, and annotations in a live studio canvas.', category: 'Edit', availability: 'browser', accent: 'pdf-editor', tag: 'Studio' },
  { id: 'pdf-to-image', name: 'PDF to Image', description: 'Render high-resolution PNG or JPG image exports from PDF pages.', category: 'Convert', availability: 'browser', accent: 'pdf-to-image', tag: '300 DPI' },
  { id: 'pdf-to-text', name: 'PDF to Text', description: 'Extract all readable document text directly into clean, searchable copy.', category: 'Convert', availability: 'browser', accent: 'pdf-to-text', tag: 'Direct OCR' },
  { id: 'pdf-to-word', name: 'PDF to Word', description: 'Convert PDF documents into editable Microsoft Word DOCX formatting.', category: 'Convert', availability: 'server', accent: 'pdf-to-word', tag: 'DOCX' },
  { id: 'word-to-pdf', name: 'Word to PDF', description: 'Transform DOCX files into standard, faithfully rendered PDF documents.', category: 'Convert', availability: 'server', accent: 'word-to-pdf', tag: 'Converter' },
  { id: 'sign-pdf', name: 'Sign PDF', description: 'Draw and place visual signature stamps across document signature fields.', category: 'Secure', availability: 'server', accent: 'sign-pdf', tag: 'Signature' },
  { id: 'protect-pdf', name: 'Protect PDF', description: 'Encrypt sensitive documents with standard AES password security.', category: 'Secure', availability: 'server', accent: 'protect-pdf', tag: 'AES-256' },
  { id: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove password protection from authorized documents with your passphrase.', category: 'Secure', availability: 'server', accent: 'unlock-pdf', tag: 'Decryption' },
]

export const findTool = (id: string) => tools.find((tool) => tool.id === id)
