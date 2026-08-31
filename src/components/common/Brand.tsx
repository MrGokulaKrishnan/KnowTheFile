import { Link } from 'react-router-dom'
import kfLogo from '../../assets/kf-logo.png'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="KnowTheFile home">
      <div className="brand-mark-wrap">
        <img className="brand-mark" src={kfLogo} alt="KnowTheFile" />
      </div>
      {!compact && (
        <span className="brand-wordmark">
          Know<span>The</span>File
        </span>
      )}
    </Link>
  )
}
