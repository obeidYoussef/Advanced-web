import {
    createUserSupabase,
    supabaseAuth,
} from '../lib/supabase.js'
import { HttpError } from '../lib/httpError.js'

export async function authenticate(request, _response, next) {
    const authorization = request.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
        return next(
            new HttpError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Authentication required',
            ),
        )
    }

    const accessToken = authorization.slice('Bearer '.length).trim()

    if (!accessToken) {
        return next(
            new HttpError(
                401,
                'AUTHENTICATION_REQUIRED',
                'Authentication required',
            ),
        )
    }

    const {
        data: { user },
        error: authenticationError,
    } = await supabaseAuth.auth.getUser(accessToken)

    if (authenticationError || !user) {
        return next(
            new HttpError(
                401,
                'INVALID_ACCESS_TOKEN',
                'Invalid or expired access token',
            ),
        )
    }

    const supabase = createUserSupabase(accessToken)

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
            'id, full_name, phone, role, manager_status, manager_status_reason',
        )
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        return next(
            new HttpError(
                500,
                'PROFILE_NOT_FOUND',
                'Authenticated user profile was not found',
            ),
        )
    }

    request.auth = {
        user,
        profile,
        accessToken,
        supabase,
    }

    return next()
}
