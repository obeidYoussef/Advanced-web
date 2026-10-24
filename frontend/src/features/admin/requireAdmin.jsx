import { Navigate, Outlet } from 'react-router'
import { getHomePath } from '../auth/getHomePath.js'
import { useAuth } from '../auth/useAuth.js'

export function RequireAdmin() {
    const { user } = useAuth()

    if (user.role !== 'admin') {
        return <Navigate to={getHomePath(user)} replace />
    }

    return <Outlet />
}