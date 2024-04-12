import type { LocationSource } from '../src/types'
import { Currency } from '~/types/crypto-map'

interface CoinmapLocation extends LocationSource {
  name: string
  created_on: number
  geolocation_degrees: string
  accepts: Currency[]
  coinmapCategory: string
}

export async function getLocations(url: URL): Promise<CoinmapLocation[]> {
  const data = await fetch(url).then(d => d.json()).then(d => d.venues)

  return data.map((venue: any) => {
    const id = venue.id
    const name = decodeURIComponent(encodeURI(venue.name))
    const lat = venue.lat
    const lng = venue.lon
    const coinmapCategory = decodeURIComponent(encodeURI(venue.category))
    const created_on = venue.created_on
    const geolocation_degrees = venue.geolocation_degrees
    const accepts = [Currency.BTC]
    return { id, name, lat, lng, accepts, coinmapCategory, created_on, geolocation_degrees } satisfies CoinmapLocation
  })
}
