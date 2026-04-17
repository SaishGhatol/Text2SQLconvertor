export function formatApiError(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item?.msg && Array.isArray(item?.loc)) return `${item.loc.join(' -> ')}: ${item.msg}`
        if (item?.msg) return item.msg
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      })
      .join('; ')
  }

  if (detail && typeof detail === 'object') {
    if (detail.msg) return detail.msg
    try {
      return JSON.stringify(detail)
    } catch {
      return fallback
    }
  }

  if (typeof detail === 'string' && detail.trim()) return detail
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}
