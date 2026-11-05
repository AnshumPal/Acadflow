import { describe, expect, it } from 'vitest'
import axios, { AxiosError } from 'axios'
import { getErrorMessage } from './errors'

const httpError = (status, data) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', {}, {}, { status, data, headers: {}, config: {}, statusText: '' })

describe('getErrorMessage', () => {
  it('returns a FastAPI string detail unchanged', () => {
    const err = httpError(400, { detail: 'No available slots found in matching room types on this day.' })
    expect(getErrorMessage(err)).toBe('No available slots found in matching room types on this day.')
  })

  it('joins Pydantic validation errors with their field path, without the "body" prefix', () => {
    const err = httpError(422, {
      detail: [
        { loc: ['body', 'current_schedule', 'A', 0, 'day'], msg: 'Input should be a valid integer' },
        { loc: ['body', 'num_periods'], msg: 'Field required' },
      ],
    })
    expect(getErrorMessage(err)).toBe(
      'current_schedule.A.0.day: Input should be a valid integer; num_periods: Field required',
    )
  })

  it('serialises an object detail', () => {
    expect(getErrorMessage(httpError(400, { detail: { code: 7 } }))).toBe('{"code":7}')
  })

  it('includes the plain-text body of a 5xx', () => {
    expect(getErrorMessage(httpError(500, 'Internal Server Error'))).toBe('Server error (500): Internal Server Error')
  })

  it('points at the backend when a 5xx has no body (the dev proxy could not connect)', () => {
    expect(getErrorMessage(httpError(500, ''))).toBe(
      'Server error (500). Check that the backend is running, then see its logs.',
    )
  })

  it('uses the text body of a 4xx that has no detail', () => {
    expect(getErrorMessage(httpError(404, 'Not Found'))).toBe('Not Found')
  })

  it('reports an unreachable server when no response came back', () => {
    const err = new AxiosError('Network Error', AxiosError.ERR_NETWORK, {}, {})
    expect(getErrorMessage(err)).toMatch(/Cannot reach the AcadFlow server/)
  })

  it('reports timeouts', () => {
    const err = new AxiosError('timeout of 60000ms exceeded', AxiosError.ECONNABORTED, {}, {})
    expect(getErrorMessage(err)).toBe('The server took too long to respond. Please try again.')
  })

  it('reports cancelled requests', () => {
    expect(getErrorMessage(new axios.CanceledError())).toBe('Request was cancelled.')
  })

  it('falls back to the message of a plain Error (local data source)', () => {
    expect(getErrorMessage(new Error('Could not save to browser storage.'))).toBe('Could not save to browser storage.')
  })

  it('never throws on a missing error', () => {
    expect(getErrorMessage(undefined)).toBe('Request failed')
  })
})
