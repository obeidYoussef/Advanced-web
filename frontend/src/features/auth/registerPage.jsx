import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { FormField } from '../../components/formField.jsx'
import { AuthLayout } from './authLayout.jsx'
import { getHomePath } from './getHomePath.js'
import { useAuth } from './useAuth.js'

export function RegisterPage() {
  const location = useLocation()
  const { signUp, session, user, loading } = useAuth()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    accountType: 'customer',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <main className="status-page">Loading…</main>
  }

  if (session) {
    return <Navigate to={location.state?.from ?? getHomePath(user)} replace />
  }

  function updateField(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function validate() {
    const nextErrors = {}

    if (form.fullName.trim().length < 2) {
      nextErrors.fullName =
        'Full name must contain at least 2 characters.'
    }

    if (form.password.length < 8) {
      nextErrors.password =
        'Password must contain at least 8 characters.'
    }

    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (!validate()) {
      return
    }

    setSubmitting(true)

    try {
      const data = await signUp({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        accountType: form.accountType,
      })

      if (!data.session) {
        setMessage(
          'Registration successful. Check your email to confirm your account, then sign in.',
        )
      }
    } catch (signUpError) {
      setErrors({ form: signUpError.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Register as a customer or apply for a hotel manager account."
      footer={
        <p>
          Already registered? <Link to="/login" state={location.state}>Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit}>
        {errors.form && (
          <div className="message message-error" role="alert">
            {errors.form}
          </div>
        )}

        {message && (
          <div className="message message-success" role="status">
            {message}
          </div>
        )}

        <FormField
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          value={form.fullName}
          onChange={updateField}
          error={errors.fullName}
          required
        />

        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={updateField}
          required
        />

        <div className="form-field">
          <label htmlFor="accountType">Account type</label>
          <select
            id="accountType"
            name="accountType"
            value={form.accountType}
            onChange={updateField}
          >
            <option value="customer">Customer</option>
            <option value="manager">Hotel manager</option>
          </select>

        </div>

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength="8"
          value={form.password}
          onChange={updateField}
          error={errors.password}
          required
        />

        <FormField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength="8"
          value={form.confirmPassword}
          onChange={updateField}
          error={errors.confirmPassword}
          required
        />

        <button
          className="primary-button"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
    </AuthLayout>
  )
}
