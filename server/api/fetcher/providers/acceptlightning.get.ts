import { hash } from 'ohash'
import type { BasicLocation } from '../lib/types'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async () => {
  const locations = await getLocations('https://acceptlightning.com/merchants.json')

  return $fetch('/api/fetcher/match-placeid', {
    method: 'post',
    query: { provider: Provider.AcceptLightning },
    body: locations,
  })
})

export interface AcceptLightningApi extends BasicLocation {
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
    } satisfies AcceptLightningApi))
}
