import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventHandlerRequest, H3Event } from 'h3'
import { object, optional, parse as parseType, picklist } from 'valibot'
import { csvToJson, toCSV } from './csv'
import type { LocationCandidates } from './types'
import { MatchState, MimeType } from './types'
import { serverSupabaseClient } from '#supabase/server'
import type { Database, Json } from '~/types/supabase'
import type { Category, Currency, Provider } from '~/types/crypto-map'

const LOCATIONS_BUCKET = 'locations-sources'

// The format of the names cannot have special characters. We remove the colons from the date
// replace only the last two - with colons
export const dateToStr = (date: Date): string => date.toISOString().replace(/:/g, '-')
function strToDate(str: string): Date {
  const [y, mon, date, h, m, s, ms] = str.split(/\D+/).map(Number)
  return new Date(Date.UTC(y, mon - 1, date, h, m, s, ms))
}

interface UploadCSV {
  filepath: string
  content: string
}
async function uploadCSV(client: SupabaseClient<Database>, { filepath, content }: UploadCSV) {
  const csvBlob = new Blob([content], { type: 'text/csv' })
  const fileOptions = { cacheControl: '3600', upsert: false }
  const { data: dataUpload } = await client.storage.from(LOCATIONS_BUCKET).upload(filepath, csvBlob, fileOptions)
  console.log(`📤 Uploaded ${filepath} to Supabase`) // eslint-disable-line no-console
  if (dataUpload)
    return client.storage.from(LOCATIONS_BUCKET).getPublicUrl(dataUpload.path, { download: true }).data.publicUrl
}

interface LocationsData { matched: LocationCandidates[], unmatched: LocationCandidates[] }
interface LocationsOptions { provider: string, ts: string }

async function uploadLocations(client: SupabaseClient<Database>, { matched, unmatched }: LocationsData, { provider, ts }: LocationsOptions) {
  const uploadMatched = uploadCSV(client, { filepath: `${provider}/${ts}/matched.csv`, content: toCSV(matched) })
  const uploadUnmatched = uploadCSV(client, { filepath: `${provider}/${ts}/unmatched.csv`, content: toCSV(unmatched) })
  const upload = await Promise.allSettled([uploadMatched, uploadUnmatched])
  if (upload.some(({ status }) => status === 'rejected'))
    throw new Error('Error uploading files to Supabase')
  const [matchedUrl, unmatchedUrl] = upload as PromiseFulfilledResult<string>[]

  return { matchedUrl: matchedUrl.value, unmatchedUrl: unmatchedUrl.value }
}

export async function storageCleanup(client: SupabaseClient<Database>, { provider, ts }: LocationsOptions) {
  const { data: folders } = await client.storage.from(LOCATIONS_BUCKET).list(provider)

  const foldersToDelete = (folders || [])
    .map(folder => ({ ...folder, created_at: strToDate(folder.name) }))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime()) // sort by date descending
    .filter((folder, index) => {
      const hoursDiff = Math.abs(Date.now() - new Date(folder.created_at).getTime()) / (1000 * 60 * 60)
      return index >= 10 || (hoursDiff < 12 && folder.name !== ts)
    })
    .map(({ name }) => `${provider}/${name}`)

  if (foldersToDelete.length === 0)
    return

  const filesToDelete = []
  for (const folder of foldersToDelete) {
    const { data } = await client.storage.from(LOCATIONS_BUCKET).list(folder)
    if (data)
      filesToDelete.push(...data.map(file => `${folder}/${file.name}`))
  }
  console.log(`🧹 Deleting ${filesToDelete} files`) // eslint-disable-line no-console
  await client.storage.from(LOCATIONS_BUCKET).remove(filesToDelete)
}

interface LocationDb {
  name: string
  address: string
  gmaps: string
  category: Category
  gmaps_types: string[]
  enabled: boolean
  lat: number
  lng: number
  accepts: Currency[]
  sells: Currency[]
  facebook?: string
  instagram?: string
  photo?: string
  rating?: number
  provider: Provider
}

