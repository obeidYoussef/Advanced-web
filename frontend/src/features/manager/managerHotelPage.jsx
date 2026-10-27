import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DashboardLayout } from '../../components/dashboardLayout.jsx'
import { FormField } from '../../components/formField.jsx'
import { apiRequest } from '../../lib/api.js'
import { uploadHotelImage } from '../../lib/uploadImage.js'
import { useAuth } from '../auth/useAuth.js'

function HotelDetailsForm({ hotel, mutate }) {
  const [form, setForm] = useState({
    name: hotel.name,
    description: hotel.description,
    country: hotel.country,
    city: hotel.city,
    address: hotel.address,
    latitude: hotel.latitude ?? '',
    longitude: hotel.longitude ?? '',
    coverImageUrl: hotel.coverImageUrl ?? '',
    contactEmail: hotel.contactEmail ?? '',
    contactPhone: hotel.contactPhone ?? '',
    currency: hotel.currency,
    serviceFee: hotel.serviceFee,
    timezoneName: hotel.timezoneName,
    checkInTime: hotel.checkInTime.slice(0, 5),
    checkOutTime: hotel.checkOutTime.slice(0, 5),
  })

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    void mutate(`/manager/hotels/${hotel.id}`, {
      method: 'PATCH',
      body: {
        ...form,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
        coverImageUrl: form.coverImageUrl || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
      },
      success: 'Hotel details saved.',
    })
  }

  return (
    <section className="panel create-panel">
      <div className="panel-heading">
        <div><h2>Property details</h2><p>Public information, pricing rules, and local times.</p></div>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <FormField label="Hotel name" name="name" value={form.name} onChange={updateField} minLength="2" maxLength="150" required />
        <FormField label="Contact email" name="contactEmail" type="email" value={form.contactEmail} onChange={updateField} required />
        <label className="form-field form-wide">
          <span>Description</span>
          <textarea name="description" rows="4" value={form.description} onChange={updateField} minLength="20" maxLength="5000" required />
        </label>
        <FormField label="Country" name="country" value={form.country} onChange={updateField} required />
        <FormField label="City" name="city" value={form.city} onChange={updateField} required />
        <FormField label="Address" name="address" value={form.address} onChange={updateField} required />
        <FormField label="Contact phone" name="contactPhone" type="tel" value={form.contactPhone} onChange={updateField} />
        <FormField label="Latitude" name="latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={updateField} required />
        <FormField label="Longitude" name="longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={updateField} required />
        <FormField label="Cover image URL" name="coverImageUrl" type="url" value={form.coverImageUrl} onChange={updateField} />
        <FormField label="Currency" name="currency" value={form.currency} onChange={updateField} minLength="3" maxLength="3" required />
        <FormField label="Service fee" name="serviceFee" type="number" step="0.01" min="0" value={form.serviceFee} onChange={updateField} required />
        <FormField label="Timezone" name="timezoneName" value={form.timezoneName} onChange={updateField} placeholder="Asia/Beirut" required />
        <FormField label="Check-in time" name="checkInTime" type="time" value={form.checkInTime} onChange={updateField} required />
        <FormField label="Check-out time" name="checkOutTime" type="time" value={form.checkOutTime} onChange={updateField} required />
        <div className="form-actions"><button className="button button-primary" type="submit">Save details</button></div>
      </form>
    </section>
  )
}

