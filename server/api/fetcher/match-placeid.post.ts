/* eslint-disable no-console */

import { uploadResults } from './lib/database'
import { classifyByGeolocation } from './lib/geo-score'
import { getCandidates } from './lib/google-maps-api'
import { type LocationSource, MatchState } from './lib/types'
import { partition } from './lib/util'
import { serverSupabaseClient } from '#supabase/server'
import { Provider } from '~/types/crypto-map'
import type { Database } from '~/types/supabase'

const p = (n1: number, n2: number) => `${((n1 / n2) * 100).toFixed(2)}%`

export default defineEventHandler(async (event) => {
  // e.g. ?provider=Bitcoin+20%Jungle
  const { provider } = getQuery(event) as { provider: Provider }
  if (!Object.values(Provider).includes(provider as Provider))
    return new Response(`Invalid provider: ${provider}. Valid providers are: ${Object.values(Provider).join(', ')}`, { status: 400 })

  const locations = (await readBody<Body>(event)) as unknown as LocationSource[]

  const count = locations.length

  console.log(`🏭 Received ${count} locations for ${provider}`)

  const l = locations.at(0)!
  const candidates = await getCandidates([l!])
  const [withCandidates, noCandidates] = partition(candidates, c => c.state !== MatchState.NoCandidates)
  classifyByGeolocation(withCandidates)

  console.log(`🏭 ${withCandidates.length} locations with candidates(${p(withCandidates.length, count)}%) and ${noCandidates.length} without candidates`)

  const [geoMatched, geoUnmatched] = partition(withCandidates, c => c.state === MatchState.GeoMatch)

  console.log(`🏭 [GEO SCORE] We found a match for ${geoMatched.length} locations(${p(geoMatched.length, count)}%) and ${geoUnmatched.length} without match`)

  console.log(`🏭 Uploading results to Supabase`)

  const client = await serverSupabaseClient<Database>(event)
  const unmatched = noCandidates.concat(geoUnmatched)
  const matched = geoMatched
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

  return new Response(JSON.stringify({ ...csvUrls, stats }), { headers: { 'content-type': 'application/json' } })
})
