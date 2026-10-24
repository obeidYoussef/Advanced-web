import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'

export function AdminDashboardPage() {
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
                <p className="eyebrow">Administration</p>

                <h1>Admin dashboard</h1>

                <p>
                    Welcome, {user.fullName}. Manager applications and platform
                    administration will be managed here.
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