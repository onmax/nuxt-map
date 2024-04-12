import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocationCandidates } from '../types'
import { csvToJson, toCSV } from './csv'
import type { Database } from '~/types/supabase'

const LOCATIONS_BUCKET = 'locations-sources'

interface UploadCSV {
  filepath: string
  content: string
}
async function uploadCSV(client: SupabaseClient<Database>, { filepath, content }: UploadCSV) {
  const csvBlob = new Blob([content], { type: 'text/csv' })
  const fileOptions = { cacheControl: '3600', upsert: false }
  const { data: dataUpload, error } = await client.storage.from(LOCATIONS_BUCKET).upload(filepath, csvBlob, fileOptions)
  if (!dataUpload)
    throw new Error(`Error uploading ${filepath} to Supabase. Error: ${JSON.stringify(error)}`)
  return client.storage.from(LOCATIONS_BUCKET).getPublicUrl(dataUpload.path, { download: true }).data.publicUrl
}

async function downloadCSV(client: SupabaseClient<Database>, filepath: string) {
  const { data, error } = await client.storage.from(LOCATIONS_BUCKET).download(filepath)
  if (!data)
    throw new Error(`Error downloading ${filepath} from Supabase. Error: ${JSON.stringify(error)}`)
  const str = await data.text()
  return str
}

interface LocationsData {
  path: string
  matched: LocationCandidates[]
  unmatched: LocationCandidates[]
}

export async function uploadLocations(client: SupabaseClient<Database>, { matched, unmatched, path }: LocationsData) {
  const uploadMatched = uploadCSV(client, { filepath: `${path}/matched.csv`, content: toCSV(matched) })
  const uploadUnmatched = uploadCSV(client, { filepath: `${path}/unmatched.csv`, content: toCSV(unmatched) })
  const upload = await Promise.allSettled([uploadMatched, uploadUnmatched])
  if (upload.some(({ status }) => status === 'rejected'))
    throw new Error('Error uploading files to Supabase')
  const [matchedUrl, unmatchedUrl] = upload as PromiseFulfilledResult<string>[]

  return { matchedUrl: matchedUrl.value, unmatchedUrl: unmatchedUrl.value }
}

export async function downloadLocations(client: SupabaseClient<Database>, path: string) {
  const csv = await downloadCSV(client, path)
  const json = await csvToJson(csv) || []
  return json
}
