import { useEffect, useState, Component, type ReactNode, type FormEvent, type PropsWithChildren } from 'react'
import { Navigate, Route, Routes, Link, useLocation, useSearchParams } from 'react-router-dom'
import { PublicShell, WorkspaceShell } from './components/layout/AppShell'
import { Brand } from './components/common/Brand'
import { useAuth } from './components/auth/AuthProvider'
import { findTool, tools } from './config/tools'
import { ToolRunner } from './components/tools/ToolRunner'
import { PDFEditorPage } from './pages/PDFEditorPage'
import { ReportBugModal } from './components/support/ReportBugModal'
import { useToast } from './components/common/Toast'
import { historyService, type DocumentHistoryEntry } from './services/historyService'
import { formatBytes } from './components/upload/FileUploader'
import {
  ToolIconRenderer,
  ArrowRightIcon,
  CheckIcon,
  SearchIcon,
  ShieldCheckIcon,
  CpuIcon,
  ZapIcon,
  SparklesIcon,
  FolderIcon,
  LayersIcon,
  CloseIcon,
  HelpIcon,
  EditorIcon,
  BugIcon,
  TrashIcon
} from './components/common/Icons'

const categories = ['All', 'Organize', 'Create', 'Edit', 'Convert', 'Secure'] as const

interface PageMetaProps {
  title: string
  description: string
  canonicalPath?: string
  keywords?: string
  schemaJson?: object
}

