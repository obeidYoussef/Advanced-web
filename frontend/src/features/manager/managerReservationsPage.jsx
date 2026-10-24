import { useCallback, useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

const emptyFilters = {
  search: '',
  hotelId: '',
  status: '',
  paymentStatus: '',
  from: '',
  to: '',
}

function ReservationActions({ reservation, onAction }) {
  return (
    <div className="table-actions">
      {reservation.status === 'confirmed' && (
        <>
          <button type="button" onClick={() => onAction('status', reservation, 'checked_in')}>Check in</button>
          <button type="button" onClick={() => onAction('status', reservation, 'no_show')}>No-show</button>
          <button className="danger-text" type="button" onClick={() => onAction('cancel', reservation)}>Cancel</button>
        </>
      )}
      {reservation.status === 'checked_in' && (
        <button type="button" onClick={() => onAction('status', reservation, 'completed')}>Complete</button>
      )}
      {reservation.paymentStatus === 'unpaid' && reservation.status !== 'cancelled' && (
        <button type="button" onClick={() => onAction('payment', reservation, 'paid')}>Mark paid</button>
      )}
      {reservation.paymentStatus === 'paid' && (
        <button type="button" onClick={() => onAction('payment', reservation, 'refunded')}>Refund</button>
      )}
    </div>
  )
}

export function ManagerReservationsPage() {
  const { session } = useAuth()
  const [hotels, setHotels] = useState([])
  const [reservations, setReservations] = useState([])
  const [formFilters, setFormFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadReservations = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value)
    })

    try {
      const data = await apiRequest(`/manager/reservations?${query}`, {
        accessToken: session.access_token,
      })
      setReservations(data.reservations)
      setPagination(data.pagination)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [filters, session.access_token])

  useEffect(() => {
    let active = true
    apiRequest('/manager/hotels?page=1&limit=100', { accessToken: session.access_token })
      .then((data) => { if (active) setHotels(data.hotels) })
      .catch((loadError) => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [session.access_token])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ page: '1', limit: '20' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value)
    })

    apiRequest(`/manager/reservations?${query}`, {
      accessToken: session.access_token,
    })
      .then((data) => {
        if (!active) return
        setReservations(data.reservations)
        setPagination(data.pagination)
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [filters, session.access_token])

  async function handleAction(kind, reservation, value) {
    let path = `/manager/reservations/${reservation.id}/${kind === 'payment' ? 'payment-status' : 'status'}`
    let body = kind === 'payment' ? { paymentStatus: value } : { status: value }
    let method = 'PATCH'

    if (kind === 'cancel') {
      const reason = window.prompt('Why is this reservation being cancelled?')
      if (!reason) return
      path = `/manager/reservations/${reservation.id}/cancel`
      body = { reason }
      method = 'POST'
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(path, { method, body, accessToken: session.access_token })
      setMessage('Reservation updated.')
      await loadReservations(pagination.page)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  function handleFilter(event) {
    event.preventDefault()
    setLoading(true)
    setFilters({ ...formFilters })
  }

  return (
    <DashboardLayout eyebrow="Hotel operations" title="Reservations" subtitle="Search stays and update operational or payment status.">
      <section className="panel filter-panel">
        <form className="filter-grid" onSubmit={handleFilter}>
          <input aria-label="Search reservations" placeholder="Confirmation or guest" value={formFilters.search} onChange={(event) => setFormFilters({ ...formFilters, search: event.target.value })} />
          <select aria-label="Hotel" value={formFilters.hotelId} onChange={(event) => setFormFilters({ ...formFilters, hotelId: event.target.value })}><option value="">All hotels</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select>
          <select aria-label="Reservation status" value={formFilters.status} onChange={(event) => setFormFilters({ ...formFilters, status: event.target.value })}><option value="">All statuses</option><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select>
          <select aria-label="Payment status" value={formFilters.paymentStatus} onChange={(event) => setFormFilters({ ...formFilters, paymentStatus: event.target.value })}><option value="">All payments</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select>
          <input aria-label="From date" type="date" value={formFilters.from} onChange={(event) => setFormFilters({ ...formFilters, from: event.target.value })} />
          <input aria-label="To date" type="date" min={formFilters.from} value={formFilters.to} onChange={(event) => setFormFilters({ ...formFilters, to: event.target.value })} />
          <button className="button button-primary" type="submit">Apply filters</button>
          <button className="button" type="button" onClick={() => { setLoading(true); setFormFilters(emptyFilters); setFilters({ ...emptyFilters }) }}>Clear</button>
        </form>
      </section>

      {error && <div className="message message-error" role="alert">{error}</div>}
      {message && <div className="message message-success" role="status">{message}</div>}

      <section className="panel">
        <div className="panel-heading"><div><h2>Reservation table</h2><p>{pagination.total} matching reservations</p></div>{busy && <span>Updating…</span>}</div>
        {loading && <div className="empty-state compact">Loading reservations…</div>}
        {!loading && reservations.length === 0 && <div className="empty-state compact"><h3>No reservations found</h3><p>Try different filters or wait for the first booking.</p></div>}
        {!loading && reservations.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Confirmation</th><th>Guest</th><th>Stay</th><th>Status</th><th>Payment</th><th>Total</th><th>Actions</th></tr></thead>
              <tbody>{reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td><strong>{reservation.confirmationNumber}</strong><small>{reservation.hotel?.name}</small></td>
                  <td>{reservation.primaryGuestName}<small>{reservation.primaryGuestEmail}</small></td>
                  <td>{reservation.checkIn}<small>to {reservation.checkOut}</small></td>
                  <td><span className={`status-badge status-${reservation.status}`}>{reservation.status.replace('_', ' ')}</span></td>
                  <td><span className={`status-badge payment-${reservation.paymentStatus}`}>{reservation.paymentStatus}</span></td>
                  <td>{Number(reservation.totalAmount).toFixed(2)} {reservation.currency}</td>
                  <td><ReservationActions reservation={reservation} onAction={handleAction} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && <div className="pagination"><button className="button" type="button" disabled={pagination.page <= 1 || loading} onClick={() => void loadReservations(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="button" type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void loadReservations(pagination.page + 1)}>Next</button></div>}
      </section>
    </DashboardLayout>
  )
}
