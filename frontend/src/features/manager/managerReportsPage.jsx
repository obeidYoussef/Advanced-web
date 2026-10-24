import { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { apiRequest, downloadApiFile } from '../../lib/api.js'
import { useAuth } from '../auth/useAuth.js'

function inputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = new Date()
const initialRange = {
  hotelId: '',
  from: inputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  to: inputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
}

export function ManagerReportsPage() {
  const { session } = useAuth()
  const [hotels, setHotels] = useState([])
  const [range, setRange] = useState(initialRange)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/manager/hotels?page=1&limit=100', { accessToken: session.access_token })
      .then((data) => { if (active) setHotels(data.hotels) })
      .catch((loadError) => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [session.access_token])

  async function loadReport(event) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ from: range.from, to: range.to })
    if (range.hotelId) query.set('hotelId', range.hotelId)

    try {
      const data = await apiRequest(`/manager/reports/summary?${query}`, {
        accessToken: session.access_token,
      })
      setReport(data.report)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({
      from: initialRange.from,
      to: initialRange.to,
    })
    apiRequest(`/manager/reports/summary?${query}`, {
      accessToken: session.access_token,
    })
      .then((data) => { if (active) setReport(data.report) })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session.access_token])

  async function downloadCsv() {
    setError('')
    const query = new URLSearchParams({ from: range.from, to: range.to })
    if (range.hotelId) query.set('hotelId', range.hotelId)
    try {
      await downloadApiFile(
        `/manager/reports/reservations.csv?${query}`,
        session.access_token,
        `reservations-${range.from}-${range.to}.csv`,
      )
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  const maxRevenue = Math.max(
    1,
    ...(report?.revenueByMonth.map((item) => item.revenue) ?? []),
  )

  return (
    <DashboardLayout
      eyebrow="Performance"
      title="Reports"
      subtitle="Occupancy, reservation, and revenue results for your hotels."
      action={<button className="button" type="button" disabled={!report} onClick={() => void downloadCsv()}>Export CSV</button>}
    >
      <section className="panel filter-panel">
        <form className="report-filters" onSubmit={loadReport}>
          <label>Hotel<select value={range.hotelId} onChange={(event) => setRange({ ...range, hotelId: event.target.value })}><option value="">All hotels</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label>
          <label>From<input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} required /></label>
          <label>To<input type="date" min={range.from} value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} required /></label>
          <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Update report'}</button>
        </form>
      </section>

      {error && <div className="message message-error" role="alert">{error}</div>}
      {report && (
        <>
          <section className="summary-grid report-summary" aria-label="Report totals">
            <article><span>Reservations</span><strong>{report.totals.reservations}</strong></article>
            <article><span>Gross revenue</span><strong>{report.totals.grossRevenue.toFixed(2)}</strong></article>
            <article><span>Collected revenue</span><strong>{report.totals.collectedRevenue.toFixed(2)}</strong></article>
            <article><span>Occupancy</span><strong>{report.totals.occupancyRate}%</strong></article>
          </section>

          <div className="management-grid">
            <section className="panel compact-panel">
              <div className="panel-heading"><div><h2>Reservation status</h2><p>Distribution in the selected period.</p></div></div>
              <div className="metric-list">
                {Object.entries(report.statusCounts).map(([status, count]) => (
                  <div key={status}><span>{status.replace('_', ' ')}</span><strong>{count}</strong></div>
                ))}
              </div>
            </section>

            <section className="panel compact-panel">
              <div className="panel-heading"><div><h2>Revenue by month</h2><p>Gross revenue excluding cancellations and no-shows.</p></div></div>
              <div className="bar-chart">
                {report.revenueByMonth.map((item) => (
                  <div key={item.month}>
                    <span>{item.month}</span>
                    <div><i style={{ width: `${(item.revenue / maxRevenue) * 100}%` }} /></div>
                    <strong>{item.revenue.toFixed(2)}</strong>
                  </div>
                ))}
                {report.revenueByMonth.length === 0 && <p className="muted-copy">No revenue in this period.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