function PageMeta({ title, description, canonicalPath = '/', keywords, schemaJson }: PageMetaProps) {
  useEffect(() => {
    const fullTitle = title.includes('KnowTheFile') ? title : `${title} — KnowTheFile`
    document.title = fullTitle

    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let el = document.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        if (isProperty) el.setAttribute('property', name)
        else el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    updateMeta('title', fullTitle)
    updateMeta('description', description)
    if (keywords) updateMeta('keywords', keywords)

    const fullCanonical = `https://knowthefile.web.app${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', fullCanonical)

    updateMeta('og:title', fullTitle, true)
    updateMeta('og:description', description, true)
    updateMeta('og:url', fullCanonical, true)
    updateMeta('twitter:title', fullTitle)
    updateMeta('twitter:description', description)
    updateMeta('twitter:url', fullCanonical)

    let scriptTag = document.getElementById('page-schema') as HTMLScriptElement | null
    if (schemaJson) {
      if (!scriptTag) {
        scriptTag = document.createElement('script')
        scriptTag.id = 'page-schema'
        scriptTag.type = 'application/ld+json'
        document.head.appendChild(scriptTag)
      }
      scriptTag.textContent = JSON.stringify(schemaJson)
    } else if (scriptTag) {
      scriptTag.remove()
    }
  }, [title, description, canonicalPath, keywords, schemaJson])

  return null
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled KnowTheFile Studio runtime error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '480px', width: '100%', background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,210,26,0.3)', borderRadius: '16px', padding: '32px', textAlign: 'center', color: '#ffffff' }}>
            <h2 style={{ fontSize: '24px', margin: '0 0 12px', color: '#ffd21a' }}>Document Studio Encountered an Issue</h2>
            <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Your file data remained 100% private in local browser memory. Click below to reload the studio cleanly.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              style={{ width: '100%', minHeight: '44px' }}
            >
              Reload KnowTheFile Studio
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    // Prevent browser from automatically restoring previous scroll offset on SPA route changes
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    if (hash) {
      const id = hash.replace('#', '')
      const targetElement = document.getElementById(id)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }

    if (typeof window !== 'undefined') {
      const html = document.documentElement
      const originalBehavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, 0)
      html.scrollTop = 0
      document.body.scrollTop = 0

      const mainEl = document.querySelector('main')
      if (mainEl) mainEl.scrollTop = 0
      const shellEl = document.querySelector('.site-shell')
      if (shellEl) shellEl.scrollTop = 0
      const workspaceEl = document.querySelector('.workspace-main')
      if (workspaceEl) workspaceEl.scrollTop = 0

      requestAnimationFrame(() => {
        html.style.scrollBehavior = originalBehavior
      })
    }
  }, [pathname, search, hash])

  return null
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <ScrollToTop />
      <Routes>
      <Route
        path="/"
        element={
          <PublicShell>
            <HomePage />
          </PublicShell>
        }
      />
      <Route
        path="/tools"
        element={
          <PublicShell>
            <ToolsPage />
          </PublicShell>
        }
      />
      <Route
        path="/tools/:toolId"
        element={
          <PublicShell>
            <ToolPage />
          </PublicShell>
        }
      />
      <Route
        path="/pricing"
        element={
          <PublicShell>
            <PricingPage />
          </PublicShell>
        }
      />
      <Route
        path="/about"
        element={
          <PublicShell>
            <SimplePage
              title="About KnowTheFile"
              copy="We are engineering private, high-performance browser-accelerated document workflows with zero cloud latency."
            />
          </PublicShell>
        }
      />
      <Route
        path="/contact"
        element={
          <PublicShell>
            <ContactPage />
          </PublicShell>
        }
      />
      <Route
        path="/help"
        element={
          <PublicShell>
            <HelpPage />
          </PublicShell>
        }
      />
      <Route path="/support" element={<SupportRoute />} />
      {[
        'privacy',
        'terms',
        'cookies',
        'cookie-preferences',
        'refund-policy',
        'cancellation-policy',
        'disclaimer',
        'accessibility',
        'security',
        'acceptable-use',
        'responsible-disclosure',
        'data-processing'
      ].map((slug) => (
        <Route
          key={slug}
          path={`/${slug}`}
          element={
            <PublicShell>
              <LegalPage slug={slug} />
            </PublicShell>
          }
        />
      ))}
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage mode="reset" />} />
      <Route path="/verify-email" element={<AuthPage mode="verify" />} />
      <Route path="/session-expired" element={<AuthPage mode="session" />} />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <WorkspaceShell>
              <OnboardingPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <WorkspaceShell>
              <DashboardPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/files"
        element={
          <Protected>
            <WorkspaceShell>
              <FilesPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected>
            <WorkspaceShell>
              <HistoryPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <WorkspaceShell>
              <SettingsPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <WorkspaceShell>
              <SettingsPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/billing"
        element={
          <Protected>
            <WorkspaceShell>
              <BillingPage />
            </WorkspaceShell>
          </Protected>
        }
      />
      <Route
        path="/upgrade"
        element={
          <PublicShell>
            <BillingUnavailable title="Upgrade unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/downgrade"
        element={
          <PublicShell>
            <BillingUnavailable title="Downgrade unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/cancel"
        element={
          <PublicShell>
            <BillingUnavailable title="Cancellation unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/payment-success"
        element={
          <PublicShell>
            <BillingUnavailable title="Payment status unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/payment-failed"
        element={
          <PublicShell>
            <BillingUnavailable title="Payment status unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/payment-pending"
        element={
          <PublicShell>
            <BillingUnavailable title="Payment status unavailable" />
          </PublicShell>
        }
      />
      <Route
        path="/403"
        element={
          <PublicShell>
            <SimplePage
              title="Access Restricted"
              copy="You do not have permission to view this resource."
            />
          </PublicShell>
        }
      />
      <Route
        path="/500"
        element={
          <PublicShell>
            <SimplePage
              title="Unexpected Exception"
              copy="Something went wrong. Return to the directory or restart your workflow."
            />
          </PublicShell>
        }
      />
      <Route
        path="/maintenance"
        element={
          <PublicShell>
            <SimplePage
              title="System Maintenance"
              copy="We are deploying improvements to the browser engine. Please check back shortly."
            />
          </PublicShell>
        }
      />
      <Route
        path="*"
        element={
          <PublicShell>
            <NotFoundPage />
          </PublicShell>
        }
      />
    </Routes>
  </GlobalErrorBoundary>
  )
}

function HomePage() {
  return (
    <>
      <PageMeta
        title="KnowTheFile - 100% Private, On-Device PDF & Document Suite"
        description="Merge, split, compress, edit, convert, and secure PDF documents directly inside your browser. 100% private, client-side WebAssembly execution with zero server uploads."
        canonicalPath="/"
        keywords="PDF tools, merge PDF, split PDF, compress PDF, PDF editor online, convert PDF, edit PDF, free PDF tools, private PDF tools, on-device document processing, knowthefile"
      />

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="pill-badge">
            <span className="dot" />
            <span>100% On-Device Engine · Zero Server Uploads</span>
          </div>
          <h1>
            Every file.<br />
            <span>One liquid workspace.</span>
          </h1>
          <p className="hero-lede">
            Enterprise-grade document tools engineered for privacy and speed. Merge, split, compress, and edit PDF documents directly inside your browser with instant client-side execution.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/tools">
              <span>Explore All 19 Tools</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link className="button button-ghost" to="/tools/pdf-editor">
              <EditorIcon size={16} />
              <span>Open PDF Studio</span>
            </Link>
          </div>
          <div className="trust-row">
            <span className="trust-item">
              <ShieldCheckIcon size={16} /> Instant Local Processing
            </span>
            <span className="trust-item">
              <CpuIcon size={16} /> 100 MB Browser Limit
            </span>
            <span className="trust-item">
              <SparklesIcon size={16} /> No Sign-up Required
            </span>
          </div>
        </div>
      </section>

      {/* Metric Strip */}
      <section className="metric-strip">
        <div className="metric-item">
          <div className="metric-icon-wrap">
            <CpuIcon size={26} />
          </div>
          <div className="metric-info">
            <b>19</b>
            <span>Browser-Accelerated Tools</span>
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-icon-wrap">
            <ShieldCheckIcon size={26} />
          </div>
          <div className="metric-info">
            <b>0</b>
            <span>Files Uploaded to Cloud</span>
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-icon-wrap">
            <ZapIcon size={26} />
          </div>
          <div className="metric-info">
            <b>100 MB</b>
            <span>Per-Document Local Limit</span>
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Section */}
      <section className="feature-section">
        <div className="section-heading">
          <p className="eyebrow">BUILT FOR SPEED & SECURITY</p>
          <h2>
            Essential document work,<br />
            engineered without compromise.
          </h2>
        </div>
        <div className="feature-cards">
          <FeatureCard
            number="01"
            icon={<LayersIcon size={22} />}
            title="Organize & Structure"
            copy="Merge multiple PDFs, split ranges, reorder pages, or rotate orientations with instant real-time canvas feedback."
          />
          <FeatureCard
            number="02"
            icon={<CpuIcon size={22} />}
            title="Local Processing Engine"
            copy="All heavy document operations run directly on your hardware using modern WebAssembly and canvas technologies."
          />
          <FeatureCard
            number="03"
            icon={<ShieldCheckIcon size={22} />}
            title="Guaranteed Privacy"
            copy="Your sensitive documents never leave your device. Complete document transformations without third-party exposure."
          />
        </div>
      </section>

      {/* Tool Showcase Preview */}
      <section className="tool-preview">
        <div>
          <p className="eyebrow">POPULAR WORKFLOWS</p>
          <h2>
            Focused document tools.<br />
            <span>One dependable suite.</span>
          </h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.7', marginBottom: '30px' }}>
            Merge reports, extract key pages, stamp confidential watermarks, or convert image stacks to high-resolution PDFs directly on your device.
          </p>
          <Link className="button button-primary" to="/tools">
            <span>Browse Complete Directory</span>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <div className="mini-tool-grid">
          {tools
            .filter((tool) => tool.availability === 'browser')
            .slice(0, 6)
            .map((tool) => (
              <Link to={`/tools/${tool.id}`} key={tool.id} className="mini-tool">
                <div className="tool-icon-disc">
                  <ToolIconRenderer name={tool.id} size={20} />
                </div>
                <div>
                  <strong>{tool.name}</strong>
                  <small>On-Device</small>
                </div>
              </Link>
            ))}
        </div>
      </section>

      {/* Workflow Steps */}
      <section className="how-section">
        <p className="eyebrow">CLEAR FOUR-STEP PIPELINE</p>
        <h2>Streamlined from upload to download.</h2>
        <div className="steps">
          <Step
            number="1"
            title="Select File"
            copy="Drop any supported PDF or image document from your device into the workspace."
          />
          <Step
            number="2"
            title="Configure"
            copy="Fine-tune page ranges, rotation angles, metadata, or watermark placement."
          />
          <Step
            number="3"
            title="Process"
            copy="Watch real-time on-device computation without waiting on network uploads."
          />
          <Step
            number="4"
            title="Export"
            copy="Inspect your document with live preview and download the verified output."
          />
        </div>
      </section>
    </>
  )
}

function FeatureCard({
  number,
  icon,
  title,
  copy
}: {
  number: string
  icon: React.ReactNode
  title: string
  copy: string
}) {
  return (
    <article className="feature-card">
      <div className="feature-card-header">
        <span className="feature-number">STEP {number}</span>
        <div className="feature-icon-badge">{icon}</div>
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  )
}

function Step({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <article className="step">
      <div className="step-num">{number}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  )
}

function ToolsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const category = params.get('category') ?? 'All'

  const filtered = tools.filter(
    (tool) =>
      (category === 'All' || tool.category === category) &&
      `${tool.name} ${tool.description}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <section className="page-section tools-page">
      <PageMeta
        title="All 19 PDF & Document Tools — KnowTheFile"
        description="Browse the complete directory of 19 private, browser-accelerated PDF tools. Merge, split, compress, edit, sign, convert, and protect documents."
        canonicalPath="/tools"
        keywords="pdf tools directory, all pdf tools, merge pdf, split pdf, compress pdf, convert docx to pdf, image to pdf, pdf editor"
      />
      <p className="eyebrow">Document Toolkit</p>
      <h1>
        Find the exact tool<br />
        <span>for your document workflow.</span>
      </h1>
      <p className="page-lede">
        Tools running on-device are marked as client-ready. Operations requiring dedicated microservices are clearly identified with security notes.
      </p>

      <div className="tool-controls">
        <div className="search-box">
          <SearchIcon size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search across all 19 tools (e.g. merge, compress, watermark)…"
            aria-label="Search tools"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: '#a3a3a3', padding: 0, cursor: 'pointer' }}
              aria-label="Clear search"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div className="filters" aria-label="Tool categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'active' : ''}
              onClick={() => setParams(item === 'All' ? {} : { category: item })}
            >
              <span>{item}</span>
              <small style={{ opacity: 0.7 }}>
                (
                {item === 'All'
                  ? tools.length
                  : tools.filter((t) => t.category === item).length}
                )
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="tool-directory">
        {filtered.map((tool) => (
          <Link className="directory-card" to={`/tools/${tool.id}`} key={tool.id}>
            <div className="tool-icon-avatar">
              <ToolIconRenderer name={tool.id} size={22} />
            </div>
            <div className="directory-card-body">
              <div className="card-top-row">
                <span className={`availability ${tool.availability}`}>
                  {tool.availability === 'browser' ? '✦ Client-Side' : '⚡ Server'}
                </span>
                {tool.tag && <span className="card-tag">{tool.tag}</span>}
              </div>
              <h2>{tool.name}</h2>
              <p>{tool.description}</p>
            </div>
            <div className="card-arrow">
              <ArrowRightIcon size={16} />
            </div>
          </Link>
        ))}
      </div>

      {!filtered.length && (
        <div className="empty-state">
          <SearchIcon size={36} color="#ffd21a" />
          <h2>No matching document tools found</h2>
          <p>We couldn’t find any tools matching “{query}”. Try adjusting your keywords or browse all categories.</p>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setQuery('')
              setParams({})
            }}
          >
            Reset Filters
          </button>
        </div>
      )}
    </section>
  )
}

