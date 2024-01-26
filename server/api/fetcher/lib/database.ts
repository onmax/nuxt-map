import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { fillMissingFields, parseGoogleTypes } from './matcher'
import { MatchState } from './types'
import type { MatchVerdict, MatchVerdictFlat } from './types'
import { toCSV } from './csv'
import type { Database, Json } from '~/types/supabase'
import type { Category, Currency, Provider } from '~/types/crypto-map'
import { serverSupabaseClient } from '#supabase/server'

export async function uploadCsv(client: SupabaseClient<Database>, csv: string, name: string) {
  const csvBlob = new Blob([csv], { type: 'text/csv' })
  const { data: dataUpload, error: errorUpload } = await client.storage.from('locations-sources').upload(name, csvBlob, { cacheControl: '3600', upsert: false })
  if (errorUpload)
    throw errorUpload
  const { data: dataPublicUrl } = client.storage.from('locations-sources').getPublicUrl(dataUpload.path, { download: true })

  return dataPublicUrl.publicUrl
}

export async function supabaseBucketCleanup(client: SupabaseClient<Database>, folder: string) {
  async function keepOnly10Files(files: { name: string, created_at: string }[]) {
    // Max 10 files. So remove the oldest ones until we have less than 10
    if (files.length >= 10) {
      const filesToDelete = files
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, files.length - 10)
        .map(({ name }) => `${folder}/${name}`)
      if (filesToDelete.length > 0) {
        const { error: errorDelete } = await client.storage.from('locations-sources').remove(filesToDelete)
        if (errorDelete)
          throw errorDelete
      }
    }
  }

  async function deleteRecentFiles(files: { name: string, created_at: string }[]) {
    // Remove files that are younger than 12 hours
    if (files.length > 0) {
      const filesToDelete = files
        .filter(({ created_at }) => new Date().getTime() - new Date(created_at).getTime() < 12 * 60 * 60 * 1000)
        .map(({ name }) => `${folder}/${name}`)
      if (filesToDelete.length > 0) {
        const { error: errorDelete } = await client.storage.from('locations-sources').remove(filesToDelete)
        if (errorDelete)
          throw errorDelete
      }
    }
  }

  const { data: files, error: errorFiles } = await client.storage.from('locations-sources').list(folder)
  if (errorFiles)
    throw errorFiles

  const successFiles = files.filter(({ name }) => name.includes('ok'))
  const conflictFiles = files.filter(({ name }) => name.includes('conflict'))

  await keepOnly10Files(successFiles)
  await keepOnly10Files(conflictFiles)
  await deleteRecentFiles(successFiles)
  await deleteRecentFiles(conflictFiles)
}

export async function addToDatabase(client: SupabaseClient<Database>, allLocations: MatchVerdictFlat[], provider: Provider) {
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
  const toLocationDb = (match: MatchVerdictFlat): LocationDb => ({
    name: match.name,
    address: match.candidateAddress!, // TODO If match by location, we need first to retrieve the data and also save it in Supabase
    gmaps: match.candidatePlaceId,
    category: parseGoogleTypes(match.candidateGMapsTypes || []),
    gmaps_types: match.candidateGMapsTypes!,
    enabled: true,
    lat: match.candidateLat,
    lng: match.candidateLng,
    accepts: match.accepts || [],
    sells: match.sells || [],
    facebook: match.facebook,
    instagram: match.instagram,
    photo: match.candidatePhoto,
    rating: match.candidateRating,
    provider,
  })

  // For now we only add the locations that have been matched successfully
  const locations = allLocations
    .filter(({ state }) => state === MatchState.Success)
    .map(toLocationDb)

  const body = { locations: locations as unknown as Json[] }
  const { error: errorInsert } = await client.rpc('upsert_locations_with_gmaps_api', body)
  return errorInsert
}

/**
 * Given a list of matches, it will upload them to Supabase and return the path where they were uploaded
 * We
 */
export async function uploadVerdict(matches: MatchVerdict[], provider: string, event: H3Event) {
  // Fill missing fields for each match.
  // When we search by coordinates, we don't get the address, and other fields. So we need to fetch them
  const matchedLocations = await fillMissingFields(matches)
  const csvSuccess = toCSV(matchedLocations)

  // Get the matches that have multiple matches and return them as CSV
  const conflictMatches = flattenMatchVerdicts(matches.filter(({ state }) => state === MatchState.MultipleMatches))
  const csvConflict = toCSV(conflictMatches)

  const client = await serverSupabaseClient(event)
  const { supabaseAdminPassword: password, supabaseAdminUser: email } = useRuntimeConfig()

  await client.auth.signInWithPassword({ email, password })
  supabaseBucketCleanup(client, provider)

  const ts = new Date().toISOString().replace(/:/g, '-').replace('T', '-').split('.')[0]
  const pathSuccess = await uploadCsv(client, csvSuccess, `${provider}/ok-${ts}.csv`)
  const pathConflict = await uploadCsv(client, csvConflict, `${provider}/conflicts-${ts}.csv`)

  return { pathConflict, pathSuccess }
}

export function flattenMatchVerdicts(allLocations: MatchVerdict[]): MatchVerdictFlat[] {
  const locations: MatchVerdictFlat[] = []
  for (const item of allLocations) {
    if (item.state === MatchState.Success) {
      const { candidate, matchBy, score } = item.matches[0]
      locations.push({ ...item, ...candidate, matchBy: [matchBy], ...score })
    }
    else {
      item.matches
        .flatMap(({ score, candidate, matchBy }) => ({ ...item, ...{ ...score, ...candidate }, matchBy: [matchBy] }))
        .forEach(item => locations.push(item))
    }
  }
  return locations
}
