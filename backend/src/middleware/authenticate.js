import {
    createUserSupabase,
    supabaseAuth,
} from '../lib/supabase.js'

export async function authenticate(request, response, next) {
    const authorization = request.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
        return response.status(401).json({
            error: {
                message: 'Authentication required',
            },
        })
    }

    const accessToken = authorization.slice('Bearer '.length).trim()

    if (!accessToken) {
        return response.status(401).json({
            error: {
                message: 'Authentication required',
            },
        })
    }

    const {
        data: { user },
        error: authenticationError,
    } = await supabaseAuth.auth.getUser(accessToken)

    if (authenticationError || !user) {
        return response.status(401).json({
            error: {
                message: 'Invalid or expired access token',
            },
        })
    }

    const supabase = createUserSupabase(accessToken)

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, manager_status')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        const error = new Error('Authenticated user profile was not found')
        error.status = 500
        return next(error)
    }

    request.auth = {
        user,
        profile,
        accessToken,
        supabase,
    }

    return next()
}