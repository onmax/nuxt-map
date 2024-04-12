import { hash } from 'ohash'
import type { FetcherResult, LocationSource } from '../src/types'
import { fetcher } from '../src'
import { getAuthClient } from '../src/database'
import { Currency, Provider } from '~/types/crypto-map'

const PROVIDER = Provider.AcceptLightning

export async function fetchAcceptLightning(): Promise<FetcherResult> {
  const supabaseClient = await getAuthClient()
  const locations = await getLocations(useRuntimeConfig().providersSources[PROVIDER])
  const res = await fetcher(locations, PROVIDER, supabaseClient)
  return res
}

export interface AcceptLightningApi extends LocationSource {
  phone?: string
  website?: string
  service?: string
  city?: string
  country?: string
}

export interface FromApi {
  name: string
  service: string
  location: { url?: string, city?: string, country?: string, latlong?: { lat: number, lng: number } }
}

async function getLocations(url: string): Promise<AcceptLightningApi[]> {
  const data: FromApi[] = await fetch(url).then(d => d.json())

  return data
    .filter(loc => loc.location.latlong && loc.location.latlong.lat && loc.location.latlong.lng)
    .map(loc => ({
      name: loc.name,
      id: hash(loc.name),
      service: loc.service,
      lat: loc.location.latlong!.lat!,
      lng: loc.location.latlong!.lng!,
      city: loc.location.city,
      country: loc.location.country,
      accepts: [Currency.LBTC],
    } satisfies AcceptLightningApi))
}
