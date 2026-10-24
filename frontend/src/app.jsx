import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAdmin } from './features/admin/requireAdmin.jsx'
import { AccountPage } from './features/account/accountPage.jsx'
import { LoginPage } from './features/auth/loginPage.jsx'
import { RegisterPage } from './features/auth/registerPage.jsx'
import { RequireAuth } from './features/auth/requireAuth.jsx'
import { RequireCustomer } from './features/customer/requireCustomer.jsx'
import { ManagerApplicationStatusPage } from './features/manager/managerApplicationStatusPage.jsx'
import { RequireApprovedManager } from './features/manager/requireApprovedManager.jsx'
import { HomePage } from './features/public/homePage.jsx'

const HotelDetailsPage = lazy(() =>
  import('./features/public/hotelDetailsPage.jsx').then((module) => ({
    default: module.HotelDetailsPage,
  })),
)
const AdminDashboardPage = lazy(() =>
  import('./features/admin/adminDashboardPage.jsx').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)
const BookingPage = lazy(() =>
  import('./features/customer/bookingPage.jsx').then((module) => ({
    default: module.BookingPage,
  })),
)
const CustomerDashboardPage = lazy(() =>
  import('./features/customer/customerDashboardPage.jsx').then((module) => ({
    default: module.CustomerDashboardPage,
  })),
)
const ManagerDashboardPage = lazy(() =>
  import('./features/manager/managerDashboardPage.jsx').then((module) => ({
    default: module.ManagerDashboardPage,
  })),
)

const ManagerHotelPage = lazy(() =>
  import('./features/manager/managerHotelPage.jsx').then((module) => ({
    default: module.ManagerHotelPage,
  })),
)
const ManagerReservationsPage = lazy(() =>
  import('./features/manager/managerReservationsPage.jsx').then((module) => ({
    default: module.ManagerReservationsPage,
  })),
)
const ManagerReportsPage = lazy(() =>
  import('./features/manager/managerReportsPage.jsx').then((module) => ({
    default: module.ManagerReportsPage,
  })),
)

export default function App() {
  return (
    <Suspense fallback={<main className="status-page">Loading…</main>}>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/hotels/:hotelId" element={<HotelDetailsPage />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/account" element={<AccountPage />} />

        <Route element={<RequireCustomer />}>
          <Route path="/customer" element={<CustomerDashboardPage />} />
          <Route path="/book/:roomTypeId" element={<BookingPage />} />
        </Route>

        <Route
          path="/manager/application-status"
          element={<ManagerApplicationStatusPage />}
        />

        <Route element={<RequireApprovedManager />}>
          <Route path="/manager" element={<ManagerDashboardPage />} />
          <Route path="/manager/hotels/:hotelId" element={<ManagerHotelPage />} />
          <Route path="/manager/reservations" element={<ManagerReservationsPage />} />
          <Route path="/manager/reports" element={<ManagerReportsPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
