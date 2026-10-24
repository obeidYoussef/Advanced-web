import { Navigate, Route, Routes } from 'react-router'
import { AdminDashboardPage } from './features/admin/adminDashboardPage.jsx'
import { RequireAdmin } from './features/admin/requireAdmin.jsx'
import { AccountPage } from './features/account/accountPage.jsx'
import { LoginPage } from './features/auth/loginPage.jsx'
import { RegisterPage } from './features/auth/registerPage.jsx'
import { RequireAuth } from './features/auth/requireAuth.jsx'
import { CustomerDashboardPage } from './features/customer/customerDashboardPage.jsx'
import { RequireCustomer } from './features/customer/requireCustomer.jsx'
import { ManagerApplicationStatusPage } from './features/manager/managerApplicationStatusPage.jsx'
import { ManagerDashboardPage } from './features/manager/managerDashboardPage.jsx'
import { RequireApprovedManager } from './features/manager/requireApprovedManager.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/account" element={<AccountPage />} />

        <Route element={<RequireCustomer />}>
          <Route path="/customer" element={<CustomerDashboardPage />} />
        </Route>

        <Route
          path="/manager/application-status"
          element={<ManagerApplicationStatusPage />}
        />

        <Route element={<RequireApprovedManager />}>
          <Route path="/manager" element={<ManagerDashboardPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}