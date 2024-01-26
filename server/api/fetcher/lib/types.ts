import type { Currency } from '~/types/crypto-map'

interface Coordinates {
  lat: number
  lng: number
}

export interface Score {
  nameScore: number
  nameScoreLevenshtein: number
  nameScoreJaroWinkler: number
  addressScore?: number
  addressScoreLevenshtein?: number
  addressScoreJaroWinkler?: number
  distanceScore: number
  score: number
}

export enum MatchState {
  Success = 'success', // The location undoubtedly matches the place ID
  NoMatch = 'no-match', // No matches found
  MultipleMatches = 'multiple-matches', // Multiple matches found
  Inconclusive = 'inconclusive', // The score is below the threshold
}

export enum MatchBy {
  Text = 'text',
  Location = 'location',
}
type Prettify<T> = { [K in keyof T]: T[K]; } & unknown

export type BasicLocation = Prettify<{
  name: string
  address?: string
  facebook?: string
  instagram?: string
  sells?: Currency[]
  accepts?: Currency[]
} & Coordinates & { id: string | number }>

export interface Candidate<T extends MatchBy> {
  candidateName: string
  candidatePlaceId: string
  candidateLat: number
  candidateLng: number
  candidateAddress?: T extends MatchBy.Text ? string : undefined
  candidateGMapsTypes?: T extends MatchBy.Text ? string[] : undefined
  candidateRating?: T extends MatchBy.Text ? number : undefined
  candidatePhoto?: T extends MatchBy.Text ? string : undefined
}
export interface Match<T extends MatchBy = MatchBy> {
  score: Score
  matchBy: T
  candidate: Candidate<T>
}

export type MatchVerdict = BasicLocation & { matches: Match[], state: MatchState }
export type MatchVerdictFlat = Score & Candidate<MatchBy> & BasicLocation & { state: MatchState, matchBy: MatchBy[] }
