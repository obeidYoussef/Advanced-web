import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'

export function ManagerDashboardPage() {
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
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Manager dashboard</span>
          <h1>Welcome, {user.fullName}</h1>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </header>

      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-card">
        <h2>Your hotels</h2>
        <p>
          Your account is approved. Hotel management is the next
          feature module.
        </p>
      </section>
    </main>
  )
}
