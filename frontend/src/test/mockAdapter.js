import { AxiosError } from 'axios'

/**
 * Routes every request of an axios instance to `handler(config) → { status, data }` and returns
 * the list of request configs it received. Statuses >= 400 reject like a real server error, so
 * interceptors and getErrorMessage() see exactly what they would in the browser.
 */
export function mockAdapter(instance, handler) {
  const calls = []
  instance.defaults.adapter = async (config) => {
    calls.push(config)
    const { status = 200, data = null } = (await handler(config)) ?? {}
    const response = { status, statusText: String(status), data, headers: {}, config, request: {} }
    if (status >= 400) {
      const code = status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST
      throw new AxiosError(`Request failed with status code ${status}`, code, config, {}, response)
    }
    return response
  }
  return calls
}

/** The JSON body a request config carries. */
export const bodyOf = (config) => (typeof config.data === 'string' ? JSON.parse(config.data) : config.data)
