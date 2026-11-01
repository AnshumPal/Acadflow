import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../api/errors'

/**
 * Loads async data with loading/error state. `load` must be memoised (useCallback); it re-runs
 * whenever `load` changes, and responses from superseded requests are ignored.
 */
export function useResource(load, initialValue) {
  const [data, setData] = useState(initialValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequest = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    setError('')
    try {
      const result = await load()
      if (requestId === latestRequest.current) setData(result)
    } catch (e) {
      if (requestId === latestRequest.current) setError(getErrorMessage(e))
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [load])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, setData, loading, error, reload }
}
