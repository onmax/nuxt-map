import { Parser } from '@json2csv/plainjs'
import type { MatchVerdictFlat } from './types'

export function toCSV(locations: MatchVerdictFlat[]): string {
  if (locations.length === 0)
    return ''

  const keys = new Set()
  locations.forEach(item => Object.keys(item).forEach(key => keys.add(key)))

  const order: (keyof MatchVerdictFlat)[] = ['state', 'score', 'id', 'name', 'candidateName', 'address', 'candidateAddress', 'lat', 'candidateLat', 'lng', 'candidateLng', 'matchBy']
  const sortedFields = [...order, ...Array.from(keys).filter(key => !order.includes(key as keyof MatchVerdictFlat))] as (keyof MatchVerdictFlat)[]

  const parser = new Parser({ fields: sortedFields })
  return parser.parse(locations)
}
