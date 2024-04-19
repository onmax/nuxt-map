import { Parser } from '@json2csv/plainjs'
import { parse as parseCSV } from 'csv-string'

import type { GoogleMapsCandidate, LocationCandidates, LocationSource, MatchState } from '../types'
import type { Category, Currency } from '~/types/crypto-map'

export function locationsToCSV(locations: LocationSource[]) {
  if (locations.length === 0)
    return ''

  const firstLocation = locations.at(0)!
  const fields = Object.keys(firstLocation)

  const parser = new Parser({ fields })
  return parser.parse(locations)
}

export function candidatesToCSV(locations: LocationCandidates[]) {
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

interface CSVRow {
  'source.id': string | number
  'source.name': string
  'source.lat': number
  'source.lng': number
  'source.accepts': string
  'source.address'?: string
  'source.sells'?: string
  'source.category': Category
  'source.facebook'?: string
  'source.instagram'?: string
  'source.provider': string
  'candidate.name'?: string
  'candidate.category'?: string
  'candidate.lat'?: number
  'candidate.lng'?: number
  'candidate.address'?: string
  'candidate.placeId'?: string
  'candidate.rating'?: number
  'candidate.photo'?: string
  'candidate.gmapsTypes'?: string[]
  'candidate.distanceScore'?: number
  'candidate.stringScore'?: number
  'candidate.nameDamerauLevensteinScore'?: number
  'candidate.nameFuzzySearchScore'?: number
  'candidate.addressDamerauLevensteinScore'?: number
  'candidate.addressFuzzySearchScore'?: number
  'state': MatchState
}

export async function csvToLocationsJson(csv: string) {
  if (!csv)
    return
  const parsed = parseCSV(csv, { output: 'objects' }) as unknown as LocationSource[]
  const locations: LocationSource[] = []
  for await (const record of parsed) {
    const { id, name, accepts, category, coinmapCategory, lat, lng, address, facebook, instagram, sells, provider } = record
    const source: LocationSource = {
      id,
      name,
      accepts: accepts ? JSON.parse(accepts as unknown as string) as Currency[] : [],
      category: coinmapCategory as Category || category,
      lat,
      lng,
      address,
      facebook,
      instagram,
      sells: sells ? JSON.parse(sells as unknown as string) as Currency[] : [],
      provider,
    }
    locations.push(source)
  }
  return locations
}

export async function csvToCandidatesJson(csv: string) {
  if (!csv)
    return
  const locationCandidates: LocationCandidates[] = []

  const records = parseCSV(csv, { output: 'objects' }) as unknown as CSVRow[]

  for await (const record of records) {
    const maybeLocation = locationCandidates.find(c => c.source.id === record['source.id'])

    const candidate: GoogleMapsCandidate = {
      name: record['candidate.name'] || '',
      category: record['candidate.category'] as Category,
      lat: record['candidate.lat']!,
      lng: record['candidate.lng']!,
      address: record['candidate.address']!,
      placeId: record['candidate.placeId']!,
      rating: record['candidate.rating'],
      photo: record['candidate.photo'],
      gmapsTypes: record['candidate.gmapsTypes']!,
      distanceScore: record['candidate.distanceScore']!,
      stringScore: record['candidate.stringScore']!,
      nameDamerauLevensteinScore: record['candidate.nameDamerauLevensteinScore']!,
      nameFuzzySearchScore: record['candidate.nameFuzzySearchScore']!,
      addressDamerauLevensteinScore: record['candidate.addressDamerauLevensteinScore']!,
      addressFuzzySearchScore: record['candidate.addressFuzzySearchScore']!,
    }

    if (maybeLocation) {
      maybeLocation.candidates.push(candidate)
    }
    else {
      const state = record.state as MatchState
      const source: LocationSource = {
        id: record['source.id'],
        name: record['source.name'],
        accepts: record['source.accepts'] ? JSON.parse(record['source.accepts'] as string) as Currency[] : [],
        category: record['source.category'],
        lat: record['source.lat'],
        lng: record['source.lng'],
        address: record['source.address'],
        facebook: record['source.facebook'],
        instagram: record['source.instagram'],
        sells: record['source.sells'] ? JSON.parse(record['source.sells'] as string) as Currency[] : [],
        provider: record['source.provider'],
      }
      locationCandidates.push({ state, source, candidates: [candidate] })
    }
  }
  return locationCandidates
}
