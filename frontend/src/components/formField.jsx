export function FormField({
  label,
  error,
  ...inputProperties
}) {
  const id = inputProperties.id ?? inputProperties.name
  const errorId = `${id}-error`

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>

      <input
        {...inputProperties}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
