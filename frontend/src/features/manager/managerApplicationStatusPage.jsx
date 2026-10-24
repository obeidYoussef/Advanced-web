import { useState } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

const statusMessages = {
    pending:
        'Your manager application is waiting for administrator approval.',
    rejected:
        'Your manager application was rejected. Contact the platform administrator for more information.',
    suspended:
        'Your manager account is suspended. Contact the platform administrator.',
}

export function ManagerApplicationStatusPage() {
    const { user, refreshUser, signOut } = useAuth()
    const [error, setError] = useState('')

    if (user.role !== 'manager') {
        return <Navigate to="/account" replace />
    }

    if (user.managerStatus === 'approved') {
        return <Navigate to="/manager" replace />
    }

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
                <span className="status-badge">
                    {user.managerStatus.replace('_', ' ')}
                </span>

                <h1>Hello, {user.fullName}</h1>

                <p>
                    {statusMessages[user.managerStatus] ??
                        'Your manager account is not currently approved.'}
                </p>

                {error && (
                    <div className="message message-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="button-row">
                    <button
                        className="primary-button"
                        type="button"
                        onClick={refreshUser}
                    >
                        Refresh status
                    </button>

                    <button
                        className="secondary-button"
                        type="button"
                        onClick={handleSignOut}
                    >
                        Sign out
                    </button>
                </div>
            </section>
        </main>
    )
}
