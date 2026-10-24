import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'

export function AccountPage() {
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
    <main className="status-page">
      <section className="status-card">
        <span className="status-badge">{user.role}</span>
        <h1>Hello, {user.fullName}</h1>
        <p>
          Your account is ready. Features for this role will be
          added in its project phase.
        </p>

        {error && (
          <div className="message message-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="secondary-button"
          type="button"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
