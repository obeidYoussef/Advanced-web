import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { SiteHeader } from '../../components/siteHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { HotelSearchForm } from './hotelSearchForm.jsx'

function RoomOption({ hotel, room, quote, query }) {
  const amenities = room.roomTypeAmenities.map((item) => item.amenity.name)
  const canReserve = quote?.availableRooms > 0

  return (
    <article className="room-option">
      {room.imageUrl && <img className="room-option-image" src={room.imageUrl} alt="" />}
      <div className="room-option-copy">
        <h3>{room.name}</h3>
        <p>Up to {room.capacity} guest{room.capacity === 1 ? '' : 's'}</p>
        {room.description && <p>{room.description}</p>}
        {amenities.length > 0 && (
          <ul className="feature-list">
            {amenities.map((amenity) => <li key={amenity}>✓ {amenity}</li>)}
          </ul>
        )}
        <span className="cancellation-note">Free cancellation until 48 hours before check-in</span>
      </div>

      <div className="room-option-price">
        {quote ? (
          <>
            <small>{quote.nightCount} night total</small>
            <strong>{Number(quote.totalAmount).toFixed(2)} {quote.currency}</strong>
            <small>Includes {Number(quote.serviceFee).toFixed(2)} service fee</small>
            <span>{quote.availableRooms} room{quote.availableRooms === 1 ? '' : 's'} left</span>
          </>
        ) : (
          <>
            <small>Price per night</small>
            <strong>{Number(room.basePrice).toFixed(2)} {hotel.currency}</strong>
            <small>Select dates for the complete price</small>
          </>
        )}
        {canReserve ? (
          <Link className="button button-primary" to={`/book/${room.id}?hotelId=${hotel.id}&${query}`}>
            Reserve
          </Link>
        ) : (
          <span className="room-unavailable">{quote ? 'Unavailable for these dates' : 'Choose dates above'}</span>
        )}
      </div>
    </article>
  )
}