function ToolPage() {
  const { toolId } = useParamsTyped()
  if (toolId === 'pdf-editor' || toolId === 'pdf-word-editor') {
    const isWord = toolId === 'pdf-word-editor'
    return (
      <>
        <PageMeta
          title={isWord ? "Word-Style PDF Editor — Flow, Edit & Reflow Documents" : "Free Online PDF Editor — In-Place Text Editing & Canvas Studio"}
          description={isWord ? "Edit PDF text like Microsoft Word with flowing paragraphs, rich typography, and instant PDF/DOCX export." : "Edit PDF files directly in your browser. Click any text to edit in-place, add notes, and annotations privately without server uploads."}
          canonicalPath={isWord ? "/tools/pdf-word-editor" : "/tools/pdf-editor"}
          keywords={isWord ? "word pdf editor, edit pdf like word, convert pdf to word online, flow pdf text, private word editor" : "online pdf editor, edit pdf free, annotate pdf, add text to pdf, private pdf editor"}
          schemaJson={{
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": isWord ? "KnowTheFile Word-Style PDF Editor" : "KnowTheFile PDF Editor",
            "operatingSystem": "All",
            "applicationCategory": "UtilitiesApplication",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "description": isWord ? "Flowing Word-style document editor for PDFs. Type, edit paragraphs, format typography, and export to PDF or DOCX." : "Interactive online studio to edit, annotate, and click-to-edit text on PDF files directly in your browser."
          }}
        />
        <PDFEditorPage defaultMode={isWord ? 'word' : 'canvas'} />
      </>
    )
  }
  const tool = findTool(toolId ?? '')
  if (!tool) return <NotFoundPage />

  return (
    <>
      <PageMeta
        title={`${tool.name} — Free Online Tool (100% Private)`}
        description={`${tool.description} Fast, secure, client-side execution with zero cloud storage uploads.`}
        canonicalPath={`/tools/${tool.id}`}
        keywords={`${tool.name}, ${tool.name.toLowerCase()} online, free ${tool.name.toLowerCase()}, private ${tool.name.toLowerCase()}, knowthefile`}
        schemaJson={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": `KnowTheFile ${tool.name}`,
          "operatingSystem": "All",
          "applicationCategory": "UtilitiesApplication",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": tool.description
        }}
      />
      <ToolRunner tool={tool} />
    </>
  )
}

