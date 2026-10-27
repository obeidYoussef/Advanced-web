import { Router } from 'express'
import { z } from 'zod'
import { paginationFields } from '../../lib/pagination.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import {
    addHotelFacility,
    addHotelImage,
    createHotel,
    deleteHotelImage,
    getManagerHotel,
    listManagerHotels,
    removeHotelFacility,
    updateHotel,
    updateHotelImage,
} from './hotelService.js'
import {
    addRoomTypeAmenity,
    createPriceOverride,
    createRoom,
    createRoomType,
    deletePriceOverride,
    removeRoomTypeAmenity,
    updatePriceOverride,
    updateRoom,
    updateRoomType,
} from './inventoryService.js'

const uuid = z.uuid()
const date = z.iso.date()
const money = z.coerce.number().min(0).max(9999999999.99)
const nonEmptyPatch = (schema) =>
    schema.refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    })

const hotelFields = {
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(5000),
    country: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(250),
    latitude: z.coerce.number().min(-90).max(90).nullable(),
    longitude: z.coerce.number().min(-180).max(180).nullable(),
    coverImageUrl: z.url().max(2000).nullable(),
    contactEmail: z.email().max(254).nullable(),
    contactPhone: z.string().trim().max(30).nullable(),
    currency: z.string().trim().length(3).toUpperCase(),
    serviceFee: money,
    timezoneName: z.string().trim().min(1).max(100),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}

const hotelCreateSchema = z.object({
    body: z.object({
        name: hotelFields.name,
        description: hotelFields.description.default(''),
        country: hotelFields.country,
        city: hotelFields.city,
        address: hotelFields.address,
        latitude: hotelFields.latitude.optional(),
        longitude: hotelFields.longitude.optional(),
        coverImageUrl: hotelFields.coverImageUrl.optional(),
        contactEmail: hotelFields.contactEmail.optional(),
        contactPhone: hotelFields.contactPhone.optional(),
        currency: hotelFields.currency.default('USD'),
        serviceFee: hotelFields.serviceFee.default(0),
        timezoneName: hotelFields.timezoneName.default('UTC'),
        checkInTime: hotelFields.checkInTime.default('15:00'),
        checkOutTime: hotelFields.checkOutTime.default('11:00'),
    }),
})

const hotelUpdateSchema = z.object({
    params: z.object({ hotelId: uuid }),
    body: nonEmptyPatch(
        z.object(
            Object.fromEntries(
                Object.entries(hotelFields).map(([key, schema]) => [
                    key,
                    schema.optional(),
                ]),
            ),
        ),
    ),
})

const roomTypeFields = {
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(5000),
    capacity: z.coerce.number().int().min(1).max(20),
    basePrice: money,
    imageUrl: z.url().max(2000).nullable(),
    isActive: z.boolean(),
}

const roomTypeCreateSchema = z.object({
    params: z.object({ hotelId: uuid }),
    body: z.object({
        name: roomTypeFields.name,
        description: roomTypeFields.description.default(''),
        capacity: roomTypeFields.capacity,
        basePrice: roomTypeFields.basePrice,
        imageUrl: roomTypeFields.imageUrl.optional().default(null),
        amenityIds: z.array(z.coerce.number().int().positive().max(32767)).default([]),
        roomNumbers: z.array(z.string().trim().min(1).max(30)).min(1).max(200),
    }),
})

const roomTypeUpdateSchema = z.object({
    params: z.object({ roomTypeId: uuid }),
    body: nonEmptyPatch(
        z.object(
            Object.fromEntries(
                Object.entries(roomTypeFields).map(([key, schema]) => [
                    key,
                    schema.optional(),
                ]),
            ),
        ),
    ),
})

const roomFields = {
    roomTypeId: uuid,
    roomNumber: z.string().trim().min(1).max(30),
    status: z.enum(['active', 'maintenance', 'inactive']),
}

const priceFields = {
    startDate: date,
    endDate: date,
    nightlyPrice: money,
}

const imageFields = {
    imageUrl: z.url().max(2000),
    altText: z.string().trim().max(200),
    displayOrder: z.coerce.number().int().min(0).max(32767),
}

export const managerRouter = Router()

managerRouter.use(authenticate, authorize('manager'))

managerRouter.get(
    '/hotels',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
            }),
        }),
    ),
    async (request, response) => {
        const result = await listManagerHotels(
            request.auth.supabase,
            request.auth.user.id,
            request.validated.query,
        )
        response.json(result)
    },
)

managerRouter.post(
    '/hotels',
    validate(hotelCreateSchema),
    async (request, response) => {
        const hotel = await createHotel(
            request.auth.supabase,
            request.auth.user.id,
            request.validated.body,
        )
        response.status(201).json({ hotel })
    },
)

managerRouter.get(
    '/hotels/:hotelId',
    validate(z.object({ params: z.object({ hotelId: uuid }) })),
    async (request, response) => {
        const hotel = await getManagerHotel(
            request.auth.supabase,
            request.validated.params.hotelId,
        )
        response.json({ hotel })
    },
)

managerRouter.patch(
    '/hotels/:hotelId',
    validate(hotelUpdateSchema),
    async (request, response) => {
        const hotel = await updateHotel(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.body,
        )
        response.json({ hotel })
    },
)

managerRouter.post(
    '/hotels/:hotelId/facilities/:facilityId',
    validate(
        z.object({
            params: z.object({
                hotelId: uuid,
                facilityId: z.coerce.number().int().positive(),
            }),
        }),
    ),
    async (request, response) => {
        const facility = await addHotelFacility(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.params.facilityId,
        )
        response.status(201).json({ facility })
    },
)

