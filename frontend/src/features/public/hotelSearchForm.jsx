const now = new Date()
const today = new Date(
  now.getTime() - now.getTimezoneOffset() * 60_000,
).toISOString().slice(0, 10)

export function HotelSearchForm({ form, onChange, onSubmit, compact = false }) {
  return (
    <form
      className={`search-form${compact ? ' search-form-compact' : ''}`}
      onSubmit={onSubmit}
    >
      <label>
        Destination
        <input
          name="city"
          value={form.city}
          onChange={onChange}
          placeholder="City, for example Beirut"
        />
      </label>
      <label>
        Check-in
        <input
          name="checkIn"
          type="date"
          min={today}
          value={form.checkIn}
          onChange={onChange}
        />
      </label>
      <label>
        Check-out
        <input
          name="checkOut"
          type="date"
          min={form.checkIn || today}
          value={form.checkOut}
          onChange={onChange}
        />
      </label>
      <label>
        Guests
        <input
          name="guests"
          type="number"
          min="1"
          max="20"
          value={form.guests}
          onChange={onChange}
        />
      </label>
      <button className="button button-primary search-button" type="submit">
        Search
      </button>
    </form>
  )
}
