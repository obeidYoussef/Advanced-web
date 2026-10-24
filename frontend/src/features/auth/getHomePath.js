export function getHomePath(user) {
  if (user?.role === 'admin') {
    return '/admin'
  }

  if (user?.role === 'manager') {
    return user.managerStatus === 'approved'
      ? '/manager'
      : '/manager/application-status'
  }

  if (user?.role === 'customer') {
    return '/customer'
  }

  return '/account'
}