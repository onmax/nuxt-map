import levenshtein from 'damerau-levenshtein'
import type { IFuseOptions } from 'fuse.js'
import Fuse from 'fuse.js'
import { MatchState } from '../types'
import type { GoogleMapsCandidate, LocationCandidates, LocationSource } from '../types'
import { countData } from './geo-score'

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

    // Sort candidates by their string score in descending order
    location.candidates = location.candidates.sort((a, b) => b.stringScore - a.stringScore)

    // Check for top candidates with high scores
    const highScoreCandidates = location.candidates.filter(candidate => candidate.stringScore > 0.9)

    if (highScoreCandidates.length > 1) {
      // Sort by the amount of data each candidate has if more than one candidate has a high score
      const mostDataCandidate = highScoreCandidates.sort((a, b) => {
        const dataCountA = countData(a)
        const dataCountB = countData(b)
        if (dataCountA === dataCountB)
          return b.stringScore - a.stringScore // If data count is the same, sort by score
        else
          return dataCountB - dataCountA // Otherwise, sort by data count
      })[0]

      location.state = MatchState.GeoMatch
      location.candidates = [mostDataCandidate, ...location.candidates.filter(c => c !== mostDataCandidate)]
    }
    else if (location.candidates[0].stringScore >= 0.9 && (!location.candidates[1] || location.candidates[1].stringScore < 0.5)) {
      // Only one candidate has a high score and it's significantly higher than the second
      location.state = MatchState.GeoMatch
    }
  }
}
