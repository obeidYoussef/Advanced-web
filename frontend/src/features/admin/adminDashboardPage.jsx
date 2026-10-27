import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { apiRequest } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

export function AdminDashboardPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState([])
  const [hotels, setHotels] = useState([])
  const [counts, setCounts] = useState({ users: 0, managers: 0, hotels: 0, reservations: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const options = { accessToken: session.access_token }
    Promise.all([
      apiRequest('/admin/users?page=1&limit=100', options),
      apiRequest('/admin/users?page=1&limit=1&role=manager', options),
      apiRequest('/admin/hotels?page=1&limit=100', options),
      apiRequest('/admin/reservations?page=1&limit=1', options),
    ])
      .then(([userData, managerData, hotelData, reservationData]) => {
        if (!active) return
        setUsers(userData.users)
        setHotels(hotelData.hotels)
        setCounts({
          users: userData.pagination.total,
          managers: managerData.pagination.total,
          hotels: hotelData.pagination.total,
          reservations: reservationData.pagination.total,
        })
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [session.access_token])

  return (
    <DashboardLayout
      eyebrow="Platform administration"
      title="Admin overview"
      subtitle="Monitor users, hotels, and reservations across the platform."
    >
      <section className="summary-grid admin-summary">
        <article><span>Total users</span><strong>{counts.users}</strong></article>
        <article><span>Managers</span><strong>{counts.managers}</strong></article>
        <article><span>Hotels</span><strong>{counts.hotels}</strong></article>
        <article><span>Reservations</span><strong>{counts.reservations}</strong></article>
      </section>

      {error && <div className="message message-error" role="alert">{error}</div>}
      {loading && <div className="empty-state compact">Loading platform data…</div>}

      {!loading && (
        <>
          <section className="panel admin-panel">
            <div className="panel-heading"><div><h2>Hotels</h2><p>All manager-created hotels are published immediately.</p></div></div>
            <div className="admin-list">
              {hotels.map((hotel) => (
                <article className="admin-row admin-hotel-row" key={hotel.id}>
                  <div className="admin-hotel-image">{hotel.coverImageUrl ? <img src={hotel.coverImageUrl} alt="" /> : <span aria-hidden="true">S</span>}</div>
                  <div><h3>{hotel.name}</h3><p>{hotel.address}, {hotel.city}, {hotel.country}</p><small>Manager: {hotel.manager?.fullName ?? 'Unknown'} · {hotel.currency}</small></div>
                </article>
              ))}
              {hotels.length === 0 && <div className="empty-state compact">No hotels yet.</div>}
            </div>
          </section>

          <section className="panel admin-panel">
            <div className="panel-heading"><div><h2>Users</h2><p>Recent customer, manager, and admin accounts.</p></div></div>
            <div className="admin-list">
              {users.map((user) => (
                <article className="admin-row" key={user.id}>
                  <span className="avatar" aria-hidden="true">{user.fullName.slice(0, 2).toUpperCase()}</span>
                  <div><h3>{user.fullName}</h3><p>{user.email || user.phone || 'No contact information'} · Joined {new Date(user.createdAt).toLocaleDateString()}</p></div>
                  <span className="status-badge">{user.role}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  )
}
