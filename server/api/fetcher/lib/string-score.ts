import levenshtein from 'damerau-levenshtein'
import type { IFuseOptions } from 'fuse.js'
import Fuse from 'fuse.js'
import { MatchState } from './types'
import type { GoogleMapsCandidate, LocationCandidates, LocationSource } from './types'

// Gets the Damerau-Levenshtein score between two strings. 1 is the maximum score, 0 is the minimum
export function getDamerauLevScore(a: string, b: string): number {
  return 1 - levenshtein(a, b).similarity
}

const options: IFuseOptions<GoogleMapsCandidate> = {
  isCaseSensitive: false,
  findAllMatches: true,
  includeMatches: false,
  includeScore: true,
  shouldSort: true,
}
export function setFuzzySearchScore({ name, address }: LocationSource, candidates: GoogleMapsCandidate[]) {
  const fuseName = new Fuse(candidates, { ...options, keys: ['name'] })
  const nameResults = fuseName.search(name)
  for (const res of nameResults)
    res.item.nameFuzzySearchScore = res.score || 0

  if (address) {
    const fuseAddress = new Fuse(candidates, { ...options, keys: ['address'] })
    const addressResults = fuseAddress.search(address)
    for (const res of addressResults)
      res.item.addressFuzzySearchScore = res.score || 0
  }
}

/**
 * Go though the candidates and computes the score for each one of them
 * Then, it will classify the candidates in two groups:
 *  - stringMatch: If there is only a candidate with a score greater than 0.9 and the second one is lower than 0.5
 *  - Unmatched: If the previous condition is not met
 */
export function classifyByStringScore(locations: LocationCandidates[]) {
  for (const location of locations) {
    setFuzzySearchScore(location.source, location.candidates)

    for (const candidate of location.candidates) {
      candidate.nameDamerauLevensteinScore = getDamerauLevScore(location.source.name, candidate.name)
      if (location.source.address)
        candidate.addressDamerauLevensteinScore = getDamerauLevScore(location.source.address, candidate.address)

      // combine all the scores with the same weights
      const nameScore = (candidate.nameDamerauLevensteinScore + candidate.nameFuzzySearchScore) / 2
      const addressScore = (candidate.addressDamerauLevensteinScore + candidate.addressDamerauLevensteinScore) / 2
      candidate.stringScore = location.source.address ? (nameScore + addressScore) / 2 : nameScore
    }

    const [firstCandidateName, secondCandidateName] = location.candidates.sort((a, b) => b.stringScore - a.stringScore)

    if (firstCandidateName.distanceScore >= 0.9 && (secondCandidateName === undefined || secondCandidateName.distanceScore < 0.5)) {
      location.state = MatchState.StringMatch
      location.candidates = [firstCandidateName]
    }
  }
}
