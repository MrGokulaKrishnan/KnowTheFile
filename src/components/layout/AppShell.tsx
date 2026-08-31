import { useState, type PropsWithChildren } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Brand } from '../common/Brand'
import { useAuth } from '../auth/AuthProvider'
import {
  MenuIcon,
  CloseIcon,
  LayersIcon,
  FolderIcon,
  HistoryIcon,
  SettingsIcon,
  HelpIcon,
  CreditCardIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CpuIcon,
  SparklesIcon
} from '../common/Icons'

const publicNav = [
  { to: '/tools', label: 'All Tools' },
  { to: '/tools?category=Organize', label: 'Organize' },
  { to: '/tools?category=Convert', label: 'Convert' },
  { to: '/tools?category=Edit', label: 'Edit' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/help', label: 'Resources' },
]

export function PublicShell({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className="site-shell">
      <header className="public-header">
        <nav className="nav-wrap" aria-label="Main navigation">
          <Brand />
          <button
            type="button"
            className="menu-button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
          <div className={`public-links ${open ? 'is-open' : ''}`}>
            {publicNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="nav-account">
            {user ? (
              <Link className="button button-ghost" to="/dashboard">
                Workspace
              </Link>
            ) : (
              <Link className="login-link" to="/login">
                Sign In
              </Link>
            )}
            <Link className="button button-primary" to={user ? '/tools' : '/register'}>
              <span>{user ? 'Open Studio' : 'Get Started'}</span>
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  )
}

export function WorkspaceShell({ children }: PropsWithChildren) {
  const { user, service } = useAuth()
  const location = useLocation()
  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: <LayersIcon size={18} /> },
    { to: '/files', label: 'My Files', icon: <FolderIcon size={18} /> },
    { to: '/history', label: 'History', icon: <HistoryIcon size={18} /> },
    { to: '/tools', label: 'Tools Directory', icon: <SparklesIcon size={18} /> },
    { to: '/billing', label: 'Billing', icon: <CreditCardIcon size={18} /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
    { to: '/support', label: 'Support', icon: <HelpIcon size={18} /> }
  ]

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Brand />
        <div className="workspace-label">Workspace</div>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive || (to === '/tools' && location.pathname.startsWith('/tools')) ? 'active' : ''}`
            }
          >
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className="sidebar-link logout" onClick={() => void service.logout()}>
          Log Out
        </button>
      </aside>
      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">WORKSPACE STUDIO</p>
            <h1>
              {location.pathname === '/dashboard'
                ? `Welcome back${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}`
                : 'Document Workspace'}
            </h1>
          </div>
          <div className="user-chip">
            <div className="user-avatar">{user?.email?.slice(0, 1).toUpperCase() ?? 'K'}</div>
            <span>{user?.email}</span>
          </div>
        </header>
        {children}
      </section>
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>
          Private-by-design document workstation. Process, convert, and edit documents with 100% on-device browser acceleration.
        </p>
        <div className="trust-row" style={{ marginTop: '20px' }}>
          <span className="trust-item"><ShieldCheckIcon size={16} /> Zero Cloud Uploads</span>
          <span className="trust-item"><CpuIcon size={16} /> Client-Side Engine</span>
        </div>
      </div>
      <div className="footer-links">
        <div>
          <strong>Document Tools</strong>
          <Link to="/tools">All Tools</Link>
          <Link to="/tools/merge-pdf">Merge PDF</Link>
          <Link to="/tools/split-pdf">Split PDF</Link>
          <Link to="/tools/pdf-editor">PDF Editor</Link>
          <Link to="/pricing">Pricing Plans</Link>
        </div>
        <div>
          <strong>Resources</strong>
          <Link to="/help">Help Center</Link>
          <Link to="/support">Technical Support</Link>
          <Link to="/contact">Contact Team</Link>
          <Link to="/responsible-disclosure">Security Disclosure</Link>
        </div>
        <div>
          <strong>Legal & Trust</strong>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/security">Security Architecture</Link>
          <Link to="/accessibility">Accessibility</Link>
        </div>
      </div>
      <p className="footer-legal">
        © {new Date().getFullYear()} KnowTheFile. Browser-based file processing runs locally on your machine.
      </p>
    </footer>
  )
}
