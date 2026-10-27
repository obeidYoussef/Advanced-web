import { Link } from 'react-router'
import { getHomePath } from '../features/auth/getHomePath.js'
import { useAuth } from '../features/auth/useAuth.js'

export function SiteHeader() {
  const { session, user, signOut } = useAuth()

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" to="/" aria-label="Staywise home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Staywise</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <Link to="/">Find a stay</Link>
          {session ? (
            <>
              {user?.role === 'customer' && <Link to="/reservations">My reservations</Link>}
              <Link to="/account">Account</Link>
              {user?.role === 'customer' && <button className="text-button" type="button" onClick={() => void signOut()}>Sign out</button>}
              {user?.role !== 'customer' && (
                <Link className="button button-primary" to={getHomePath(user)}>
                  Workspace
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="button button-primary" to="/register">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
