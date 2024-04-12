import type { Category, Currency } from '~/types/crypto-map'

interface ExtraLocationSource { [x: string]: unknown }

export interface LocationSource extends ExtraLocationSource {
  id: string | number
  name: string
  lat: number
  lng: number
  accepts: Currency[]
  address?: string
  sells?: Currency[]
  category?: Category
  facebook?: string
  instagram?: string
}

export interface GoogleMapsCandidate {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  photo?: string
  gmapsTypes: string[]
  category: Category
  distanceScore: number

  stringScore: number

  nameDamerauLevensteinScore: number
  nameFuzzySearchScore: number

  addressDamerauLevensteinScore: number
  addressFuzzySearchScore: number
}

export interface LocationCandidates {
  source: LocationSource
  candidates: GoogleMapsCandidate[]
  state: MatchState
}

export interface GeoScore { distanceScore: number }
export interface StringScore { nameScore: number, addressScore: number }

export type GeoScoreCandidate = GoogleMapsCandidate & GeoScore & Partial<StringScore>

export interface LocationUnscoredCandidates { source: LocationSource, candidates: GoogleMapsCandidate[] }
export interface UnmatchedGeoCandidate { source: LocationSource, candidates: GeoScoreCandidate[] }

type Prettify< T > = { [K in keyof T]: T[K]; } & unknown

export enum MatchState {
  Unknown = 'unknown',
  GeoMatch = 'geo-match',
  StringMatch = 'string-match',
  NoCandidates = 'no-candidates',
  MultipleCandidates = 'multiple-matches',
  Inconclusive = 'inconclusive',
}

export type LocationMatch = Prettify<{ source: LocationSource } & (
  | (
    & {
      state: MatchState.GeoMatch
      match: GeoScoreCandidate
    }
  )
  | (
    & { state: MatchState.StringMatch | MatchState.MultipleCandidates | MatchState.Inconclusive }
    & Pick<GoogleMapsCandidate, 'placeId' | 'photo' | 'rating' | 'gmapsTypes'>
    & GeoScore & StringScore
  )
  | (
    & { state: MatchState.NoCandidates }
    // We make these fields undefined to avoid having to check for their existence
    & Partial<Pick<GoogleMapsCandidate, 'placeId' | 'photo' | 'rating' | 'gmapsTypes'>>
    & Partial<GeoScore> & Partial<StringScore>
  )
)>

export enum MimeType {
  JSON = 'application/json',
  CSV = 'text/csv',
}

export interface FetcherResult {
  matchedUrl: string
  unmatchedUrl: string
  matched: LocationCandidates[]
  unmatched: LocationCandidates[]
  distribution: object
}
