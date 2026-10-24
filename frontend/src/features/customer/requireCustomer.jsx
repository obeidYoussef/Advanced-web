import { Navigate, Outlet } from 'react-router'
import { getHomePath } from '../auth/getHomePath.js'
import { useAuth } from '../auth/useAuth.js'

export function RequireCustomer() {
    const { user } = useAuth()

    if (user.role !== 'customer') {
        return <Navigate to={getHomePath(user)} replace />
    }

    return <Outlet />
}