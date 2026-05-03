/**
 * lib/api.ts — Base HTTP client for Ja Lite frontend.
 *
 * All requests go to the FastAPI backend.
 * Base URL is set via NEXT_PUBLIC_API_URL in .env.local.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY
const DEFAULT_TIMEOUT_MS = 30000

async function request<T>(path: string, options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const url = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    ...(options?.headers as Record<string, string> | undefined),
  }

  if (DEMO_API_KEY) {
    headers['X-API-Key'] = DEMO_API_KEY
  }

  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API ${res.status} on ${path}: ${body}`)
    }

    if (res.status === 204) {
      return undefined as T
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const body = await res.text()
      throw new Error(`API returned non-JSON on ${path}: ${body}`)
    }

    return res.json() as Promise<T>
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API timeout after ${DEFAULT_TIMEOUT_MS}ms on ${path}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, timeoutMs?: number) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, timeoutMs),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}