// Thin re-exports of @randroids-dojo/vibekit storage helpers. The wrapper
// exists so LetGo's zod v4 schemas can be passed through vibekit's zod v3
// typed signatures without polluting every call site with an `as never` cast;
// safeParse runtime behavior matches across the v3/v4 boundary.

import { readStorage as readVibekit, writeStorage as writeVibekit } from '@randroids-dojo/vibekit'
import type { z } from 'zod'

export function readStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  return readVibekit(key, schema as never)
}

export function writeStorage(key: string, value: unknown): boolean {
  return writeVibekit(key, value)
}