managerRouter.delete(
    '/hotels/:hotelId/facilities/:facilityId',
    validate(
        z.object({
            params: z.object({
                hotelId: uuid,
                facilityId: z.coerce.number().int().positive(),
            }),
        }),
    ),
    async (request, response) => {
        await removeHotelFacility(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.params.facilityId,
        )
        response.status(204).end()
    },
)

managerRouter.post(
    '/hotels/:hotelId/images',
    validate(
        z.object({
            params: z.object({ hotelId: uuid }),
            body: z.object({
                imageUrl: imageFields.imageUrl,
                altText: imageFields.altText.default(''),
                displayOrder: imageFields.displayOrder.default(0),
            }),
        }),
    ),
    async (request, response) => {
        const image = await addHotelImage(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.body,
        )
        response.status(201).json({ image })
    },
)

managerRouter.patch(
    '/images/:imageId',
    validate(
        z.object({
            params: z.object({ imageId: uuid }),
            body: nonEmptyPatch(
                z.object({
                    imageUrl: imageFields.imageUrl.optional(),
                    altText: imageFields.altText.optional(),
                    displayOrder: imageFields.displayOrder.optional(),
                }),
            ),
        }),
    ),
    async (request, response) => {
        const image = await updateHotelImage(
            request.auth.supabase,
            request.validated.params.imageId,
            request.validated.body,
        )
        response.json({ image })
    },
)

managerRouter.delete(
    '/images/:imageId',
    validate(z.object({ params: z.object({ imageId: uuid }) })),
    async (request, response) => {
        await deleteHotelImage(
            request.auth.supabase,
            request.validated.params.imageId,
        )
        response.status(204).end()
    },
)

managerRouter.post(
    '/hotels/:hotelId/room-types',
    validate(roomTypeCreateSchema),
    async (request, response) => {
        const roomType = await createRoomType(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.body,
        )
        response.status(201).json({ roomType })
    },
)

managerRouter.patch(
    '/room-types/:roomTypeId',
    validate(roomTypeUpdateSchema),
    async (request, response) => {
        const roomType = await updateRoomType(
            request.auth.supabase,
            request.validated.params.roomTypeId,
            request.validated.body,
        )
        response.json({ roomType })
    },
)

managerRouter.post(
    '/room-types/:roomTypeId/amenities/:amenityId',
    validate(
        z.object({
            params: z.object({
                roomTypeId: uuid,
                amenityId: z.coerce.number().int().positive(),
            }),
        }),
    ),
    async (request, response) => {
        const amenity = await addRoomTypeAmenity(
            request.auth.supabase,
            request.validated.params.roomTypeId,
            request.validated.params.amenityId,
        )
        response.status(201).json({ amenity })
    },
)

managerRouter.delete(
    '/room-types/:roomTypeId/amenities/:amenityId',
    validate(
        z.object({
            params: z.object({
                roomTypeId: uuid,
                amenityId: z.coerce.number().int().positive(),
            }),
        }),
    ),
    async (request, response) => {
        await removeRoomTypeAmenity(
            request.auth.supabase,
            request.validated.params.roomTypeId,
            request.validated.params.amenityId,
        )
        response.status(204).end()
    },
)

managerRouter.post(
    '/hotels/:hotelId/rooms',
    validate(
        z.object({
            params: z.object({ hotelId: uuid }),
            body: z.object({
                roomTypeId: roomFields.roomTypeId,
                roomNumber: roomFields.roomNumber,
                status: roomFields.status.default('active'),
            }),
        }),
    ),
    async (request, response) => {
        const room = await createRoom(
            request.auth.supabase,
            request.validated.params.hotelId,
            request.validated.body,
        )
        response.status(201).json({ room })
    },
)

managerRouter.patch(
    '/rooms/:roomId',
    validate(
        z.object({
            params: z.object({ roomId: uuid }),
            body: nonEmptyPatch(
                z.object({
                    roomTypeId: roomFields.roomTypeId.optional(),
                    roomNumber: roomFields.roomNumber.optional(),
                    status: roomFields.status.optional(),
                }),
            ),
        }),
    ),
    async (request, response) => {
        const room = await updateRoom(
            request.auth.supabase,
            request.validated.params.roomId,
            request.validated.body,
        )
        response.json({ room })
    },
)

managerRouter.post(
    '/room-types/:roomTypeId/price-overrides',
    validate(
        z.object({
            params: z.object({ roomTypeId: uuid }),
            body: z
                .object(priceFields)
                .refine((value) => value.endDate >= value.startDate, {
                    message: 'endDate must be on or after startDate',
                }),
        }),
    ),
    async (request, response) => {
        const priceOverride = await createPriceOverride(
            request.auth.supabase,
            request.validated.params.roomTypeId,
            request.validated.body,
        )
        response.status(201).json({ priceOverride })
    },
)

managerRouter.patch(
    '/price-overrides/:overrideId',
    validate(
        z.object({
            params: z.object({ overrideId: uuid }),
            body: nonEmptyPatch(
                z.object({
                    startDate: priceFields.startDate.optional(),
                    endDate: priceFields.endDate.optional(),
                    nightlyPrice: priceFields.nightlyPrice.optional(),
                }),
            ),
        }),
    ),
    async (request, response) => {
        const priceOverride = await updatePriceOverride(
            request.auth.supabase,
            request.validated.params.overrideId,
            request.validated.body,
        )
        response.json({ priceOverride })
    },
)

managerRouter.delete(
    '/price-overrides/:overrideId',
    validate(z.object({ params: z.object({ overrideId: uuid }) })),
    async (request, response) => {
        await deletePriceOverride(
            request.auth.supabase,
            request.validated.params.overrideId,
        )
        response.status(204).end()
    },
)
