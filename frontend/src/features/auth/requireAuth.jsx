import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth.js'

export function RequireAuth() {
  const {
    session,
    user,
    authError,
    loading,
    refreshUser,
    signOut,
  } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="status-page">Loading account…</main>
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (!user) {
    return (
      <main className="status-page">
        <section className="status-card">
          <h1>Unable to load your account</h1>
          <p>{authError || 'Please try again.'}</p>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={refreshUser}
            >
              Try again
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    )
  }

  return <Outlet />
}