function FacilitiesPanel({ hotel, facilities, mutate }) {
  const selected = new Set(hotel.hotelFacilities.map((item) => item.facility.id))

  function toggle(facilityId, checked) {
    void mutate(`/manager/hotels/${hotel.id}/facilities/${facilityId}`, {
      method: checked ? 'POST' : 'DELETE',
      success: 'Facilities updated.',
    })
  }

  return (
    <section className="panel compact-panel">
      <div className="panel-heading"><div><h2>Facilities</h2><p>Select the services available at this hotel.</p></div></div>
      <div className="choice-grid">
        {facilities.map((facility) => (
          <label className="choice" key={facility.id}>
            <input type="checkbox" checked={selected.has(facility.id)} onChange={(event) => toggle(facility.id, event.target.checked)} />
            <span>{facility.name}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function ImagesPanel({ hotel, mutate }) {
  const [form, setForm] = useState({ imageUrl: '', altText: '' })

  function handleSubmit(event) {
    event.preventDefault()
    void mutate(`/manager/hotels/${hotel.id}/images`, {
      method: 'POST',
      body: form,
      success: 'Image added.',
      after: () => setForm({ imageUrl: '', altText: '' }),
    })
  }

  return (
    <section className="panel compact-panel">
      <div className="panel-heading"><div><h2>Images</h2><p>Use public HTTPS image URLs.</p></div></div>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input type="url" aria-label="Image URL" placeholder="https://…" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} required />
        <input aria-label="Alternative text" placeholder="Lobby at sunset" value={form.altText} onChange={(event) => setForm({ ...form, altText: event.target.value })} maxLength="200" />
        <button className="button button-primary" type="submit">Add image</button>
      </form>
      <div className="image-list">
        {hotel.hotelImages.map((image) => (
          <article key={image.id}>
            <img src={image.imageUrl} alt={image.altText} />
            <span>{image.altText || 'Hotel image'}</span>
            <button className="text-button danger-text" type="button" onClick={() => void mutate(`/manager/images/${image.id}`, { method: 'DELETE', success: 'Image removed.' })}>Remove</button>
          </article>
        ))}
        {hotel.hotelImages.length === 0 && <p className="muted-copy">No additional images yet.</p>}
      </div>
    </section>
  )
}

function RoomTypeEditor({ hotel, roomType, amenities, mutate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: roomType.name,
    description: roomType.description,
    capacity: roomType.capacity,
    basePrice: roomType.basePrice,
    imageUrl: roomType.imageUrl ?? '',
    isActive: roomType.isActive,
  })
  const selected = new Set(roomType.roomTypeAmenities.map((item) => item.amenity.id))

  function save(event) {
    event.preventDefault()
    void mutate(`/manager/room-types/${roomType.id}`, {
      method: 'PATCH',
      body: { ...form, imageUrl: form.imageUrl || null },
      success: 'Room details updated.',
      after: () => setEditing(false),
    })
  }

  function toggleAmenity(amenityId, checked) {
    void mutate(`/manager/room-types/${roomType.id}/amenities/${amenityId}`, {
      method: checked ? 'POST' : 'DELETE',
      success: 'Room amenities updated.',
    })
  }

  return (
    <article className="room-type-card">
      {roomType.imageUrl && <img className="room-type-image" src={roomType.imageUrl} alt="" />}
      <div className="item-heading">
        <div><h3>{roomType.name}</h3><p>{roomType.capacity} guests · {Number(roomType.basePrice).toFixed(2)} {hotel.currency} · {roomType.rooms.length} physical room{roomType.rooms.length === 1 ? '' : 's'}</p></div>
        <div className="button-row">
          <button className="button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? 'Close' : 'Edit'}</button>
          <button className="button" type="button" onClick={() => void mutate(`/manager/room-types/${roomType.id}`, { method: 'PATCH', body: { isActive: !roomType.isActive }, success: 'Room availability updated.' })}>{roomType.isActive ? 'Hide from website' : 'Show on website'}</button>
        </div>
      </div>
      {editing && (
        <form className="form-grid room-type-form" onSubmit={save}>
          <FormField label="Room name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <FormField label="Maximum guests" name="capacity" type="number" min="1" max="20" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required />
          <FormField label="Base nightly price" name="basePrice" type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} required />
          <FormField label="Image URL" name="imageUrl" type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          <label className="form-field form-wide"><span>Description</span><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit">Save room</button></div>
        </form>
      )}
      <div className="choice-grid choice-grid-small">
        {amenities.map((amenity) => (
          <label className="choice" key={amenity.id}>
            <input type="checkbox" checked={selected.has(amenity.id)} onChange={(event) => toggleAmenity(amenity.id, event.target.checked)} />
            <span>{amenity.name}</span>
          </label>
        ))}
      </div>
    </article>
  )
}

const emptyRoomType = {
  name: '',
  description: '',
  capacity: '2',
  basePrice: '',
  imageUrl: '',
  imageFile: null,
  roomNumbers: '',
  amenityIds: [],
}

function RoomTypesPanel({ hotel, amenities, mutate, userId, onError }) {
  const [form, setForm] = useState(emptyRoomType)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setUploading(true)
    try {
      const imageUrl = form.imageFile
        ? await uploadHotelImage(form.imageFile, userId)
        : form.imageUrl || null
      await mutate(`/manager/hotels/${hotel.id}/room-types`, {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description,
          capacity: form.capacity,
          basePrice: form.basePrice,
          imageUrl,
          amenityIds: form.amenityIds,
          roomNumbers: form.roomNumbers.split(',').map((value) => value.trim()).filter(Boolean),
        },
        success: 'Room created and published.',
        after: () => setForm(emptyRoomType),
      })
    } catch (uploadError) {
      onError(uploadError.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="panel create-panel">
      <div className="panel-heading"><div><h2>Create a room</h2><p>Add the complete guest-facing room and its physical room numbers in one step.</p></div></div>
      <form className="form-grid room-type-form" onSubmit={handleSubmit}>
        <FormField label="Room name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Deluxe double room" required />
        <FormField label="Maximum guests" name="capacity" type="number" min="1" max="20" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required />
        <FormField label="Base nightly price" name="basePrice" type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} required />
        <FormField label="Physical room numbers" name="roomNumbers" value={form.roomNumbers} onChange={(event) => setForm({ ...form, roomNumbers: event.target.value })} placeholder="101, 102, 103" required />
        <label className="form-field form-wide"><span>Description</span><textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Beds, view, size, and anything guests should know." /></label>
        <FormField label="Image URL" name="imageUrl" type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value, imageFile: null })} placeholder="https://…" />
        <label className="form-field"><span>Or upload an image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, imageFile: event.target.files[0] ?? null, imageUrl: '' })} /></label>
        <fieldset className="form-wide choice-fieldset">
          <legend>Room amenities</legend>
          <div className="choice-grid choice-grid-small">
            {amenities.map((amenity) => (
              <label className="choice" key={amenity.id}>
                <input type="checkbox" checked={form.amenityIds.includes(amenity.id)} onChange={(event) => setForm((current) => ({ ...current, amenityIds: event.target.checked ? [...current.amenityIds, amenity.id] : current.amenityIds.filter((id) => id !== amenity.id) }))} />
                <span>{amenity.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-actions"><button className="button button-primary" type="submit" disabled={uploading}>{uploading ? 'Creating…' : 'Create room'}</button></div>
      </form>
      <div className="stack-list">
        {hotel.roomTypes.map((roomType) => <RoomTypeEditor key={roomType.id} hotel={hotel} roomType={roomType} amenities={amenities} mutate={mutate} />)}
        {hotel.roomTypes.length === 0 && <p className="muted-copy padded-copy">No rooms yet.</p>}
      </div>
    </section>
  )
}

function RoomInventoryPanel({ hotel, mutate }) {
  const rooms = hotel.roomTypes.flatMap((roomType) => roomType.rooms.map((room) => ({ ...room, roomTypeName: roomType.name })))

  return (
    <section className="panel compact-panel">
      <div className="panel-heading"><div><h2>Room inventory</h2><p>Room numbers are added in the room form above. Use this list only to change their operational status.</p></div></div>
      <div className="simple-table">
        {rooms.map((room) => (
          <div key={room.id}><strong>{room.roomNumber}</strong><span>{room.roomTypeName}</span><select aria-label={`Status for room ${room.roomNumber}`} value={room.status} onChange={(event) => void mutate(`/manager/rooms/${room.id}`, { method: 'PATCH', body: { status: event.target.value }, success: 'Room status updated.' })}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></div>
        ))}
        {rooms.length === 0 && <p className="muted-copy padded-copy">No physical rooms yet.</p>}
      </div>
    </section>
  )
}

function PricingPanel({ hotel, mutate }) {
  const [form, setForm] = useState({ roomTypeId: hotel.roomTypes[0]?.id ?? '', startDate: '', endDate: '', nightlyPrice: '' })
  const overrides = hotel.roomTypes.flatMap((roomType) => roomType.priceOverrides.map((price) => ({ ...price, roomTypeName: roomType.name })))

  function handleSubmit(event) {
    event.preventDefault()
    const { roomTypeId, ...body } = form
    void mutate(`/manager/room-types/${roomTypeId}/price-overrides`, {
      method: 'POST', body, success: 'Price override created.',
      after: () => setForm((current) => ({ ...current, startDate: '', endDate: '', nightlyPrice: '' })),
    })
  }

  return (
    <section className="panel compact-panel">
      <div className="panel-heading"><div><h2>Date pricing</h2><p>Overrides cannot overlap for the same room type.</p></div></div>
      {hotel.roomTypes.length > 0 && (
        <form className="pricing-form" onSubmit={handleSubmit}>
          <select aria-label="Room type" value={form.roomTypeId} onChange={(event) => setForm({ ...form, roomTypeId: event.target.value })} required>{hotel.roomTypes.map((roomType) => <option key={roomType.id} value={roomType.id}>{roomType.name}</option>)}</select>
          <input aria-label="Start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
          <input aria-label="End date" type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
          <input aria-label="Nightly price" type="number" min="0" step="0.01" placeholder="Nightly price" value={form.nightlyPrice} onChange={(event) => setForm({ ...form, nightlyPrice: event.target.value })} required />
          <button className="button button-primary" type="submit">Add price</button>
        </form>
      )}
      <div className="simple-table">
        {overrides.map((price) => (
          <div key={price.id}><strong>{price.roomTypeName}</strong><span>{price.startDate} – {price.endDate}</span><span>{Number(price.nightlyPrice).toFixed(2)} {hotel.currency}</span><button className="text-button danger-text" type="button" onClick={() => void mutate(`/manager/price-overrides/${price.id}`, { method: 'DELETE', success: 'Price override removed.' })}>Remove</button></div>
        ))}
        {overrides.length === 0 && <p className="muted-copy padded-copy">Base prices apply to every date.</p>}
      </div>
    </section>
  )
}

export function ManagerHotelPage() {
  const { hotelId } = useParams()
  const { session, user } = useAuth()
  const [hotel, setHotel] = useState(null)
  const [lookups, setLookups] = useState({ facilities: [], amenities: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const inventoryKey = hotel?.roomTypes.map((roomType) => roomType.id).join('-') ?? ''

  const loadHotel = useCallback(async () => {
    const data = await apiRequest(`/manager/hotels/${hotelId}`, { accessToken: session.access_token })
    setHotel(data.hotel)
  }, [hotelId, session.access_token])

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest(`/manager/hotels/${hotelId}`, { accessToken: session.access_token }),
      apiRequest('/public/lookups'),
    ])
      .then(([hotelData, lookupData]) => {
        if (!active) return
        setHotel(hotelData.hotel)
        setLookups(lookupData)
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hotelId, session.access_token])

  async function mutate(path, options) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(path, { method: options.method, body: options.body, accessToken: session.access_token })
      await loadHotel()
      options.after?.()
      setMessage(options.success)
    } catch (mutationError) {
      setError(mutationError.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <main className="status-page">Loading hotel workspace…</main>
  if (!hotel) return <main className="status-page"><div className="message message-error">{error || 'Hotel not found.'}</div></main>

  return (
    <DashboardLayout
      eyebrow="Hotel management"
      title={hotel.name}
      subtitle={`${hotel.city}, ${hotel.country}`}
    >
      <div className="management-toolbar"><Link to="/manager">← All hotels</Link>{busy && <span>Saving…</span>}</div>
      {error && <div className="message message-error" role="alert">{error}</div>}
      {message && <div className="message message-success" role="status">{message}</div>}

      <HotelDetailsForm key={hotel.updatedAt} hotel={hotel} mutate={mutate} />
      <div className="management-grid">
        <FacilitiesPanel hotel={hotel} facilities={lookups.facilities} mutate={mutate} />
        <ImagesPanel hotel={hotel} mutate={mutate} />
      </div>
      <RoomTypesPanel hotel={hotel} amenities={lookups.amenities} mutate={mutate} userId={user.id} onError={setError} />
      <div className="management-grid">
        <RoomInventoryPanel key={`rooms-${inventoryKey}`} hotel={hotel} mutate={mutate} />
        <PricingPanel key={`prices-${inventoryKey}`} hotel={hotel} mutate={mutate} />
      </div>
    </DashboardLayout>
  )
}