async function saveToDatabase(client: SupabaseClient<Database>, allLocations: LocationCandidates[], provider: Provider) {
  const locations: Json[] = allLocations.map(({ source, candidates }) => ({
    sells: source.sells || [],
    gmaps_types: candidates.at(0)?.gmapsTypes || [],
    ...candidates.at(0),
    ...source,
    address: candidates.at(0)?.address || source.address || '',
    gmaps: candidates.at(0)?.placeId || '',
    enabled: false,
    provider,
  } satisfies LocationDb))

  const { error: errorInsert } = await client.rpc('upsert_locations_with_gmaps_api', { locations })
  return errorInsert
}

export const sanitizeProviderName = (provider: Provider) => provider.replace(/\s/g, '-').toLowerCase()

export async function uploadResults(client: SupabaseClient<Database>, { matched, unmatched, provider }: LocationsData & { provider: Provider }) {
  const options: LocationsOptions = { ts: dateToStr(new Date()), provider: sanitizeProviderName(provider) }

  const urls = await uploadLocations(client, { matched, unmatched }, options)
  if (urls.matchedUrl && urls.unmatchedUrl)
    await storageCleanup(client, options)

  await saveToDatabase(client, matched, provider)

  return urls
}

export async function getAuthClient(event: H3Event<EventHandlerRequest>) {
  const client = await serverSupabaseClient<Database>(event)
  const { supabaseAdminPassword: password, supabaseAdminUser: email } = useRuntimeConfig()
  await client.auth.signInWithPassword({ email, password })
  return client
}

const querySchema = object({ filter: optional(picklist(['unmatched', 'matched'])) })
const errorRes = { status: 500, headers: { 'content-type': MimeType.JSON } }

export async function getLatestsFiles(event: H3Event<EventHandlerRequest>, provider: Provider) {
  const { filter } = await getValidatedQuery(event, query => parseType(querySchema, query))

  const client = await getAuthClient(event)
  const { data: folders } = await client.storage.from(LOCATIONS_BUCKET).list(sanitizeProviderName(provider))
  const folder = (folders || [])
    .map(folder => ({ ...folder, created_at: strToDate(folder.name) }))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime()) // sort by date by descending
    .at(0)
  if (!folder)
    return new Response(JSON.stringify({ error: `Files for ${provider} not found`, folder }), { status: 404 })

  const paths = []
  if (!filter || filter === 'matched')
    paths.push(`${sanitizeProviderName(provider)}/${folder.name}/matched.csv`)
  if (!filter || filter === 'unmatched')
    paths.push(`${sanitizeProviderName(provider)}/${folder.name}/unmatched.csv`)

  const files = await Promise.all(paths.map(async (path) => {
    const { data, error } = await client.storage.from(LOCATIONS_BUCKET).download(path)
    if (error)
      return new Response(JSON.stringify({ message: `There was an error while fetching ${path}. Error: ${error}` }), errorRes)
    return data
  })).catch((error) => {
    return new Response(JSON.stringify({ message: error.message }), errorRes)
  })

  const responses = files instanceof Response || files.find(f => f instanceof Response)
  if (responses)
    return responses

  const [matched, unmatched] = await Promise.all(files.map(async file => csvToJson(await file.text())))
  const statsUrl = `/api/fetcher/providers/${sanitizeProviderName(provider)}/stats`
  return new Response(JSON.stringify({ statsUrl, matched, unmatched }), { status: 200, headers: { 'Content-Type': MimeType.JSON } })
}

export async function getStats(event: H3Event<EventHandlerRequest>, provider: Provider) {
  const res = await getLatestsFiles(event, provider)
  if (!(res instanceof Response))
    return new Response(JSON.stringify({ message: `There was an error`, res }), errorRes)
  if (res.status !== 200)
    return res
  const { matched, unmatched } = await res.json() as { matched: LocationCandidates[], unmatched: LocationCandidates[] }
  const locationsCount = matched.length + unmatched.length
  const p = (n1: number, n2: number) => `${((n1 / n2) * 100).toFixed(2)}%`

  return {
    locationsCount,
    locationsMatched: matched.length,
    locationsWithNoCandidates: unmatched.filter(({ state }) => state === MatchState.NoCandidates),
    unknownLocations: unmatched.filter(c => c.state === MatchState.Unknown).length,
    locationsMultipleCandidates: unmatched.filter(c => c.state === MatchState.MultipleCandidates).length,
    locationsInconclusive: unmatched.filter(c => c.state === MatchState.Inconclusive).length,
    percentage: p(matched.length, locationsCount),
  }
}
