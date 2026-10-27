import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../features/auth/useAuth.js'

const roleNavigation = {
  manager: [
    { to: '/manager', label: 'Hotels' },
    { to: '/manager/reservations', label: 'Reservations' },
    { to: '/manager/reports', label: 'Reports' },
    { to: '/account', label: 'Account' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/account', label: 'Account' },
  ],
}

export function DashboardLayout({ eyebrow, title, subtitle, action, children }) {
  const { user, signOut } = useAuth()
  const [error, setError] = useState('')

  async function handleSignOut() {
    setError('')
    try {
      await signOut()
    } catch (signOutError) {
      setError(signOutError.message)
    }
  }

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link className="brand sidebar-brand" to="/">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>
            Staywise
            <small>{user.role} workspace</small>
          </span>
        </Link>

        <nav className="workspace-nav" aria-label={`${user.role} navigation`}>
          {roleNavigation[user.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to !== '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="workspace-profile">
          <span className="avatar" aria-hidden="true">
            {user.fullName.slice(0, 2).toUpperCase()}
          </span>
          <span className="profile-copy">
            <strong>{user.fullName}</strong>
            <small>{user.email}</small>
          </span>
          <button className="text-button" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>

        {error && <div className="message message-error" role="alert">{error}</div>}
        {children}
      </main>
    </div>
  )
}