export function HotelDetailsPage() {
  const { hotelId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [hotel, setHotel] = useState(null)
  const [reviews, setReviews] = useState([])
  const [quoteResult, setQuoteResult] = useState({ key: '', values: {} })
  const [form, setForm] = useState({
    city: searchParams.get('city') ?? '',
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    guests: searchParams.get('guests') ?? '2',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest(`/public/hotels/${hotelId}`),
      apiRequest(`/public/hotels/${hotelId}/reviews?page=1&limit=6`),
    ])
      .then(([hotelData, reviewData]) => {
        if (!active) return
        setHotel(hotelData.hotel)
        setReviews(reviewData.reviews)
        setForm((current) => ({ ...current, city: current.city || hotelData.hotel.city }))
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [hotelId])

  useEffect(() => {
    const checkIn = searchParams.get('checkIn')
    const checkOut = searchParams.get('checkOut')
    const guests = searchParams.get('guests') ?? '2'
    if (!hotel || !checkIn || !checkOut) {
      return undefined
    }

    let active = true
    const quoteKey = `${checkIn}:${checkOut}:${guests}`
    Promise.all(hotel.roomTypes.map(async (room) => {
      const data = await apiRequest(`/public/room-types/${room.id}/quote?${new URLSearchParams({ checkIn, checkOut, guests })}`)
      return [room.id, data.quote]
    }))
      .then((entries) => active && setQuoteResult({
        key: quoteKey,
        values: Object.fromEntries(entries),
      }))
      .catch((quoteError) => active && setError(quoteError.message))
    return () => { active = false }
  }, [hotel, searchParams])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSearch(event) {
    event.preventDefault()
    setError('')
    if (form.checkIn && (!form.checkOut || form.checkOut <= form.checkIn)) {
      setError('Choose a check-out date after your check-in date.')
      return
    }
    const next = new URLSearchParams()
    Object.entries(form).forEach(([key, value]) => value && next.set(key, value))
    if (hotel && form.city.trim().toLowerCase() !== hotel.city.toLowerCase()) {
      navigate(`/?${next}`)
      return
    }
    setSearchParams(next)
  }

  if (loading) return <main className="status-page">Loading property…</main>
  if (error && !hotel) return <main className="status-page"><section className="status-card"><h1>Property unavailable</h1><p>{error}</p><Link className="button button-primary" to="/">Back to search</Link></section></main>

  const images = [hotel.coverImageUrl, ...hotel.hotelImages.map((image) => image.imageUrl)]
    .filter((url, index, all) => url && all.indexOf(url) === index)
    .slice(0, 5)
  const query = new URLSearchParams({
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    guests: searchParams.get('guests') ?? '2',
  })
  const hasDates = query.get('checkIn') && query.get('checkOut')
  const quoteKey = `${query.get('checkIn')}:${query.get('checkOut')}:${query.get('guests')}`
  const quotes = quoteResult.key === quoteKey ? quoteResult.values : {}
  const quoteLoading = Boolean(hasDates && quoteResult.key !== quoteKey)
  const mapUrl = hotel.latitude && hotel.longitude
    ? `https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=15/${hotel.latitude}/${hotel.longitude}`
    : null

  return (
    <div className="public-page">
      <SiteHeader />
      <main className="property-page">
        <HotelSearchForm compact form={form} onChange={updateField} onSubmit={handleSearch} />
        {error && <div className="message message-error" role="alert">{error}</div>}

        <section className="property-heading">
          <div>
            <p className="eyebrow">{hotel.city}, {hotel.country}</p>
            <h1>{hotel.name}</h1>
            <p>{hotel.address} {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">View on map</a>}</p>
          </div>
          <div className="review-summary review-summary-large">
            <span><strong>Guest rating</strong><small>{hotel.rating.reviewCount} verified review{hotel.rating.reviewCount === 1 ? '' : 's'}</small></span>
            <b>{hotel.rating.averageRating ? Number(hotel.rating.averageRating).toFixed(1) : 'New'}</b>
          </div>
        </section>

        <section className={`property-gallery property-gallery-${Math.min(images.length, 5)}`}>
          {images.length ? images.map((image, index) => <img key={image} src={image} alt={index === 0 ? `${hotel.name} exterior` : ''} />) : <div className="gallery-placeholder">Staywise</div>}
        </section>

        <div className="property-overview">
          <section>
            <h2>About this property</h2>
            <p>{hotel.description || 'A comfortable place for your next stay.'}</p>
          </section>
          <aside>
            <h2>Popular facilities</h2>
            <ul className="feature-list">
              {hotel.hotelFacilities.map((item) => <li key={item.facility.id}>✓ {item.facility.name}</li>)}
            </ul>
            <p><strong>Check-in:</strong> {hotel.checkInTime.slice(0, 5)} · <strong>Check-out:</strong> {hotel.checkOutTime.slice(0, 5)}</p>
          </aside>
        </div>

        <section className="room-section" id="rooms">
          <div className="section-heading">
            <div><p className="eyebrow">Room choices</p><h2>Choose your room</h2></div>
            <span>{quoteLoading ? 'Checking live availability…' : hasDates ? 'Prices for your complete stay' : 'Select dates above for live prices'}</span>
          </div>
          <div className="room-list">
            {hotel.roomTypes.map((room) => <RoomOption key={room.id} hotel={hotel} room={room} quote={quotes[room.id]} query={query} />)}
          </div>
        </section>

        <section className="reviews-section">
          <div className="section-heading"><div><p className="eyebrow">Verified stays</p><h2>Guest reviews</h2></div></div>
          {reviews.length ? (
            <div className="review-grid">{reviews.map((review) => <article key={review.id}><strong>{review.rating} / 5</strong><p>{review.comment || 'The guest left a rating without a written comment.'}</p></article>)}</div>
          ) : <div className="empty-state">This property has no reviews yet.</div>}
        </section>
      </main>
    </div>
  )
}