function useParamsTyped() {
  const location = useLocation()
  const parts = location.pathname.split('/')
  return { toolId: parts[2] }
}

function PricingPage() {
  return (
    <section className="page-section pricing-page">
      <PageMeta
        title="Transparent Pricing & Architecture — KnowTheFile"
        description="Explore KnowTheFile pricing. All 19 core on-device document tools are 100% free and client-side today."
        canonicalPath="/pricing"
        keywords="free pdf tools, pdf editor pricing, document processing cost, knowthefile plans"
      />
      <p className="eyebrow">Transparent Architecture</p>
      <h1>Simple plans. Clear limits.</h1>
      <p className="page-lede">
        All browser-ready document tools are 100% free and client-side today. Cloud storage sync and backend conversion will be optional add-ons.
      </p>

      <div className="pricing-grid">
        <Plan
          name="Community Free"
          price="₹0"
          description="Everything you need for private, unlimited on-device document operations."
          features={[
            'All 19 browser-ready tools',
            '100% private on-device execution',
            '100 MB per-file processing limit',
            'Zero cloud tracking or retention'
          ]}
        />
        <Plan
          name="Pro Workspace"
          price="Coming Soon"
          description="For power users requiring dedicated server conversions and encrypted storage."
          featured
          features={[
            'Everything in Community Free',
            'DOCX to PDF & Word conversions',
            'Firebase cloud file backup & sync',
            'Up to 500 MB file processing limit'
          ]}
        />
        <Plan
          name="Enterprise Team"
          price="Custom"
          description="For teams needing centralized document policies, SSO, and audit compliance."
          features={[
            'Shared team workspaces',
            'Custom retention & compliance policies',
            'Dedicated private compute endpoints',
            'Priority 24/7 technical support'
          ]}
        />
      </div>
    </section>
  )
}

function Plan({
  name,
  price,
  description,
  features,
  featured = false
}: {
  name: string
  price: string
  description: string
  features: string[];
  featured?: boolean
}) {
  return (
    <article className={`plan ${featured ? 'featured' : ''}`}>
      {featured && <span className="plan-badge">MOST POPULAR</span>}
      <h2>{name}</h2>
      <p>{description}</p>
      <strong className="price">{price}</strong>
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <CheckIcon size={16} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        className={`button ${featured ? 'button-primary' : 'button-ghost'}`}
        to={featured ? '/billing' : '/tools'}
      >
        <span>{featured ? 'View Plan Status' : 'Start Free Now'}</span>
        <ArrowRightIcon size={16} />
      </Link>
    </article>
  )
}

