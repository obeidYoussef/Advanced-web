import { useState } from 'react'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { FormField } from '../../components/formField.jsx'
import { SiteHeader } from '../../components/siteHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

export function AccountPage() {
  const { session, user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    fullName: user.fullName,
    phone: user.phone ?? '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setError('')

    try {
      await apiRequest('/auth/me', {
        method: 'PATCH',
        accessToken: session.access_token,
        body: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
        },
      })
      refreshUser()
      setMessage('Profile updated.')
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formContent = (
      <section className="panel create-panel">
        <div className="panel-heading">
          <div>
            <h2>Personal information</h2>
            <p>Keep your contact details up to date.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {error && <div className="message message-error form-wide" role="alert">{error}</div>}
          {message && <div className="message message-success form-wide" role="status">{message}</div>}
          <FormField
            label="Full name"
            name="fullName"
            value={form.fullName}
            onChange={updateField}
            minLength="2"
            maxLength="100"
            required
          />
          <FormField
            label="Phone number"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={updateField}
            minLength="5"
            maxLength="30"
          />
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
  )

  if (user.role === 'customer') {
    return (
      <div className="public-page">
        <SiteHeader />
        <main className="customer-reservations-page">
          <header className="public-account-heading">
            <p className="eyebrow">Account settings</p>
            <h1>Your profile</h1>
            <p>Signed in as {user.email}</p>
          </header>
          {formContent}
        </main>
      </div>
    )
  }

  return (
    <DashboardLayout
      eyebrow="Account settings"
      title="Your profile"
      subtitle={`Signed in as ${user.email}`}
    >
      {formContent}
    </DashboardLayout>
  )
}
