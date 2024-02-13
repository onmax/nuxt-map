import { createConsola } from 'consola'
import { getAuthClient, sanitizeProviderName, uploadResults } from './lib/database'
import { classifyByGeolocation } from './lib/geo-score'
import { getCandidates } from './lib/google-maps-api'
import { type LocationSource, MatchState } from './lib/types'
import { partition } from './lib/util'
import { classifyByStringScore } from './lib/string-score'
import { Provider } from '~/types/crypto-map'

const p = (n1: number, n2: number) => `${((n1 / n2) * 100).toFixed(2)}%`

export default defineEventHandler(async (event) => {
  const consola = createConsola()

  // e.g. ?provider=Bitcoin+20%Jungle
  const { provider } = getQuery(event) as { provider: Provider }
  if (!Object.values(Provider).includes(provider as Provider))
    return new Response(`Invalid provider: ${provider}. Valid providers are: ${Object.values(Provider).join(', ')}`, { status: 400 })

  const locations = (await readBody<Body>(event)) as unknown as LocationSource[]

  const count = locations.length

  consola.info(`🏭 Received ${count} locations for ${provider}`)

  const candidates = await getCandidates(locations)

  // First, split the results between the locations with candidates and locations without candidates
  const [withCandidates, noCandidates] = partition(candidates, c => c.state !== MatchState.NoCandidates)
  consola.info(`🏭 ${withCandidates.length} locations with candidates(${p(withCandidates.length, count)}%) and ${noCandidates.length} without candidates`)

  classifyByGeolocation(withCandidates)
  const [geoMatched, geoUnmatched] = partition(withCandidates, c => c.state === MatchState.GeoMatch)
  consola.info(`🏭 [GEO SCORE] We found a geo match for ${geoMatched.length} locations(${p(geoMatched.length, count)}%) and still ${geoUnmatched.length} without match`)

  classifyByStringScore(geoUnmatched)
  const [stringMatched, stringUnmatched] = partition(geoUnmatched, c => c.state === MatchState.StringMatch)
  consola.info(`🏭 [STRING SCORE] We found a string match for ${stringMatched.length} locations(${p(stringMatched.length, count)}%) and still ${stringUnmatched.length} without match`)

  consola.info(`🏭 Uploading results to Supabase`)

  const client = await getAuthClient(event)
  const unmatched = noCandidates.concat(geoUnmatched).concat(stringUnmatched)
  const matched = geoMatched.concat(stringMatched)
  const csvUrls = await uploadResults(client, { provider, matched, unmatched })

  const stats = {
    locationsCount: count,
    locationsWithNoCandidates: noCandidates.length,
    locationsMatched: matched.length,
    unknownLocations: unmatched.filter(c => c.state === MatchState.Unknown).length,
    locationsMultipleCandidates: unmatched.filter(c => c.state === MatchState.MultipleCandidates).length,
    locationsInconclusive: unmatched.filter(c => c.state === MatchState.Inconclusive).length,
    percentage: p(matched.length, count),
  }

  const latests = `/api/fetcher/provider/${sanitizeProviderName(provider)}/latests`
  return new Response(JSON.stringify({ ...csvUrls, stats, latests }), { headers: { 'content-type': 'application/json' } })
})
