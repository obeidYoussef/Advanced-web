function camelCaseKey(key) {
    return key.replace(/_([a-z])/g, (_match, letter) =>
        letter.toUpperCase(),
    )
}

export function toCamelCase(value) {
    if (Array.isArray(value)) {
        return value.map(toCamelCase)
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                camelCaseKey(key),
                toCamelCase(item),
            ]),
        )
    }

    return value
}
