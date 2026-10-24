import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

const managerStatuses = ['pending', 'approved', 'rejected', 'suspended']
const hotelStatuses = ['submitted', 'approved', 'rejected', 'suspended', 'draft']

function statusClass(status) {
  return `status-badge status-${status}`
}

export function AdminDashboardPage() {
  const { session } = useAuth()
  const [managerStatus, setManagerStatus] = useState('pending')
  const [hotelStatus, setHotelStatus] = useState('submitted')
  const [managers, setManagers] = useState([])
  const [hotels, setHotels] = useState([])
  const [counts, setCounts] = useState({ managers: 0, hotels: 0, users: 0 })
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const token = session.access_token
    const request = (path) => apiRequest(path, { accessToken: token })

    Promise.all([
      request(`/admin/managers?page=1&limit=100&status=${managerStatus}`),
      request(`/admin/hotels?page=1&limit=100&status=${hotelStatus}`),
      request('/admin/managers?page=1&limit=1&status=pending'),
      request('/admin/hotels?page=1&limit=1&status=submitted'),
      request('/admin/users?page=1&limit=1'),
    ])
      .then(([managerData, hotelData, pendingManagers, submittedHotels, users]) => {
        if (!active) return
        setManagers(managerData.managers)
        setHotels(hotelData.hotels)
        setCounts({
          managers: pendingManagers.pagination.total,
          hotels: submittedHotels.pagination.total,
          users: users.pagination.total,
        })
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [hotelStatus, managerStatus, session.access_token])

  async function updateManager(manager, status) {
    let reason = null
    if (status !== 'approved') {
      reason = window.prompt(`Reason for marking this manager ${status}:`)
      if (reason === null) return
      if (reason.trim().length < 2) {
        setError('A reason of at least 2 characters is required.')
        return
      }
    }

    const actionId = `manager-${manager.id}`
    setPendingAction(actionId)
    setError('')
    try {
      const data = await apiRequest(`/admin/managers/${manager.id}/status`, {
        method: 'PATCH',
        accessToken: session.access_token,
        body: { status, reason },
      })
      setManagers((current) => current.filter((item) => item.id !== manager.id))
      if (manager.managerStatus === 'pending') {
        setCounts((current) => ({ ...current, managers: Math.max(0, current.managers - 1) }))
      }
      if (status === managerStatus) {
        setManagers((current) => [data.manager, ...current])
      }
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setPendingAction('')
    }
  }

  async function updateHotel(hotel, status) {
    let reason = null
    if (status !== 'approved') {
      reason = window.prompt(`Reason for marking this hotel ${status}:`)
      if (reason === null) return
      if (reason.trim().length < 2) {
        setError('A reason of at least 2 characters is required.')
        return
      }
    }

    const actionId = `hotel-${hotel.id}`
    setPendingAction(actionId)
    setError('')
    try {
      const data = await apiRequest(`/admin/hotels/${hotel.id}/status`, {
        method: 'PATCH',
        accessToken: session.access_token,
        body: { status, reason },
      })
      setHotels((current) => current.filter((item) => item.id !== hotel.id))
      if (hotel.status === 'submitted') {
        setCounts((current) => ({ ...current, hotels: Math.max(0, current.hotels - 1) }))
      }
      if (status === hotelStatus) {
        setHotels((current) => [data.hotel, ...current])
      }
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setPendingAction('')
    }
  }

  return (
    <DashboardLayout
      eyebrow="Platform administration"
      title="Admin dashboard"
      subtitle="Approve managers and properties before they can operate publicly."
    >
      <section className="summary-grid admin-summary">
        <article><span>Pending managers</span><strong>{counts.managers}</strong></article>
        <article><span>Hotel submissions</span><strong>{counts.hotels}</strong></article>
        <article><span>Total users</span><strong>{counts.users}</strong></article>
      </section>

      {error && <div className="message message-error" role="alert">{error}</div>}

      <section className="panel admin-panel">
        <div className="panel-heading admin-panel-heading">
          <div><h2>Manager applications</h2><p>Only approved managers can access hotel management.</p></div>
          <label>Status
            <select value={managerStatus} onChange={(event) => setManagerStatus(event.target.value)}>
              {managerStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        {loading && <div className="empty-state compact">Loading manager applications…</div>}
        {!loading && managers.length === 0 && <div className="empty-state compact">No {managerStatus} manager applications.</div>}
        {!loading && managers.length > 0 && (
          <div className="admin-list">
            {managers.map((manager) => (
              <article className="admin-row" key={manager.id}>
                <span className="avatar" aria-hidden="true">{manager.fullName.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{manager.fullName}</h3>
                  <p>{manager.phone || 'No phone provided'} · Applied {new Date(manager.createdAt).toLocaleDateString()}</p>
                  {manager.managerStatusReason && <small>Reason: {manager.managerStatusReason}</small>}
                </div>
                <span className={statusClass(manager.managerStatus)}>{manager.managerStatus}</span>
                <div className="admin-actions">
                  {manager.managerStatus !== 'approved' && <button className="button button-primary" type="button" disabled={pendingAction === `manager-${manager.id}`} onClick={() => void updateManager(manager, 'approved')}>Approve</button>}
                  {manager.managerStatus !== 'rejected' && <button className="button" type="button" disabled={pendingAction === `manager-${manager.id}`} onClick={() => void updateManager(manager, 'rejected')}>Reject</button>}
                  {manager.managerStatus === 'approved' && <button className="button danger-text" type="button" disabled={pendingAction === `manager-${manager.id}`} onClick={() => void updateManager(manager, 'suspended')}>Suspend</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel admin-panel">
        <div className="panel-heading admin-panel-heading">
          <div><h2>Hotel submissions</h2><p>Review submitted properties before they appear in public search.</p></div>
          <label>Status
            <select value={hotelStatus} onChange={(event) => setHotelStatus(event.target.value)}>
              {hotelStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        {loading && <div className="empty-state compact">Loading hotel submissions…</div>}
        {!loading && hotels.length === 0 && <div className="empty-state compact">No {hotelStatus} hotels.</div>}
        {!loading && hotels.length > 0 && (
          <div className="admin-list">
            {hotels.map((hotel) => (
              <article className="admin-row admin-hotel-row" key={hotel.id}>
                <div className="admin-hotel-image">
                  {hotel.coverImageUrl ? <img src={hotel.coverImageUrl} alt="" /> : <span aria-hidden="true">S</span>}
                </div>
                <div>
                  <h3>{hotel.name}</h3>
                  <p>{hotel.address}, {hotel.city}, {hotel.country}</p>
                  <small>Manager: {hotel.manager?.fullName ?? 'Unknown'} · {hotel.currency}</small>
                  {hotel.rejectionReason && <small>Reason: {hotel.rejectionReason}</small>}
                </div>
                <span className={statusClass(hotel.status)}>{hotel.status}</span>
                <div className="admin-actions">
                  {['draft', 'submitted', 'suspended'].includes(hotel.status) && <button className="button button-primary" type="button" disabled={pendingAction === `hotel-${hotel.id}`} onClick={() => void updateHotel(hotel, 'approved')}>Approve</button>}
                  {hotel.status === 'submitted' && <button className="button" type="button" disabled={pendingAction === `hotel-${hotel.id}`} onClick={() => void updateHotel(hotel, 'rejected')}>Reject</button>}
                  {hotel.status === 'approved' && <button className="button danger-text" type="button" disabled={pendingAction === `hotel-${hotel.id}`} onClick={() => void updateHotel(hotel, 'suspended')}>Suspend</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}
