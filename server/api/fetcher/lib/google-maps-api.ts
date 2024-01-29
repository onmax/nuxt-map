import { parseGoogleTypes } from './google-maps-types'
import { type GoogleMapsCandidate, type LocationCandidates, type LocationSource, MatchState } from './types'

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

  const { googleMapsApiKeyBackend: key } = useRuntimeConfig()

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`

  const fields = 'name,formatted_address,geometry,place_id,rating,photos,types'
  const input = (address ? `${name}, ${address}` : name).trim()
  const inputtype = 'textquery'
  const locationbias = `circle:50@${lat},${lng}`
  const query = { inputtype, fields, key, input, locationbias }

  const rawCandidates = await $fetch<FindPlaceFromTextRes>(url, { query }).then(d => d.candidates)

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
    addressScore: -1,
    distanceScore: -1,
    nameScore: -1,
  }))

  return candidates
}

export async function getCandidates(locations: LocationSource[]): Promise<LocationCandidates[]> {
  const candidates: LocationCandidates[] = []
  const batchSize = 10

  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(getCandidatesForLocation))
    const batchCandidates: LocationCandidates[] = batchResults.map((candidates, j) =>
      ({ source: batch[j], candidates, state: candidates.length ? MatchState.Unknown : MatchState.NoCandidates }),
    )
    candidates.push(...batchCandidates)
  }

  return candidates
}
