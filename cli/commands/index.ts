import type { CommandDef } from 'citty'

const _rDefault = (r: any) => (r.default || r) as Promise<CommandDef>

export const commands = {
  fetch: () => import('./fetch').then(_rDefault),
  combine: () => import('./combine').then(_rDefault),
  push: () => import('./push').then(_rDefault),
} as const
