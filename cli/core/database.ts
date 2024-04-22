import { env } from 'node:process'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import type { LocationCandidates } from './types'
import type { Database } from '~/types/supabase'
import type { Provider } from '~/types/crypto-map'

export async function saveToDatabase(client: SupabaseClient<Database>, allLocations: LocationCandidates[]) {
  const locations = []
  for (const { source, candidates } of allLocations) {
    try {
      locations.push({
        name: source.name,
        address: source.address,
        geo_location: `POINT(${source.lng} ${source.lat})`,
        category: candidates.at(0)?.category,
        accepts: source.accepts || [],
        sells: source.sells || [],
        gmaps_place_id: candidates.at(0)?.placeId,
        facebook: source.facebook,
        instagram: source.instagram,
        photo: candidates.at(0)?.photo,
        rating: candidates.at(0)?.rating || 0,
        // gmaps_types: `{${(candidates.at(0)?.gmapsTypes || []).join(',')}}`,
        gmaps_types: [],
        uuid: crypto.randomUUID(),
        enabled: false,
        provider: source.provider,
      })
    }
    catch (e) {
      console.log(source)
      console.error(e)
    }
  }

  // @ts-expect-error
  const error = await client.from('locations').upsert(locations, { onConflict: ['gmaps_place_id'], ignoreDuplicates: true })

  return error
}

export const sanitizeProviderName = (provider: Provider) => provider.replace(/\s/g, '-').toLowerCase()

export async function getAuthClient() {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_KEY
  const email = env.SUPABASE_ADMIN_USER
  const password = env.SUPABASE_ADMIN_PASSWORD

  if (!supabaseUrl || !supabaseKey || !email || !password)
    throw new Error('Missing Supabase credentials')

  const client = createClient<Database>(supabaseUrl, supabaseKey)
  await client.auth.signInWithPassword({ email, password })

  return client
}

// const querySchema = object({ filter: optional(picklist(['unmatched', 'matched'])) })
// const errorRes = { status: 500, headers: { 'content-type': MimeType.JSON } }

// export async function getLatestsFiles(event: H3Event<EventHandlerRequest>, provider: Provider) {
//   const { filter } = await getValidatedQuery(event, query => parseType(querySchema, query))

//   const client = await getAuthClient()
//   const { data: folders } = await client.storage.from(LOCATIONS_BUCKET).list(sanitizeProviderName(provider))
//   const folder = (folders || [])
//     .map(folder => ({ ...folder, created_at: strToDate(folder.name) }))
//     .sort((a, b) => b.created_at.getTime() - a.created_at.getTime()) // sort by date by descending
//     .at(0)
//   if (!folder)
//     return new Response(JSON.stringify({ error: `Files for ${provider} not found`, folder }), { status: 404 })

//   const paths = []
//   if (!filter || filter === 'matched')
//     paths.push(`${sanitizeProviderName(provider)}/${folder.name}/matched.csv`)
//   if (!filter || filter === 'unmatched')
//     paths.push(`${sanitizeProviderName(provider)}/${folder.name}/unmatched.csv`)

//   const files = await Promise.all(paths.map(async (path) => {
//     const { data, error } = await client.storage.from(LOCATIONS_BUCKET).download(path)
//     if (error)
//       return new Response(JSON.stringify({ message: `There was an error while fetching ${path}. Error: ${error}` }), errorRes)
//     return data
//   })).catch((error) => {
//     return new Response(JSON.stringify({ message: error.message }), errorRes)
//   })

//   const responses = files instanceof Response || files.find(f => f instanceof Response)
//   if (responses)
//     return responses

//   const [matched, unmatched] = await Promise.all(files.map(async file => csvToJson(await file.text())))
//   const statsUrl = `/api/fetcher/providers/${sanitizeProviderName(provider)}/stats`
//   return new Response(JSON.stringify({ statsUrl, matched, unmatched }), { status: 200, headers: { 'Content-Type': MimeType.JSON } })
// }

// export async function getStats(event: H3Event<EventHandlerRequest>, provider: Provider) {
//   const res = await getLatestsFiles(event, provider)
//   if (!(res instanceof Response))
//     return new Response(JSON.stringify({ message: `There was an error`, res }), errorRes)
//   if (res.status !== 200)
//     return res
//   const { matched, unmatched } = await res.json() as { matched: LocationCandidates[], unmatched: LocationCandidates[] }
//   const locationsCount = matched.length + unmatched.length
//   const p = (n1: number, n2: number) => `${((n1 / n2) * 100).toFixed(2)}%`

//   return {
//     locationsCount,
//     locationsMatched: matched.length,
//     locationsWithNoCandidates: unmatched.filter(({ state }) => state === MatchState.NoCandidates),
//     unknownLocations: unmatched.filter(c => c.state === MatchState.Unknown).length,
//     locationsMultipleCandidates: unmatched.filter(c => c.state === MatchState.MultipleCandidates).length,
//     locationsInconclusive: unmatched.filter(c => c.state === MatchState.Inconclusive).length,
//     percentage: p(matched.length, locationsCount),
//   }
// }
