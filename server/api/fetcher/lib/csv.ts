import { Parser } from '@json2csv/plainjs'
import type { GoogleMapsCandidate, LocationCandidates, LocationSource } from './types'

export function toCSV(locations: LocationCandidates[]) {
  if (locations.length === 0)
    return ''

  const firstLocation = locations.at(0)!

  const sourceKeys = (Object.keys(firstLocation.source) as (keyof LocationSource)[]).map(key => `source.${key}`)

  const locationWithCandidates = locations.find(({ candidates }) => candidates.length > 0)
  const candidateKeys = !locationWithCandidates
    ? []
    : (Object.keys(locationWithCandidates.candidates.at(0)!) as (keyof GoogleMapsCandidate)[]).map(key => `candidate.${key}`)

  const topLevelKeys = Object.keys(firstLocation).filter(key => !['source', 'candidate'].includes(key))
  const fields = [...topLevelKeys, ...sourceKeys, ...candidateKeys]

  // It will flatten the candidates array, so each location will have as many rows as candidates
  const flatLocations = locations.flatMap((location) => {
    const { source, candidates, state } = location
    return candidates.map(candidate => ({ ...location, source, candidate, state }))
  })

  const parser = new Parser({ fields })
  return parser.parse(flatLocations)
}
