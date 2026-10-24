export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-heading">
          <span className="eyebrow">Hotel Reservation</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {children}

        {footer && <div className="auth-footer">{footer}</div>}
      </section>
    </main>
  )
}
