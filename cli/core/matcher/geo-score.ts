import { MatchState } from '../types'
import type { GoogleMapsCandidate, LocationCandidates, LocationSource } from '../types'

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
 * Iterates through each location in the provided array and computes a distance score for each candidate within those locations.
 * It then classifies the location into two possible states based on the candidates' scores:
 * - GeoMatched: This state is assigned if there is exactly one candidate with a score greater than 0.9 and the second-highest score is below 0.5
 * If two candidates have scores over 0.9, the one with the most data (name, address, lat, lng, placeId, photo, rating, types, category,
 * gmapsTypes) is chosen, or the one with the highest score if data quantity is the same.
 * - Unmatched: This state is assigned if the conditions for GeoMatched are not met.
 */
export function classifyByGeolocation(locations: LocationCandidates[]) {
  for (const location of locations) {
    // Compute the distance score for each candidate
    for (const candidate of location.candidates)
      candidate.distanceScore = getGeolocationScore(location.source, candidate)

    // Sort candidates by their distance score in descending order
    location.candidates = location.candidates.sort((a, b) => b.distanceScore - a.distanceScore)

    // Check for top candidates with high scores
    const highScoreCandidates = location.candidates.filter(candidate => candidate.distanceScore > 0.9)

    if (highScoreCandidates.length > 1) {
      // Sort by the amount of data each candidate has if more than one candidate has a high score
      const mostDataCandidate = highScoreCandidates.sort((a, b) => {
        const dataCountA = countData(a)
        const dataCountB = countData(b)
        if (dataCountA === dataCountB)
          return b.distanceScore - a.distanceScore // If data count is the same, sort by score
        else
          return dataCountB - dataCountA // Otherwise, sort by data count
      })[0]

      location.state = MatchState.GeoMatch
      location.candidates = [mostDataCandidate, ...location.candidates.filter(c => c !== mostDataCandidate)]
    }
    else if (location.candidates[0].distanceScore >= 0.9 && (!location.candidates[1] || location.candidates[1].distanceScore < 0.5)) {
      // Only one candidate has a high score and it's significantly higher than the second
      location.state = MatchState.GeoMatch
    }
  }
}

/**
 * Calculates a weighted sum based on the presence of certain data fields for a candidate.
 */
export function countData(candidate: GoogleMapsCandidate): number {
  type Field = keyof GoogleMapsCandidate
  const fieldWeights: Partial<Record<Field, number>> = {
    address: 0.9,
    photo: 0.8,
    rating: 0.25,
    category: 0.5,
  }

  return Object.keys(fieldWeights).reduce((total, field) => total + (candidate[field as Field] ? (fieldWeights[field as Field] || 0) : 0), 0)
}
