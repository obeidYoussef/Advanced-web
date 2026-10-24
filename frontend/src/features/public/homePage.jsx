import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SiteHeader } from '../../components/siteHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { HotelSearchForm } from './hotelSearchForm.jsx'

function paramsToForm(params) {
  return {
    city: params.get('city') ?? '',
    checkIn: params.get('checkIn') ?? '',
    checkOut: params.get('checkOut') ?? '',
    guests: params.get('guests') ?? '2',
  }
}

function HotelCard({ hotel, searchParams }) {
  const pricedRooms = hotel.roomTypes.filter((room) => room.quote)
  const lowestRoom = (pricedRooms.length ? pricedRooms : hotel.roomTypes)
    .reduce((lowest, room) => {
      const price = Number(room.quote?.totalAmount ?? room.basePrice)
      return !lowest || price < lowest.price ? { room, price } : lowest
    }, null)
  const image = hotel.coverImageUrl ?? hotel.hotelImages[0]?.imageUrl
  const facilities = hotel.hotelFacilities
    .slice(0, 3)
    .map((item) => item.facility.name)
  const rating = Number(hotel.rating.averageRating)
  const detailsPath = `/hotels/${hotel.id}?${new URLSearchParams(searchParams)}`

  return (
    <article className="hotel-result-card">
      <Link className="hotel-result-image" to={detailsPath} aria-label={`View ${hotel.name}`}>
        {image ? <img src={image} alt="" /> : <span aria-hidden="true">S</span>}
      </Link>

      <div className="hotel-result-copy">
        <div>
          <p className="hotel-location">{hotel.city}, {hotel.country}</p>
          <h2><Link to={detailsPath}>{hotel.name}</Link></h2>
          <p className="hotel-address">{hotel.address}</p>
        </div>
        <p className="hotel-description">
          {hotel.description || 'A comfortable place for your next stay.'}
        </p>
        {facilities.length > 0 && (
          <ul className="feature-list" aria-label="Popular facilities">
            {facilities.map((facility) => <li key={facility}>✓ {facility}</li>)}
          </ul>
        )}
        <span className="cancellation-note">Free cancellation until 48 hours before check-in</span>
      </div>

      <div className="hotel-result-action">
        <div className="review-summary">
          <span>
            <strong>{rating ? 'Guest rated' : 'New property'}</strong>
            <small>{hotel.rating.reviewCount || 0} review{hotel.rating.reviewCount === 1 ? '' : 's'}</small>
          </span>
          <b>{rating ? rating.toFixed(1) : 'New'}</b>
        </div>
        {lowestRoom && (
          <div className="result-price">
            <small>{lowestRoom.room.quote ? `${lowestRoom.room.quote.nightCount} night total` : 'Price per night from'}</small>
            <strong>{lowestRoom.price.toFixed(2)} {hotel.currency}</strong>
            {lowestRoom.room.quote && <small>Includes taxes and fees</small>}
          </div>
        )}
        <Link className="button button-primary" to={detailsPath}>See availability</Link>
      </div>
    </article>
  )
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState(() => paramsToForm(searchParams))
  const [filters, setFilters] = useState(() => ({
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    minRating: searchParams.get('minRating') ?? '',
    facilityId: searchParams.get('facilityId') ?? '',
    sort: searchParams.get('sort') ?? 'price_asc',
  }))
  const [hotels, setHotels] = useState([])
  const [facilities, setFacilities] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/public/lookups')
      .then((data) => active && setFacilities(data.facilities))
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams(searchParams)
    query.set('page', '1')
    query.set('limit', '20')

    apiRequest(`/public/hotels?${query}`)
      .then((data) => {
        if (!active) return
        setHotels(data.hotels)
        setPagination(data.pagination)
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [searchParams])

  function updateSearch(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function applyParams(search, nextFilters = filters) {
    const next = new URLSearchParams()
    Object.entries({ ...search, ...nextFilters }).forEach(([key, value]) => {
      if (value) next.set(key, value)
    })
    setSearchParams(next)
  }

  function updateFilter(event) {
    const { name, value } = event.target
    const next = { ...filters, [name]: value }
    setFilters(next)
    setLoading(true)
    setError('')
    applyParams(form, next)
  }

  function handleSearch(event) {
    event.preventDefault()
    if (form.checkIn && (!form.checkOut || form.checkOut <= form.checkIn)) {
      setError('Choose a check-out date after your check-in date.')
      return
    }
    setLoading(true)
    setError('')
    applyParams(form)
  }

  function clearFilters() {
    const cleared = { minPrice: '', maxPrice: '', minRating: '', facilityId: '', sort: 'price_asc' }
    setFilters(cleared)
    setLoading(true)
    setError('')
    applyParams(form, cleared)
  }

  const hasStayDates = searchParams.has('checkIn') && searchParams.has('checkOut')

  return (
    <div className="public-page">
      <SiteHeader />
      <main>
        <section className="search-hero">
          <div className="search-hero-copy">
            <p className="eyebrow">Stay somewhere worth remembering</p>
            <h1>Find the right stay at a clear price.</h1>
            <p>Compare approved hotels, live availability, and complete stay totals.</p>
          </div>
          <HotelSearchForm form={form} onChange={updateSearch} onSubmit={handleSearch} />
          <div className="trust-strip" aria-label="Booking benefits">
            <span>✓ Immediate confirmation</span>
            <span>✓ Free cancellation until 48 hours before check-in</span>
            <span>✓ Reviews from completed stays</span>
          </div>
        </section>

        <section className="hotel-results" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Approved properties</p>
              <h2>{form.city ? `Stays in ${form.city}` : 'Explore stays'}</h2>
            </div>
            {!loading && <span>{pagination?.total ?? hotels.length} propert{(pagination?.total ?? hotels.length) === 1 ? 'y' : 'ies'}</span>}
          </div>

          <div className="results-layout">
            <aside className="filter-sidebar">
              <div className="filter-title">
                <h3>Filter by</h3>
                <button className="text-button" type="button" onClick={clearFilters}>Clear</button>
              </div>
              <label>Minimum nightly price<input name="minPrice" type="number" min="0" value={filters.minPrice} onChange={updateFilter} /></label>
              <label>Maximum nightly price<input name="maxPrice" type="number" min="0" value={filters.maxPrice} onChange={updateFilter} /></label>
              <label>Guest rating
                <select name="minRating" value={filters.minRating} onChange={updateFilter}>
                  <option value="">Any rating</option>
                  <option value="4">4+ Excellent</option>
                  <option value="3">3+ Good</option>
                  <option value="2">2+ Fair</option>
                </select>
              </label>
              <label>Facility
                <select name="facilityId" value={filters.facilityId} onChange={updateFilter}>
                  <option value="">All facilities</option>
                  {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
                </select>
              </label>
            </aside>

            <div className="results-column">
              <div className="results-toolbar">
                <span>{hasStayDates ? 'Available rooms with total stay prices' : 'Add dates to see live availability'}</span>
                <label>Sort by
                  <select name="sort" value={filters.sort} onChange={updateFilter}>
                    <option value="price_asc">Price: low to high</option>
                    <option value="rating_desc">Guest rating</option>
                    <option value="name_asc">Property name</option>
                    <option value="newest">Newest</option>
                  </select>
                </label>
              </div>
              {error && <div className="message message-error" role="alert">{error}</div>}
              {loading && <div className="empty-state">Searching available hotels…</div>}
              {!loading && !error && hotels.length === 0 && (
                <div className="empty-state"><h3>No stays matched</h3><p>Try different dates, a nearby destination, or fewer filters.</p></div>
              )}
              {!loading && hotels.length > 0 && (
                <div className="hotel-result-list">
                  {hotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} searchParams={searchParams} />)}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
