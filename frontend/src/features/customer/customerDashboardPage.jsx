import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'

export function CustomerDashboardPage() {
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
            <section className="dashboard-card">
                <p className="eyebrow">Customer account</p>

                <h1>Welcome, {user.fullName}</h1>

                <p>
                    Your account is ready. Hotel search, reservations, and reviews will
                    be added here in the next customer stages.
                </p>

                <dl className="account-details">
                    <div>
                        <dt>Email</dt>
                        <dd>{user.email}</dd>
                    </div>

                    <div>
                        <dt>Role</dt>
                        <dd>{user.role}</dd>
                    </div>
                </dl>

                {error && <p className="form-error">{error}</p>}

                <button type="button" className="secondary-button" onClick={handleSignOut}>
                    Sign out
                </button>
            </section>
        </main>
    )
}