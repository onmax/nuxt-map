import { env } from 'node:process'
import { createConsola } from 'consola'
import { type GoogleMapsCandidate, type LocationCandidates, type LocationSource, MatchState } from '../types'
import { parseGoogleTypes } from './google-maps-types'

export interface PlaceIdDetailsResponse {
  geometry: { location: { lat: number, lng: number } }
  name: string
  place_id: string
  formatted_address: string
  rating: number
  photos?: { photo_reference: string }[]
  types: string[]
}
export interface FindPlaceFromTextRes { candidates: PlaceIdDetailsResponse[] }

async function getCandidatesForLocation(location: LocationSource): Promise<GoogleMapsCandidate[]> {
  const { name, address, lat, lng } = location

  const url = new URL(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json`)
  url.searchParams.append('fields', 'name,formatted_address,geometry,place_id,rating,photos,types')
  url.searchParams.append('input', (address ? `${name}, ${address}` : name).trim())
  url.searchParams.append('inputtype', 'textquery')
  if (lat && lng) {
    const radius = address ? 1000 : 5000 // in meters
    url.searchParams.append('locationbias', `circle:${radius}@${lat},${lng}`)
  }

  url.searchParams.append('language', 'en')
  url.searchParams.append('key', env.GOOGLE_MAPS_API_KEY_BACKEND!)

  const rawCandidates = await fetch(url).then(d => d.json()).then(d => d.candidates as PlaceIdDetailsResponse[])

  const candidates: GoogleMapsCandidate[] = rawCandidates.map(_candidate => ({
    name: _candidate.name,
    address: _candidate.formatted_address,
    lat: _candidate.geometry.location.lat,
    lng: _candidate.geometry.location.lng,
    placeId: _candidate.place_id,
    photo: _candidate.photos?.[0]?.photo_reference,
    rating: _candidate.rating,
    types: _candidate.types,
    category: parseGoogleTypes(_candidate.types),
    gmapsTypes: _candidate.types,
    addressScore: -1,
    distanceScore: -1,
    nameScore: -1,
    addressDamerauLevensteinScore: -1,
    addressFuzzySearchScore: -1,
    nameDamerauLevensteinScore: -1,
    nameFuzzySearchScore: -1,
    stringScore: -1,
  }))

  return candidates
}

export async function getCandidates(locations: LocationSource[]): Promise<LocationCandidates[]> {
  const candidates: LocationCandidates[] = []
  const batchSize = 10

  const consola = createConsola()

  for (let i = 0; i < locations.length; i += batchSize) {
    consola.info(`Processing batch ${i / batchSize + 1}/${Math.ceil(locations.length / batchSize)}`)
    consola.prompt(`Processing ${i} of ${locations.length} locations`)
    const batch = locations.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(getCandidatesForLocation))
    const batchCandidates: LocationCandidates[] = batchResults.map((candidates, j) =>
      ({ source: batch[j], candidates, state: candidates.length ? MatchState.Unknown : MatchState.NoCandidates }),
    )
    candidates.push(...batchCandidates)
  }

  return candidates
}
