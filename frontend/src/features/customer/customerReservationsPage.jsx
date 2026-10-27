import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SiteHeader } from '../../components/siteHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

function formatMoney(value, currency) {
  return `${Number(value).toFixed(2)} ${currency}`
}

function ReservationEditor({ reservation, onClose, onSaved, accessToken }) {
  const [form, setForm] = useState({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guestCount: reservation.guestCount,
    primaryGuestName: reservation.primaryGuestName,
    primaryGuestEmail: reservation.primaryGuestEmail,
    primaryGuestPhone: reservation.primaryGuestPhone ?? '',
    specialRequests: reservation.specialRequests ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data = await apiRequest(`/customer/reservations/${reservation.id}`, {
        method: 'PUT',
        accessToken,
        body: {
          ...form,
          roomTypeId: reservation.roomType.id,
          guestCount: Number(form.guestCount),
          primaryGuestPhone: form.primaryGuestPhone || null,
        },
      })
      onSaved(data.reservation)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="reservation-edit-form form-grid" onSubmit={save}>
      {error && <div className="message message-error form-wide" role="alert">{error}</div>}
      <label className="form-field">Check-in<input name="checkIn" type="date" value={form.checkIn} onChange={updateField} required /></label>
      <label className="form-field">Check-out<input name="checkOut" type="date" min={form.checkIn} value={form.checkOut} onChange={updateField} required /></label>
      <label className="form-field">Guests<input name="guestCount" type="number" min="1" max={reservation.roomType.capacity} value={form.guestCount} onChange={updateField} required /></label>
      <label className="form-field">Guest name<input name="primaryGuestName" value={form.primaryGuestName} onChange={updateField} required /></label>
      <label className="form-field">Guest email<input name="primaryGuestEmail" type="email" value={form.primaryGuestEmail} onChange={updateField} required /></label>
      <label className="form-field">Phone<input name="primaryGuestPhone" type="tel" value={form.primaryGuestPhone} onChange={updateField} /></label>
      <label className="form-field form-wide">Special requests<textarea name="specialRequests" rows="3" value={form.specialRequests} onChange={updateField} /></label>
      <div className="form-actions button-row">
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="button" type="button" onClick={onClose}>Cancel edit</button>
      </div>
    </form>
  )
}

export function CustomerReservationsPage() {
  const { session } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/customer/reservations?page=1&limit=50', { accessToken: session.access_token })
      .then((data) => active && setReservations(data.reservations))
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [session.access_token])

  async function cancelReservation(reservation) {
    if (!window.confirm(`Cancel reservation ${reservation.confirmationNumber}?`)) return
    setPendingId(reservation.id)
    setError('')
    try {
      const data = await apiRequest(`/customer/reservations/${reservation.id}/cancel`, {
        method: 'POST',
        accessToken: session.access_token,
      })
      setReservations((current) => current.map((item) => (
        item.id === reservation.id
          ? { ...item, ...data.reservation, canCancel: false, canModify: false }
          : item
      )))
    } catch (cancelError) {
      setError(cancelError.message)
    } finally {
      setPendingId('')
    }
  }

  function saveReservation(updated) {
    setReservations((current) => current.map((item) => (
      item.id === updated.id ? { ...item, ...updated } : item
    )))
    setEditingId('')
  }

  return (
    <div className="public-page">
      <SiteHeader />
      <main className="customer-reservations-page">
        <header className="public-account-heading">
          <p className="eyebrow">Your trips</p>
          <h1>My reservations</h1>
          <p>Review, change, or cancel eligible stays.</p>
        </header>

        {error && <div className="message message-error" role="alert">{error}</div>}
        {loading && <div className="empty-state">Loading your stays…</div>}
        {!loading && reservations.length === 0 && (
          <div className="empty-state">
            <h2>No reservations yet</h2>
            <p>When you reserve a room, it will appear here.</p>
            <Link className="button button-primary" to="/">Find a stay</Link>
          </div>
        )}

        <div className="customer-stay-list">
          {reservations.map((reservation) => (
            <article className="customer-stay" key={reservation.id}>
              <div className="customer-stay-image">
                {reservation.hotel.coverImageUrl
                  ? <img src={reservation.hotel.coverImageUrl} alt="" />
                  : <span aria-hidden="true">S</span>}
              </div>
              <div className="customer-stay-copy">
                <div className="item-heading">
                  <div><p className="hotel-location">{reservation.hotel.city}, {reservation.hotel.country}</p><h2>{reservation.hotel.name}</h2></div>
                  <span className={`status-badge status-${reservation.status}`}>{reservation.status.replace('_', ' ')}</span>
                </div>
                <p>{reservation.roomType.name} · {reservation.guestCount} guest{reservation.guestCount === 1 ? '' : 's'}</p>
                <div className="stay-facts">
                  <span><small>Check-in</small><strong>{reservation.checkIn}</strong></span>
                  <span><small>Check-out</small><strong>{reservation.checkOut}</strong></span>
                  <span><small>Confirmation</small><strong>{reservation.confirmationNumber}</strong></span>
                  <span><small>Total</small><strong>{formatMoney(reservation.totalAmount, reservation.currency)}</strong></span>
                </div>
                {editingId === reservation.id ? (
                  <ReservationEditor reservation={reservation} accessToken={session.access_token} onClose={() => setEditingId('')} onSaved={saveReservation} />
                ) : (
                  <div className="stay-actions">
                    <span className={`status-badge payment-${reservation.paymentStatus}`}>Payment: {reservation.paymentStatus}</span>
                    {reservation.canModify && <button className="text-button" type="button" onClick={() => setEditingId(reservation.id)}>Change reservation</button>}
                    {reservation.canCancel && <button className="text-button danger-text" type="button" disabled={pendingId === reservation.id} onClick={() => void cancelReservation(reservation)}>{pendingId === reservation.id ? 'Cancelling…' : 'Cancel reservation'}</button>}
                    {!reservation.canCancel && reservation.status === 'confirmed' && <small>The change deadline has passed; contact the hotel manager.</small>}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
