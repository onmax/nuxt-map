import stringComparison from 'string-comparison'
import { MatchState } from './types'
import type { Match } from './types'

export function getStringScore(a: string, b: string) {
  const levenshtein = levenshteinDistance(a, b)
  const jarowinkler = jarowinklerDistance(a, b)
  const score = 0.7 * levenshtein + 0.3 * jarowinkler
  return { levenshtein, jarowinkler, score }
}

// 1 means is close. 0 means is that is 50km or more away
export function geolocationScore({ lat, lng }: { lat: number, lng: number }, { lat: candidateLat, lng: candidateLng }: { lat: number, lng: number }): number {
  const distance = Math.sqrt((lat - candidateLat) ** 2 + (lng - candidateLng) ** 2) * 111
  return 1 - Math.min(distance / 50, 1)
}

// Levenshtein Distance: Measures the minimum number of single-character edits (insertions, deletions, or substitutions) required to change one string into the other.
// Pros: Simple and effective for comparing two strings. Good for spell checking and fuzzy matching.
// Cons: Computationally expensive for long strings. Doesn't work well when the strings have different lengths.
export function levenshteinDistance(a: string, b: string): number {
  const score = stringComparison.levenshtein.distance(a, b)
  // normalize score to be between 0 and 1
  return 1 - (score / Math.max(a.length, b.length))
}

// Jaro-Winkler Distance: Measures the similarity between two strings. The Jaro measure is the number of matching characters divided by the total number of characters in the two strings. The Winkler adjustment boosts the score when the beginning of the strings match.
// Pros: Good for short strings such as person names. The Winkler adjustment is especially useful when the strings might have small typos or abbreviations.
// Cons: Less effective for longer strings or strings where the order of characters is not important.
export function jarowinklerDistance(a: string, b: string): number {
  return stringComparison.jaroWinkler.distance(a, b)
}

const TH = 0.8
export function classifyMatches(matches: Match[]): { state: MatchState, matches: Match[] } {
  if (matches.length === 0)
    return { state: MatchState.NoMatch, matches: [] }

  // Sort matches in descending order of average
  matches.sort((a, b) => b.score.score - a.score.score)

  const { score: highestScore } = matches[0].score

  // Check the success case:
  //  1. We have only one and its average is greater than TH
  //  2. Or we have multiple matches and the first one has an average greater than TH and a minimum distance of 0.2 to the second one
  if ((matches.length === 1 && highestScore >= TH) || (highestScore >= TH && (highestScore - matches[1].score.score) >= 0.2))
    return { state: MatchState.Success, matches: [matches[0]] }

  // At this point we have multiple matches, so we need to define a state
  // - multiple state: when there is at least one match with an average greater than TH
  // - inconclusive state: in other case
  const state = matches.some(({ score: { score } }) => score >= TH) ? MatchState.MultipleMatches : MatchState.Inconclusive
  return { state, matches }
}
