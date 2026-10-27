import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { FormField } from '../../components/formField.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

const emptyHotel = {
  name: '',
  country: '',
  city: '',
  address: '',
}

export function ManagerDashboardPage() {
  const { session, user } = useAuth()
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState(emptyHotel)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    apiRequest('/manager/hotels?page=1&limit=100', {
      accessToken: session.access_token,
    })
      .then((data) => {
        if (active) setHotels(data.hotels)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session.access_token])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCreate(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const data = await apiRequest('/manager/hotels', {
        method: 'POST',
        accessToken: session.access_token,
        body: form,
      })
      setHotels((current) => [data.hotel, ...current])
      setForm(emptyHotel)
      setShowCreateForm(false)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout
      eyebrow="Manager workspace"
      title={`Welcome, ${user.fullName}`}
      subtitle="Create a property, then add its rooms, prices, and facilities."
      action={
        <button
          className="button button-primary"
          type="button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Close form' : 'Add hotel'}
        </button>
      }
    >
      {showCreateForm && (
        <section className="panel create-panel">
          <div className="panel-heading">
            <div>
              <h2>Create a hotel</h2>
              <p>Start with the essentials. Rooms, pricing, and images come next.</p>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleCreate}>
            <FormField label="Hotel name" name="name" value={form.name} onChange={updateField} minLength="2" maxLength="150" required />
            <FormField label="Country" name="country" value={form.country} onChange={updateField} minLength="2" maxLength="100" required />
            <FormField label="City" name="city" value={form.city} onChange={updateField} minLength="2" maxLength="100" required />
            <FormField label="Street address" name="address" value={form.address} onChange={updateField} minLength="5" maxLength="250" required />
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create hotel'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Your hotels</h2>
            <p>Hotels and active rooms are visible to travelers immediately.</p>
          </div>
        </div>

        {error && <div className="message message-error" role="alert">{error}</div>}
        {loading && <div className="empty-state compact">Loading your hotels…</div>}
        {!loading && !error && hotels.length === 0 && (
          <div className="empty-state compact">
            <h3>No hotels yet</h3>
            <p>Create your first hotel, then add its rooms and details.</p>
          </div>
        )}
        {!loading && hotels.length > 0 && (
          <div className="hotel-list">
            {hotels.map((hotel) => (
              <article className="hotel-row" key={hotel.id}>
                <div className="hotel-row-image">
                  {hotel.coverImageUrl ? <img src={hotel.coverImageUrl} alt="" /> : <span>H</span>}
                </div>
                <div>
                  <h3>{hotel.name}</h3>
                  <p>{hotel.city}, {hotel.country}</p>
                </div>
                <span className="hotel-row-meta">{hotel.currency}</span>
                <Link className="button" to={`/manager/hotels/${hotel.id}`}>Manage</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}
