import { uploadVerdict } from './lib/database'
import { scoreLocationsMatches } from './lib/matcher'
import type { BasicLocation } from './lib/types'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async (event) => {
  // e.g. ?provider=Bitcoin+20Jungle
  const { provider } = getQuery(event) as { provider: Provider }
  if (!Object.values(Provider).includes(provider as Provider))
    return new Response(`Invalid provider: ${provider}. Valid providers are: ${Object.values(Provider).join(', ')}`, { status: 400 })

  const locations = (await readBody<Body>(event)) as unknown as BasicLocation[]

  // Fetch the matches for each location searching by text or coordinates
  // Then, score the matches and classify them in Success, NoMatch, MultipleMatches or Inconclusive
  const matches = await scoreLocationsMatches(locations)

  // We convert the matches to a flat structure, and upload them as CSV
  // We have 2 CSVs: one for the matches and one for the locations that didn't match
  const { pathConflict, pathSuccess } = await uploadVerdict(matches, provider, event)

  const json = {
    pathConflict,
    pathSuccess,

    nConflictComment: '[Number of locations with conflicts, Number of conflicts (a conflictive location can have none or multiple conflicts)]',
    nConflict: [matches.reduce((acc, m) => acc + (m.id ? 1 : 0), 0), pathConflict.split('\n').length - 1],
    nSuccess: pathSuccess.split('\n').length - 1,
  }

  return new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json' } })
})
