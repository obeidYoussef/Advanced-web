import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

export function RequireManager() {
  const { user } = useAuth()

  return user.role === 'manager'
    ? <Outlet />
    : <Navigate to="/account" replace />
}
