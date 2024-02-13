import { MatchState } from './types'
import type { GoogleMapsCandidate, LocationCandidates, LocationSource } from './types'

const MAX_DISTANCE_KM = 50

/**
 * Returns a score between 0 (more than 50km away) and 1 (exactly the same point)
 */
function getGeolocationScore({ lat: sourceLat, lng: sourceLng }: LocationSource, { lat: candidateLat, lng: candidateLng }: GoogleMapsCandidate): number {
  // Calculate Euclidean distance in km between source and candidate
  // 111 is a rough approximation of the number of km per degree of latitude or longitude
  const distance = Math.sqrt((sourceLat - candidateLat) ** 2 + (sourceLng - candidateLng) ** 2) * 111

  // Return score: 1 for distance 0, decreasing to 0 as distance increases to MAX_DISTANCE_KM km or more
  return 1 - Math.min(distance / MAX_DISTANCE_KM, 1)
}

/**
 * Go though the candidates and computes the score for each one of them
 * Then, it will classify the candidates in two groups:
 *  - geoMatched: If there is only a candidate with a score greater than 0.9 and the second one is lower than 0.5
 *  - Unmatched: If the previous condition is not met
 */
export function classifyByGeolocation(locations: LocationCandidates[]) {
  for (const location of locations) {
    location.candidates.forEach(candidate => candidate.distanceScore = getGeolocationScore(location.source, candidate))

    const [firstCandidate, secondCandidate] = location.candidates.sort((a, b) => b.distanceScore - a.distanceScore)

    // Only update the state if the locations meet the criteria
    if (firstCandidate.distanceScore >= 0.9 && (secondCandidate === undefined || secondCandidate.distanceScore < 0.5)) {
      location.state = MatchState.GeoMatch
      location.candidates = [firstCandidate]
    }
  }
}
