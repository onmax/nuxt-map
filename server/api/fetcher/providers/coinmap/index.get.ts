import type { LocationSource } from '../../lib/types'
import { Currency, Provider } from '~/types/crypto-map'

export default defineEventHandler(async () => {
  const locations = await getLocations('https://coinmap.org/api/v1/venues/')

  return $fetch('/api/fetcher/match-placeid', {
    method: 'post',
    query: { provider: Provider.Coinmap },
    body: locations,
  })
})

interface CoinmapLocation extends Omit<LocationSource, 'category'> {
  name: string
  created_on: number
  geolocation_degrees: string
  accepts: Currency[]
}

async function getLocations(url: string) {
  const data = await fetch(url).then(d => d.json()).then(d => d.venues)

  return data.map((venue: any) => {
    const id = venue.id
    const name = decodeURIComponent(encodeURI(venue.name))
    const lat = venue.lat
    const lng = venue.lon
    const category = decodeURIComponent(encodeURI(venue.category))
    const created_on = venue.created_on
    const geolocation_degrees = venue.geolocation_degrees
    const accepts = [Currency.BTC]
    return { id, name, lat, lng, accepts, category, created_on, geolocation_degrees } satisfies CoinmapLocation
  })
}
