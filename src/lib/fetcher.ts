export class DbNotConfiguredError extends Error {
  constructor() {
    super('DB_NOT_CONFIGURED')
    this.name = 'DbNotConfiguredError'
  }
}

/** SWR fetcher that surfaces DB config errors distinctly */
export async function fetcher(url: string) {
  const res = await fetch(url)

  if (res.status === 503) {
    const json = await res.json().catch(() => ({}))
    if (json?.code === 'DB_NOT_CONFIGURED') {
      throw new DbNotConfiguredError()
    }
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    const err = new Error(json?.error ?? `Request failed: ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  return res.json()
}

export function isDbNotConfigured(err: unknown): boolean {
  return err instanceof DbNotConfiguredError || (err as Error)?.message === 'DB_NOT_CONFIGURED'
}
