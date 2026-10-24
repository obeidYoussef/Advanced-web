import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

function formatMoney(value, currency) {
  return `${Number(value).toFixed(2)} ${currency}`
}

export function CustomerDashboardPage() {
  const { session, user } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/customer/reservations?page=1&limit=50', {
      accessToken: session.access_token,
    })
      .then((data) => active && setReservations(data.reservations))
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [session.access_token])

  async function cancelReservation(reservation) {
    const confirmed = window.confirm(
      `Cancel reservation ${reservation.confirmationNumber}? This cannot be undone.`,
    )
    if (!confirmed) return

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

  return (
    <DashboardLayout
      eyebrow="Customer account"
      title={`Welcome, ${user.fullName}`}
      subtitle="Review your confirmed, completed, and cancelled stays."
      action={<Link className="button button-primary" to="/">Find a stay</Link>}
    >
      {error && <div className="message message-error" role="alert">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>My reservations</h2><p>{reservations.length} reservation{reservations.length === 1 ? '' : 's'}</p></div>
        </div>
        {loading && <div className="empty-state compact">Loading your stays…</div>}
        {!loading && reservations.length === 0 && (
          <div className="empty-state compact"><h3>No reservations yet</h3><p>Your first confirmed stay will appear here.</p></div>
        )}
        {!loading && reservations.length > 0 && (
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
                    <div>
                      <p className="hotel-location">{reservation.hotel.city}, {reservation.hotel.country}</p>
                      <h3>{reservation.hotel.name}</h3>
                    </div>
                    <span className={`status-badge status-${reservation.status}`}>{reservation.status.replace('_', ' ')}</span>
                  </div>
                  <p>{reservation.roomType.name} · {reservation.guestCount} guest{reservation.guestCount === 1 ? '' : 's'}</p>
                  <div className="stay-facts">
                    <span><small>Check-in</small><strong>{reservation.checkIn}</strong></span>
                    <span><small>Check-out</small><strong>{reservation.checkOut}</strong></span>
                    <span><small>Confirmation</small><strong>{reservation.confirmationNumber}</strong></span>
                    <span><small>Total</small><strong>{formatMoney(reservation.totalAmount, reservation.currency)}</strong></span>
                  </div>
                  <div className="stay-actions">
                    <span className={`status-badge payment-${reservation.paymentStatus}`}>Payment: {reservation.paymentStatus}</span>
                    {reservation.canCancel && (
                      <button className="text-button danger-text" type="button" disabled={pendingId === reservation.id} onClick={() => void cancelReservation(reservation)}>
                        {pendingId === reservation.id ? 'Cancelling…' : 'Cancel reservation'}
                      </button>
                    )}
                    {!reservation.canCancel && reservation.status === 'confirmed' && <small>Cancellation deadline has passed; contact the hotel manager.</small>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}
