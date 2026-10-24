const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

if (!apiUrl) {
    throw new Error('VITE_API_URL is missing')
}

export async function apiRequest(
    path,
    {
        method = 'GET',
        body,
        accessToken,
    } = {},
    ) {
    const headers = new Headers({
        Accept: 'application/json',
    })

    if (body !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers,
        body:
        body === undefined
            ? undefined
            : JSON.stringify(body),
    })

    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json')
    ? await response.json()
    : null

    if (!response.ok) {
        const error = new Error(
            data?.error?.message ?? 'Request failed',
        )

        error.status = response.status
        throw error
    }

    return data
}