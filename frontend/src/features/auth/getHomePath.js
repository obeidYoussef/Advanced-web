export function getHomePath(user) {
  if (user?.role === 'admin') {
    return '/admin'
  }

  if (user?.role === 'manager') {
    return '/manager'
  }

  if (user?.role === 'customer') {
    return '/'
  }

  return '/account'
}