function AuthPage({
  mode
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'session'
}) {
  const { service, configured, user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = new URLSearchParams(location.search).get('next') || '/dashboard'

  const title: Record<typeof mode, string> = {
    login: 'Welcome Back',
    register: 'Create Your Workspace',
    forgot: 'Reset Password',
    reset: 'Set New Password',
    verify: 'Verify Email Address',
    session: 'Session Expired'
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await service.login(email, password)
      else if (mode === 'register') await service.register(email, password)
      else if (mode === 'forgot') await service.resetPassword(email)
      else if (mode === 'verify' && user) await service.resendVerification(user)
      else if (mode === 'reset')
        throw new Error('Password reset links are handled securely via Firebase email dispatch.')

      toast.show(
        mode === 'forgot'
          ? 'Password reset instructions dispatched.'
          : mode === 'verify'
          ? 'Verification email sent.'
          : 'Authentication successful.',
        'success'
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication operation failed.')
    } finally {
      setBusy(false)
    }
  }

  if (user && (mode === 'login' || mode === 'register')) return <Navigate to={next} replace />

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Brand />
        <p className="eyebrow">SECURE ACCESS</p>
        <h1>{title[mode]}</h1>

        {!configured && (
          <div className="notice notice-error">
            <strong>Firebase Configuration Required</strong>
            <span>Add the public VITE_FIREBASE_* credentials from .env.example to activate user authentication.</span>
          </div>
        )}

        {mode === 'session' ? (
          <>
            <p style={{ color: '#a3a3a3', lineHeight: 1.7 }}>
              Your workspace session expired. Please sign in again to continue managing documents.
            </p>
            <Link className="button button-primary" to="/login">
              <span>Sign In Again</span>
              <ArrowRightIcon size={16} />
            </Link>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            {!['verify'].includes(mode) && (
              <label>
                Email Address
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@domain.com"
                />
              </label>
            )}

            {['login', 'register', 'reset'].includes(mode) && (
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={!configured || busy || (mode === 'verify' && !user)}
              className="button button-primary auth-submit"
            >
              <span>
                {busy
                  ? 'Authenticating…'
                  : mode === 'forgot'
                  ? 'Send Reset Email'
                  : mode === 'verify'
                  ? 'Resend Verification'
                  : mode === 'register'
                  ? 'Create Free Account'
                  : 'Continue to Workspace'}
              </span>
              <ArrowRightIcon size={16} />
            </button>

            {mode === 'login' && (
              <>
                <button
                  type="button"
                  className="button button-ghost auth-submit"
                  disabled={!configured || busy}
                  onClick={() =>
                    void service
                      .loginWithGoogle()
                      .catch((reason: unknown) =>
                        setError(reason instanceof Error ? reason.message : 'Google sign-in failed.')
                      )
                  }
                >
                  <span>Continue with Google</span>
                </button>
                <Link className="text-button" to="/forgot-password" style={{ marginTop: '6px' }}>
                  Forgot your password?
                </Link>
              </>
            )}

            {error && <p className="notice notice-error">{error}</p>}
          </form>
        )}

        {mode === 'login' && (
          <p className="privacy-note" style={{ marginTop: '24px' }}>
            New to KnowTheFile? <Link to="/register" style={{ color: '#ffd21a', fontWeight: 800 }}>Create an account</Link>
          </p>
        )}
        {mode === 'register' && (
          <p className="privacy-note" style={{ marginTop: '24px' }}>
            Already registered? <Link to="/login" style={{ color: '#ffd21a', fontWeight: 800 }}>Log in</Link>
          </p>
        )}
      </div>

      <aside className="auth-aside">
        <div className="auth-aside-content">
          <div className="pill-badge">
            <span className="dot" />
            <span>Private & Encrypted</span>
          </div>
          <h2>Your documents stay yours.</h2>
          <p>
            Authentication securely protects your account profile. All core document transformations remain 100% client-side and never require an account.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Protected({ children }: PropsWithChildren) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()
  if (loading) return <div className="screen-loader">Loading secure workspace…</div>
  if (!configured || !user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  return <>{children}</>
}

function DashboardPage() {
  const [profile, setProfile] = useState<{ name?: string; useCase?: string } | null>(null)
  const [historyCount, setHistoryCount] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ktf_onboarding')
      if (saved) setProfile(JSON.parse(saved))
      setHistoryCount(historyService.getEntries().length)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="dashboard">
      <section className="result-card" style={{ marginTop: 0 }}>
        <div>
          <p className="eyebrow">
            {profile?.name ? `WELCOME BACK, ${profile.name.toUpperCase()}` : 'ON-DEVICE WORKSPACE'}
          </p>
          <h2>{profile?.useCase ? `${profile.useCase} Studio` : '100% Private Document Workspace'}</h2>
          <p>
            {historyCount > 0
              ? `You have processed ${historyCount} document${historyCount === 1 ? '' : 's'} on-device with zero cloud exposure.`
              : 'All 19 document operations run directly in your browser tab. Zero files uploaded to remote servers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="button button-primary" to="/history">
            <span>Audit Trail</span>
            <ArrowRightIcon size={16} />
          </Link>
          <Link className="button button-ghost" to="/files">
            <span>Local Vault</span>
          </Link>
        </div>
      </section>

      <section className="feature-card" style={{ minHeight: 'auto' }}>
        <p className="eyebrow">QUICK ACTIONS</p>
        <h2 style={{ fontSize: '20px', marginBottom: '18px' }}>Launch Studio Tools</h2>
        <div className="mini-tool-grid">
          {['pdf-word-editor', 'pdf-editor', 'protect-pdf', 'merge-pdf', 'compress-pdf', 'split-pdf'].map((id) => {
            const tool = findTool(id)
            return (
              tool && (
                <Link key={id} to={`/tools/${id}`} className="mini-tool">
                  <div className="tool-icon-disc">
                    <ToolIconRenderer name={tool.id} size={18} />
                  </div>
                  <div>
                    <strong>{tool.name}</strong>
                    <small>{tool.tag}</small>
                  </div>
                </Link>
              )
            )
          })}
        </div>
      </section>

      {historyCount === 0 ? (
        <EmptyWorkspacePage
          title="No recent documents processed"
          copy="Documents processed in any of the 19 on-device tools will automatically record here in your private audit trail."
          action="Start a Document Workflow"
        />
      ) : (
        <section className="feature-card" style={{ minHeight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">RECENT AUDIT TRAIL</p>
              <h2 style={{ fontSize: '20px', margin: 0 }}>Latest Operations</h2>
            </div>
            <Link to="/history" className="text-button">View All ({historyCount})</Link>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {historyService.getEntries().slice(0, 3).map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="tool-icon-disc" style={{ width: '36px', height: '36px' }}>
                    <ToolIconRenderer name={item.toolId} size={16} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px' }}>{item.outputName}</strong>
                    <small style={{ color: '#a3a3a3', fontSize: '12px' }}>
                      {item.toolName} · {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="availability browser" style={{ fontSize: '11px', display: 'inline-block' }}>✓ Verified On-Device</span>
                  <small style={{ display: 'block', color: '#737373', fontSize: '11px', marginTop: '2px' }}>{formatBytes(item.outputBytes)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function OnboardingPage() {
  const [name, setName] = useState(() => {
    try {
      const saved = localStorage.getItem('ktf_onboarding')
      return saved ? JSON.parse(saved).name ?? '' : ''
    } catch {
      return ''
    }
  })
  const [useCase, setUseCase] = useState(() => {
    try {
      const saved = localStorage.getItem('ktf_onboarding')
      return saved ? JSON.parse(saved).useCase ?? 'Personal documents' : 'Personal documents'
    } catch {
      return 'Personal documents'
    }
  })
  const [done, setDone] = useState(false)

  const handleComplete = () => {
    try {
      localStorage.setItem('ktf_onboarding', JSON.stringify({ name, useCase, updatedAt: Date.now() }))
    } catch (e) {
      console.warn('Could not save onboarding profile:', e)
    }
    setDone(true)
  }

  if (done) return <Navigate to="/dashboard" replace />

  return (
    <section className="feature-card" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <p className="eyebrow">WELCOME TO KNOWTHEFILE</p>
      <h2 style={{ fontSize: '24px' }}>Customize your workspace experience.</h2>
      <p style={{ color: '#a3a3a3', margin: '12px 0 20px' }}>
        Preferences are securely saved locally on this device to personalize your dashboard.
      </p>
      <div style={{ display: 'grid', gap: '16px' }}>
        <label>
          Your Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="How should we address you?"
            maxLength={80}
          />
        </label>
        <label>
          Primary Workflow
          <select value={useCase} onChange={(event) => setUseCase(event.target.value)}>
            <option>Personal documents</option>
            <option>Freelance & Creative work</option>
            <option>Business & Enterprise</option>
            <option>Academic & Research</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '10px' }}>
          <button type="button" className="button button-primary" onClick={handleComplete}>
            <span>Continue to Dashboard</span>
            <ArrowRightIcon size={16} />
          </button>
          <button type="button" className="text-button" onClick={handleComplete}>
            Skip for now
          </button>
        </div>
      </div>
    </section>
  )
}

function HistoryPage() {
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([])
  const [filter, setFilter] = useState('')
  const toast = useToast()

  useEffect(() => {
    setEntries(historyService.getEntries())
  }, [])

  const handleClear = () => {
    if (!window.confirm('Clear your entire local processing audit trail?')) return
    historyService.clearHistory()
    setEntries([])
    toast.show('Audit trail cleared.', 'info')
  }

  const handleDelete = (id: string) => {
    historyService.deleteEntry(id)
    setEntries(historyService.getEntries())
    toast.show('Entry removed.', 'info')
  }

  const filtered = entries.filter(
    (e) =>
      e.fileName.toLowerCase().includes(filter.toLowerCase()) ||
      e.toolName.toLowerCase().includes(filter.toLowerCase()) ||
      e.outputName.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="dashboard">
      <section className="feature-card" style={{ minHeight: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p className="eyebrow">CLIENT-SIDE AUDIT TRAIL</p>
            <h1 style={{ fontSize: '24px', margin: '4px 0 8px' }}>Processing History</h1>
            <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0 }}>
              Logged purely inside your browser. No file contents are stored or transmitted.
            </p>
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="button button-ghost"
              style={{ color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)', minHeight: '38px', padding: '0 16px' }}
            >
              <TrashIcon size={16} />
              <span>Clear Audit Trail</span>
            </button>
          )}
        </div>

        {entries.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className="search-box" style={{ maxWidth: '400px', marginBottom: '16px' }}>
              <SearchIcon size={16} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search audit trail by tool or file name…"
              />
              {filter && (
                <button type="button" onClick={() => setFilter('')} style={{ background: 'none', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}>
                  <CloseIcon size={14} />
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a3a3a3' }}>
                    <th style={{ padding: '12px 10px' }}>TOOL</th>
                    <th style={{ padding: '12px 10px' }}>SOURCE FILE</th>
                    <th style={{ padding: '12px 10px' }}>OUTPUT ARTIFACT</th>
                    <th style={{ padding: '12px 10px' }}>OUTPUT SIZE</th>
                    <th style={{ padding: '12px 10px' }}>TIMESTAMP</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ToolIconRenderer name={item.toolId} size={18} color="#ffd21a" />
                          <strong>{item.toolName}</strong>
                        </div>
                      </td>
                      <td style={{ padding: '14px 10px', color: '#d4d4d4' }}>{item.fileName}</td>
                      <td style={{ padding: '14px 10px', color: '#ffd21a' }}>{item.outputName}</td>
                      <td style={{ padding: '14px 10px', color: '#a3a3a3' }}>{formatBytes(item.outputBytes)}</td>
                      <td style={{ padding: '14px 10px', color: '#737373', fontSize: '12px' }}>
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', padding: '4px' }}
                          title="Remove entry"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#737373' }}>
                        No records match “{filter}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {entries.length === 0 && (
          <EmptyWorkspacePage
            title="Audit trail is currently empty"
            copy="Every time you merge, compress, protect, edit, or transform a file using KnowTheFile, an on-device audit entry is saved here."
            action="Explore Tools to Process Documents"
          />
        )}
      </section>
    </div>
  )
}

function FilesPage() {
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([])

  useEffect(() => {
    setEntries(historyService.getEntries())
  }, [])

  // Derive unique files
  const uniqueFiles = Array.from(new Set(entries.map((e) => e.fileName))).map((fileName) => {
    const fileEntries = entries.filter((e) => e.fileName === fileName)
    const latest = fileEntries[0]
    return {
      name: fileName,
      latestTimestamp: latest.timestamp,
      operationsCount: fileEntries.length,
      lastTool: latest.toolName,
      lastToolId: latest.toolId,
      size: latest.inputBytes,
    }
  })

  return (
    <div className="dashboard">
      <section className="feature-card" style={{ minHeight: 'auto' }}>
        <p className="eyebrow">LOCAL VAULT</p>
        <h1 style={{ fontSize: '24px', margin: '4px 0 8px' }}>My Processed Files</h1>
        <p style={{ color: '#a3a3a3', fontSize: '13px', margin: '0 0 24px' }}>
          Documents you have actively transformed on this device. 100% private to this browser session.
        </p>

        {uniqueFiles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {uniqueFiles.map((file) => (
              <div
                key={file.name}
                style={{
                  padding: '18px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div className="tool-icon-disc" style={{ width: '38px', height: '38px' }}>
                      <FolderIcon size={18} color="#ffd21a" />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <strong style={{ display: 'block', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </strong>
                      <small style={{ color: '#737373', fontSize: '11px' }}>{formatBytes(file.size)}</small>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#a3a3a3', lineHeight: 1.6 }}>
                    <div>Last used in: <span style={{ color: '#ffd21a' }}>{file.lastTool}</span></div>
                    <div>Operations: {file.operationsCount} times</div>
                    <div style={{ color: '#737373', fontSize: '11px' }}>{new Date(file.latestTimestamp).toLocaleDateString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Link to={`/tools/${file.lastToolId}`} className="button button-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', minHeight: '34px' }}>
                    <span>Open Tool</span>
                  </Link>
                  <Link to="/tools/pdf-editor" className="button button-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', minHeight: '34px' }}>
                    <span>Studio</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyWorkspacePage
            title="No local documents yet"
            copy="When you process documents using any of KnowTheFile's 19 tools, your active document records will display here."
            action="Launch a Document Tool"
          />
        )}
      </section>
    </div>
  )
}

function EmptyWorkspacePage({
  title,
  copy,
  action
}: {
  title: string
  copy: string
  action: string
}) {
  return (
    <section className="empty-workspace">
      <FolderIcon size={40} color="#ffd21a" />
      <h2>{title}</h2>
      <p>{copy}</p>
      <Link className="button button-primary" to="/tools">
        <span>{action}</span>
        <ArrowRightIcon size={16} />
      </Link>
    </section>
  )
}

function SettingsPage() {
  const { user, configured } = useAuth()
  return (
    <div className="dashboard">
      <section className="feature-card" style={{ minHeight: 'auto' }}>
        <p className="eyebrow">ACCOUNT PROFILE</p>
        <h2 style={{ fontSize: '22px' }}>Authentication Identity</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
            <small style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 800 }}>EMAIL ADDRESS</small>
            <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{user?.email || 'N/A'}</p>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
            <small style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 800 }}>AUTH PROVIDER</small>
            <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{user?.providerData[0]?.providerId ?? 'Email'}</p>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
            <small style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 800 }}>STATUS</small>
            <p style={{ margin: '6px 0 0', fontWeight: 700, color: user?.emailVerified ? '#4ade80' : '#facc15' }}>
              {user?.emailVerified ? 'Verified' : 'Pending Verification'}
            </p>
          </div>
        </div>
      </section>

      <section className="feature-card" style={{ minHeight: 'auto' }}>
        <p className="eyebrow">STORAGE ARCHITECTURE</p>
        <h2 style={{ fontSize: '22px' }}>Storage & Privacy Controls</h2>
        <p style={{ color: '#a3a3a3', fontSize: '13px', lineHeight: 1.6, margin: '8px 0 20px' }}>
          {configured
            ? 'Firebase is configured. Storage uploads require a deployed bucket and the included Firestore security rules.'
            : 'Firebase environment variables have not been configured. All operations run strictly on-device.'}
        </p>
        <Link className="button button-ghost" to="/privacy">
          <span>Review Privacy Architecture</span>
          <ArrowRightIcon size={16} />
        </Link>
      </section>

      <section className="feature-card" style={{ minHeight: 'auto', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
        <p className="eyebrow" style={{ color: '#fb7185' }}>DANGER ZONE</p>
        <h2 style={{ fontSize: '22px' }}>Account Deletion</h2>
        <p style={{ color: '#a3a3a3', fontSize: '13px', lineHeight: 1.6, margin: '8px 0 20px' }}>
          Account deletion cascade requires a verified cloud function. It is currently locked until storage endpoints are active.
        </p>
        <button disabled type="button" className="button button-danger">
          Delete Account (Unavailable)
        </button>
      </section>
    </div>
  )
}

function BillingPage() {
  return <BillingUnavailable title="Billing is currently in preview mode" />
}

function BillingUnavailable({ title }: { title: string }) {
  return (
    <section className="empty-workspace">
      <SparklesIcon size={40} color="#ffd21a" />
      <h2>{title}</h2>
      <p>There are no active billing charges or subscription requirements for browser-ready tools. Start using all 19 local tools for free.</p>
      <Link className="button button-primary" to="/pricing">
        <span>View Pricing Plans</span>
        <ArrowRightIcon size={16} />
      </Link>
    </section>
  )
}

function SupportRoute() {
  const { user } = useAuth()
  return user ? (
    <Protected>
      <WorkspaceShell>
        <SupportPage />
      </WorkspaceShell>
    </Protected>
  ) : (
    <PublicShell>
      <SupportPage />
    </PublicShell>
  )
}

function SupportPage() {
  const [isBugModalOpen, setBugModalOpen] = useState(false)

  return (
    <>
      <section className="page-section">
        <p className="eyebrow">TECHNICAL SUPPORT</p>
        <h1>Get help with your documents.</h1>
        <p className="page-lede">
          If a browser tool runs into an issue, keep your source file on your machine and share the tool name, browser version, and error message.
        </p>
        <div className="feature-cards" style={{ marginTop: '40px' }}>
          <article className="feature-card">
            <div className="feature-icon-badge">
              <BugIcon size={20} />
            </div>
            <h3 style={{ marginTop: '16px' }}>Report an Issue</h3>
            <p>Encountered a bug or an unexpected error? Share details with our engineering team directly.</p>
            <button type="button" className="text-button" style={{ marginTop: '16px', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => setBugModalOpen(true)}>
              <span>Report a Bug</span>
              <ArrowRightIcon size={14} />
            </button>
          </article>
          <article className="feature-card">
            <div className="feature-icon-badge">
              <CpuIcon size={20} />
            </div>
            <h3 style={{ marginTop: '16px' }}>Using Browser Tools</h3>
            <p>Learn about supported MIME types, memory limits, and WebAssembly acceleration.</p>
            <Link to="/tools" className="text-button" style={{ marginTop: '16px' }}>
              <span>Browse Tools</span>
              <ArrowRightIcon size={14} />
            </Link>
          </article>
          <article className="feature-card">
            <div className="feature-icon-badge">
              <HelpIcon size={20} />
            </div>
            <h3 style={{ marginTop: '16px' }}>Contact Developer</h3>
            <p>For custom integrations or direct inquiries, contact the developer: Gokulakrishnan K.</p>
            <a href="mailto:gokulakrishnan.k.cseacet@gmail.com?subject=Website%20Contact" className="text-button" style={{ marginTop: '16px' }}>
              <span>Contact Developer</span>
              <ArrowRightIcon size={14} />
            </a>
          </article>
        </div>
      </section>
      <ReportBugModal isOpen={isBugModalOpen} onClose={() => setBugModalOpen(false)} />
    </>
  )
}

function HelpPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Where does document processing happen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'All tools marked Client-Side process entirely in your active browser tab using WebAssembly and client-side canvas engines. Your documents are never uploaded to any remote server.'
        }
      },
      {
        '@type': 'Question',
        name: 'Why was my file rejected?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A file may be password-encrypted, corrupt, larger than the 100 MB browser buffer limit, or require dedicated DOCX backend converters.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I save documents to cloud storage?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Cloud storage is enabled when a Firebase Storage bucket is connected. KnowTheFile does not store simulated files without real encryption.'
        }
      }
    ]
  }

  return (
    <section className="page-section">
      <PageMeta
        title="Help & FAQ Center — KnowTheFile"
        description="Frequently asked questions, performance guides, and troubleshooting for KnowTheFile browser-accelerated PDF tools."
        canonicalPath="/help"
        keywords="knowthefile help, pdf tools faq, browser pdf processing guide"
        schemaJson={faqSchema}
      />
      <p className="eyebrow">HELP CENTER</p>
      <h1>Answers for your document workflows.</h1>
      <div style={{ display: 'grid', gap: '14px', maxWidth: '820px', marginTop: '40px' }}>
        <details className="feature-card" open style={{ minHeight: 'auto', padding: '24px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
            Where does document processing happen?
          </summary>
          <p style={{ marginTop: '14px' }}>
            All tools marked “✦ Client-Side” process entirely in your active browser tab using WebAssembly and client-side canvas engines. Your documents are never uploaded to any remote server.
          </p>
        </details>
        <details className="feature-card" style={{ minHeight: 'auto', padding: '24px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
            Why was my file rejected?
          </summary>
          <p style={{ marginTop: '14px' }}>
            A file may be password-encrypted, corrupt, larger than the 100 MB browser buffer limit, or require dedicated DOCX backend converters.
          </p>
        </details>
        <details className="feature-card" style={{ minHeight: 'auto', padding: '24px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
            Can I save documents to cloud storage?
          </summary>
          <p style={{ marginTop: '14px' }}>
            Cloud storage is enabled when a Firebase Storage bucket is connected. KnowTheFile does not store simulated files without real encryption.
          </p>
        </details>
      </div>
    </section>
  )
}

function ContactPage() {
  return (
    <section className="page-section">
      <PageMeta
        title="Contact & Technical Support — KnowTheFile"
        description="Get in touch with the KnowTheFile team for technical support, feature feedback, or enterprise inquiries."
        canonicalPath="/contact"
        keywords="contact knowthefile, pdf tool support, enterprise document processing"
      />
      <p className="eyebrow">CONTACT ENGINEERING</p>
      <h1>Get in touch.</h1>
      <p className="page-lede">
        Have questions regarding enterprise deployments or custom integration? Use the support portal to reach our engineering team.
      </p>
      <Link className="button button-primary" to="/support" style={{ marginTop: '20px' }}>
        <span>Open Support Portal</span>
        <ArrowRightIcon size={16} />
      </Link>
    </section>
  )
}

function LegalPage({ slug }: { slug: string }) {
  const name = slug
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

  const content: Record<string, string> = {
    privacy:
      'KnowTheFile processes browser-ready tools entirely locally on your device. Authentication and cloud storage are only active when configured. We never sell, track, or index user documents.',
    security:
      'KnowTheFile uses client-side WebAssembly execution for local document manipulation. Ownership-scoped Firebase security rules prevent unauthorized access to cloud assets.',
    accessibility:
      'KnowTheFile is engineered with keyboard accessibility, high-contrast liquid glass tokens, visible focus outlines, and screen-reader semantics.',
    cookies:
      'KnowTheFile uses no third-party tracking or advertising cookies. Any session storage is strictly utilized for client-side authentication and preferences.',
    terms:
      'Use KnowTheFile only for documents you have legal authorization to process. All browser tools are provided with transparent local execution guarantees.'
  }

  return (
    <article className="page-section" style={{ maxWidth: '840px' }}>
      <PageMeta
        title={`${name} — Trust & Compliance`}
        description={`${name} terms and privacy documentation for KnowTheFile.`}
        canonicalPath={`/${slug}`}
      />
      <p className="eyebrow">TRUST & COMPLIANCE</p>
      <h1>{name}</h1>
      <p style={{ color: '#737373', fontSize: '12px', marginBottom: '24px' }}>
        Last Updated: August 31, 2026
      </p>
      <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#d4d4d4' }}>
        {content[slug] ??
          `This ${name.toLowerCase()} policy defines the operational guidelines for KnowTheFile document services.`}
      </p>
      <h2 style={{ fontSize: '22px', margin: '40px 0 12px' }}>Our Privacy Commitment</h2>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#a3a3a3' }}>
        We are committed to absolute transparency regarding document lifecycle, local processing, and storage boundaries. Where an infrastructure feature is not active, the application communicates state clearly rather than simulating it.
      </p>
    </article>
  )
}

function SimplePage({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="page-section">
      <p className="eyebrow">KNOWTHEFILE</p>
      <h1>{title}</h1>
      <p className="page-lede">{copy}</p>
      <Link className="button button-primary" to="/tools" style={{ marginTop: '24px' }}>
        <span>Explore Tools</span>
        <ArrowRightIcon size={16} />
      </Link>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="page-section" style={{ textAlign: 'center' }}>
      <p className="eyebrow">404 ERROR</p>
      <h1>This document path does not exist.</h1>
      <p className="page-lede" style={{ margin: '0 auto 30px' }}>
        Check the URL or return to the main document toolkit.
      </p>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
        <Link className="button button-primary" to="/tools">
          <span>Browse All Tools</span>
          <ArrowRightIcon size={16} />
        </Link>
        <Link className="button button-ghost" to="/">
          <span>Return Home</span>
        </Link>
      </div>
    </section>
  )
}
