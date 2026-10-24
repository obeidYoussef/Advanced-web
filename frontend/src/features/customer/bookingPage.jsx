import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { SiteHeader } from '../../components/siteHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

export function BookingPage() {
  const { roomTypeId } = useParams()
  const [searchParams] = useSearchParams()
  const { session, user } = useAuth()
  const hotelId = searchParams.get('hotelId')
  const checkIn = searchParams.get('checkIn') ?? ''
  const checkOut = searchParams.get('checkOut') ?? ''
  const guests = searchParams.get('guests') ?? '1'
  const [hotel, setHotel] = useState(null)
  const [quote, setQuote] = useState(null)
  const [form, setForm] = useState({
    primaryGuestName: user.fullName ?? '',
    primaryGuestEmail: user.email ?? '',
    primaryGuestPhone: user.phone ?? '',
    specialRequests: '',
  })
  const [reservation, setReservation] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const quoteQuery = new URLSearchParams({ checkIn, checkOut, guests })
    Promise.all([
      apiRequest(`/public/hotels/${hotelId}`),
      apiRequest(`/public/room-types/${roomTypeId}/quote?${quoteQuery}`),
    ])
      .then(([hotelData, quoteData]) => {
        if (!active) return
        setHotel(hotelData.hotel)
        setQuote(quoteData.quote)
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [checkIn, checkOut, guests, hotelId, roomTypeId])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const data = await apiRequest('/customer/reservations', {
        method: 'POST',
        accessToken: session.access_token,
        body: {
          roomTypeId,
          checkIn,
          checkOut,
          guestCount: Number(guests),
          primaryGuestName: form.primaryGuestName,
          primaryGuestEmail: form.primaryGuestEmail,
          primaryGuestPhone: form.primaryGuestPhone || null,
          specialRequests: form.specialRequests,
        },
      })
      setReservation(data.reservation)
    } catch (bookingError) {
      setError(bookingError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="status-page">Confirming availability…</main>

  const room = hotel?.roomTypes.find((item) => item.id === roomTypeId)
  const detailsQuery = new URLSearchParams({ checkIn, checkOut, guests })

  if (reservation) {
    return (
      <div className="public-page">
        <SiteHeader />
        <main className="booking-page">
          <section className="booking-confirmation">
            <span className="confirmation-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">Reservation confirmed</p>
            <h1>Your stay is booked.</h1>
            <p>An email confirmation has been sent to {form.primaryGuestEmail}.</p>
            <dl className="confirmation-details">
              <div><dt>Confirmation number</dt><dd>{reservation.confirmationNumber}</dd></div>
              <div><dt>Property</dt><dd>{hotel.name}</dd></div>
              <div><dt>Dates</dt><dd>{checkIn} to {checkOut}</dd></div>
              <div><dt>Payment status</dt><dd>{reservation.paymentStatus}</dd></div>
            </dl>
            <div className="button-row">
              <Link className="button button-primary" to="/customer">View my reservations</Link>
              <Link className="button" to="/">Find another stay</Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="public-page">
      <SiteHeader />
      <main className="booking-page">
        <div className="booking-heading">
          <Link to={`/hotels/${hotelId}?${detailsQuery}`}>← Back to {hotel?.name ?? 'property'}</Link>
          <p className="eyebrow">Secure reservation</p>
          <h1>Complete your booking</h1>
        </div>

        {error && <div className="message message-error" role="alert">{error}</div>}
        {!hotel || !room || !quote ? (
          <div className="empty-state"><h3>Unable to prepare this reservation</h3><p>Return to the property and choose an available room again.</p></div>
        ) : (
          <div className="booking-layout">
            <form className="booking-form" onSubmit={handleSubmit}>
              <section className="booking-panel">
                <h2>Guest details</h2>
                <div className="form-grid booking-form-grid">
                  <label className="form-field">Full name<input name="primaryGuestName" value={form.primaryGuestName} onChange={updateField} required /></label>
                  <label className="form-field">Email address<input name="primaryGuestEmail" type="email" value={form.primaryGuestEmail} onChange={updateField} required /></label>
                  <label className="form-field form-wide">Phone number <span className="optional-label">Optional</span><input name="primaryGuestPhone" type="tel" value={form.primaryGuestPhone} onChange={updateField} /></label>
                  <label className="form-field form-wide">Special requests <span className="optional-label">Optional</span><textarea name="specialRequests" rows="4" maxLength="1000" value={form.specialRequests} onChange={updateField} placeholder="Requests are subject to property availability." /></label>
                </div>
              </section>

              <section className="booking-panel policy-panel">
                <h2>Cancellation policy</h2>
                <p><strong>Free cancellation</strong> until 48 hours before check-in. After that deadline, changes or cancellation require manager handling.</p>
              </section>

              <button className="button button-primary booking-submit" type="submit" disabled={submitting || quote.availableRooms < 1}>
                {submitting ? 'Confirming reservation…' : 'Confirm reservation'}
              </button>
              <p className="booking-fine-print">No online payment is collected. The reservation is confirmed immediately with payment status marked unpaid.</p>
            </form>

            <aside className="booking-summary">
              {hotel.coverImageUrl && <img src={hotel.coverImageUrl} alt="" />}
              <div>
                <p className="hotel-location">{hotel.city}, {hotel.country}</p>
                <h2>{hotel.name}</h2>
                <p>{room.name} · {guests} guest{guests === '1' ? '' : 's'}</p>
              </div>
              <dl>
                <div><dt>Check-in</dt><dd>{checkIn}</dd></div>
                <div><dt>Check-out</dt><dd>{checkOut}</dd></div>
                <div><dt>{quote.nightCount} night{quote.nightCount === 1 ? '' : 's'}</dt><dd>{Number(quote.nightlySubtotal).toFixed(2)} {quote.currency}</dd></div>
                <div><dt>Taxes</dt><dd>{Number(quote.taxAmount).toFixed(2)} {quote.currency}</dd></div>
                <div><dt>Service fee</dt><dd>{Number(quote.serviceFee).toFixed(2)} {quote.currency}</dd></div>
                <div className="booking-total"><dt>Total</dt><dd>{Number(quote.totalAmount).toFixed(2)} {quote.currency}</dd></div>
              </dl>
              <p className="price-note">This total is calculated by the server and rechecked when you confirm.</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
