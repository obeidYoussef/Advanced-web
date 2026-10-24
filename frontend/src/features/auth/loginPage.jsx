import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { FormField } from '../../components/formField.jsx'
import { AuthLayout } from './authLayout.jsx'
import { getHomePath } from './getHomePath.js'
import { useAuth } from './useAuth.js'

export function LoginPage() {
  const { signIn, session, user, loading } = useAuth()
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <main className="status-page">Loading…</main>
  }

  if (session) {
    return <Navigate to={getHomePath(user)} replace />
  }

  function updateField(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signIn({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
    } catch (signInError) {
      setError(signInError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your account using your email and password."
      footer={
        <p>
          Need an account? <Link to="/register">Register</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="message message-error" role="alert">
            {error}
          </div>
        )}

        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={updateField}
          required
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={updateField}
          required
        />

        <button
          className="primary-button"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
