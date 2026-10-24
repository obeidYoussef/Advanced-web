import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

export function RequireApprovedManager() {
    const { user } = useAuth()

    if (user.role !== 'manager') {
        return <Navigate to="/account" replace />
    }

    if (user.managerStatus !== 'approved') {
        return <Navigate to="/manager/application-status" replace />
    }

    return <Outlet />
}
