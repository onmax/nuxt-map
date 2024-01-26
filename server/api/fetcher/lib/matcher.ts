import type { BasicLocation, Candidate, Match, MatchVerdict, MatchVerdictFlat, Score } from './types'
import { MatchBy, MatchState } from './types'
import { classifyMatches, geolocationScore, getStringScore } from './score'
import { Category } from '~/types/crypto-map'

const headers = { 'Accept-Language': 'en-US,en;q=0.5' }

export interface NearbySearchesResponse {
  results: {
    geometry: { location: { lat: number, lng: number } }
    name: string
    place_id: string
  }[]
}

export interface PlaceIdDetailsResponse {
  geometry: { location: { lat: number, lng: number } }
  name: string
  place_id: string
  formatted_address: string
  rating: number
  photos: { photo_reference: string }[]
  types: string[]
}

export interface QuerySearchResponse { candidates: PlaceIdDetailsResponse[] }
export interface PlaceIdSearchResponse { result: PlaceIdDetailsResponse }

export async function matchFromTextSearch(location: Required<BasicLocation>): Promise<MatchVerdict> {
  const { name, address, lat, lng } = location
  const textSearch = `${name} ${address}`

  const { googleMapsApiKeyBackend } = useRuntimeConfig()

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`
  const fields = 'name,formatted_address,geometry,place_id,rating,photos,types'
  const query = { inputtype: 'textquery', fields, key: googleMapsApiKeyBackend, input: textSearch }
  const candidates = await $fetch<QuerySearchResponse>(url, { query, headers }).then(d => d.candidates)

  const matchesUnclassified: Match<MatchBy.Text>[] = candidates.map((_candidate) => {
    const candidate: Candidate<MatchBy.Text> = {
      candidateLat: _candidate.geometry.location.lat,
      candidateLng: _candidate.geometry.location.lng,
      candidateName: _candidate.name,
      candidateAddress: _candidate.formatted_address,
      candidatePlaceId: _candidate.place_id,
      candidateRating: _candidate.rating,
      candidatePhoto: _candidate.photos[0]?.photo_reference,
      candidateGMapsTypes: _candidate.types,
    }

    const { jarowinkler: nameScoreJaroWinkler, levenshtein: nameScoreLevenshtein, score: nameScore } = getStringScore(name, candidate.candidateName)
    const { jarowinkler: addressScoreJaroWinkler, levenshtein: addressScoreLevenshtein, score: addressScore } = getStringScore(address, candidate.candidateAddress!)

    // We use the distance between the coordinates to get a score between 0 and 1
    const distanceScore = Math.sqrt((lat - candidate.candidateLat) ** 2 + (lng - candidate.candidateLng) ** 2)
    const scoreParams: Omit<Score, 'score'> = { nameScore, nameScoreJaroWinkler, nameScoreLevenshtein, addressScore, addressScoreJaroWinkler, addressScoreLevenshtein, distanceScore }
    const score: Score = { ...scoreParams, score: (nameScore + addressScore + distanceScore) / 3 }

    const match: Match<MatchBy.Text> = { score, candidate, matchBy: MatchBy.Text } satisfies Match<MatchBy.Text>
    return match
  })

  const { matches, state } = classifyMatches(matchesUnclassified)
  return { ...location, matches, state }
}

export async function matchFromCoordinatesSearch(location: BasicLocation): Promise<MatchVerdict> {
  const { name, lat, lng } = location

  const { googleMapsApiKeyBackend } = useRuntimeConfig()
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
  const fields = 'name,formatted_address,geometry,place_id'
  const query = { location: `${lat},${lng}`, radius: 1000 /* 1km */, key: googleMapsApiKeyBackend, fields }

  const candidates = await $fetch<NearbySearchesResponse>(url, { query, headers }).then(d => d.results)

  const matchesUnclassified: Match<MatchBy.Location>[] = candidates.map((_candidate) => {
    const candidate: Candidate<MatchBy.Location> = {
      candidateLat: _candidate.geometry.location.lat,
      candidateLng: _candidate.geometry.location.lng,
      candidateName: _candidate.name,
      candidatePlaceId: _candidate.place_id,
      candidateAddress: undefined,
      candidateGMapsTypes: undefined,
      candidatePhoto: undefined,
      candidateRating: undefined,
    }

    const { jarowinkler: nameScoreJaroWinkler, levenshtein: nameScoreLevenshtein, score: nameScore } = getStringScore(name, candidate.candidateName)

    const distanceScore = geolocationScore({ lat, lng }, { lat: candidate.candidateLat, lng: candidate.candidateLng })
    const scoreParams: Omit<Score, 'score'> = { nameScore, nameScoreJaroWinkler, nameScoreLevenshtein, distanceScore }
    const score: Score = { ...scoreParams, score: (nameScore + distanceScore) / 2 }

    const match: Match<MatchBy.Location> = { score, candidate, matchBy: MatchBy.Location } satisfies Match<MatchBy.Location>
    return match
  }).sort((a, b) => (b.score.score) - (a.score.score))

  const { matches, state } = classifyMatches(matchesUnclassified)
  return { ...location, matches, state }
}

export function parseGoogleTypes(googleTypes: string[]): Category {
  const mapping: Record<Category, string[]> = {
    [Category.Cash]: ['atm', 'bank', 'currency_exchange', 'finance', 'insurance_agency', 'lawyer', 'money_transfer', 'travel_agency'],
    [Category.CarsBikes]: ['car_dealer', 'car_rental', 'car_repair', 'car_wash', 'gas_station', 'parking', 'taxi_stand', 'train_station', 'transit_station'],
    [Category.ComputerElectronics]: ['hardware_store', 'locksmith', 'moving_company', 'painter', 'plumber', 'roofing_contractor'],
    [Category.Entertainment]: ['amusement_park', 'aquarium', 'art_gallery', 'bowling_alley', 'casino', 'movie_theater', 'night_club', 'stadium', 'zoo'],
    [Category.LeisureActivities]: ['beauty_salon', 'bicycle_store', 'campground', 'laundry', 'library', 'movie_rental', 'museum'],
    [Category.FoodDrinks]: ['bakery', 'cafe', 'food'],
    [Category.RestaurantBar]: ['bar', 'meal_delivery', 'meal_takeaway', 'restaurant'],
    [Category.HealthBeauty]: ['dentist', 'doctor', 'drugstore', 'hair_care', 'hospital', 'pharmacy', 'physiotherapist', 'spa', 'veterinary_care'],
    [Category.SportsFitness]: ['gym', 'park'],
    [Category.HotelLodging]: ['lodging', 'rv_park'],
    [Category.Shop]: ['book_store', 'clothing_store', 'convenience_store', 'department_store', 'electronics_store', 'florist', 'furniture_store', 'home_goods_store', 'jewelry_store', 'liquor_store', 'pet_store', 'shoe_store', 'shopping_mall', 'store', 'supermarket'],
    [Category.Miscellaneous]: ['accounting', 'airport', 'bus_station', 'cemetery', 'church', 'city_hall', 'courthouse', 'electrician', 'embassy', 'fire_station', 'funeral_home', 'hindu_temple', 'light_rail_station', 'local_government_office', 'mosque', 'police', 'post_office', 'primary_school', 'real_estate_agency', 'school', 'secondary_school', 'storage', 'subway_station', 'synagogue', 'tourist_attraction', 'university'],
  }

  for (const googleType of googleTypes) {
    for (const myType in mapping) {
      if (mapping[myType as Category].includes(googleType) && myType !== Category.Miscellaneous)
        return myType as Category
    }
  }

  return Category.Miscellaneous
}

export async function fillMissingFields(allLocations: MatchVerdict[]): Promise<MatchVerdictFlat[]> {
  const locations = allLocations
    .filter(({ state }) => state === MatchState.Success)
    .map(({ matches, ...location }) => ({ ...location, ...matches[0].candidate, ...matches[0].score, matchBy: [matches[0].matchBy] } as MatchVerdictFlat))
    .filter(({ matchBy }) => matchBy.includes(MatchBy.Location)) // The ones that were matched by location, we need to retrieve the missing data

    type MissingFields = Pick<MatchVerdictFlat, 'candidateAddress' | 'candidateRating' | 'candidateGMapsTypes' | 'candidatePhoto'>
    async function getMissingInfo(placeId: string): Promise<MissingFields> {
      const { googleMapsApiKeyBackend } = useRuntimeConfig()
      const url = `https://maps.googleapis.com/maps/api/place/details/json`
      const fields = 'formatted_address,rating,photos,types'
      const query = { place_id: placeId, key: googleMapsApiKeyBackend, fields }
      const { result: { formatted_address, photos, rating, types } } = await $fetch<PlaceIdSearchResponse>(url, { query, headers })
      return { candidateAddress: formatted_address, candidateRating: rating, candidateGMapsTypes: types, candidatePhoto: photos?.[0]?.photo_reference }
    }

    const batches: MatchVerdictFlat[][] = []
    for (let i = 0; i < locations.length; i += 10)
      batches.push(locations.slice(i, i + 10))

    const results: MatchVerdictFlat[] = []
    for (const batch of batches) {
      const fullLocation = await Promise.all(batch.map(item => ({ ...item, ...getMissingInfo(item.candidatePlaceId) } as MatchVerdictFlat)))
      fullLocation.forEach(item => results.push(item))
    }

    return results
}

/**
 * Given a list of locations, it will return a list of matches for each location:
 * e.g. Location 1: [(Match 1, Score 1), (Match 2, Score 2), ...]
 *  - The match will contain the location itself, match criteria (in the `matchBy` field) and the score
 *  - The score is a number between 0 and 1, where 1 means a perfect match and 0 means no match
 *
 */
export async function scoreLocationsMatches(locations: BasicLocation[]): Promise<MatchVerdict[]> {
  const candidate = (location: BasicLocation) => location.address
    ? matchFromTextSearch(location as Required<BasicLocation>)
    : matchFromCoordinatesSearch(location)

  // Divide locations in batches of 10 like [[loc1, loc2...loc10],[loc11, loc12...loc20]...
  const batches = []
  for (let i = 0; i < locations.length; i += 10)
    batches.push(locations.slice(i, i + 10))

  // Process batches in parallel. One batch after the other
  const matches = (await Promise.all(batches.map(async batch => await Promise.all(batch.map(candidate))))).flat()

  return matches
}
