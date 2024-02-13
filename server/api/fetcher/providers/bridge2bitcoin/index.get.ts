import * as xml2js from 'xml2js'
import { hash } from 'ohash'
import type { LocationSource } from '../../lib/types'
import { Currency, Provider } from '~/types/crypto-map'

// The original app is: https://bridgetobitcoin.ts

export default defineEventHandler(async () => {
  const locations = await getLocations('https://www.google.com/maps/d/kml?mid=1y3fCDIEzIaS9LSltjpT2Lr-D1lmQEj0&forcekml=1')

  return $fetch('/api/fetcher/match-placeid', {
    method: 'post',
    query: { provider: Provider.Bridge2Bitcoin },
    body: locations,
  })
})

interface BridgeToBitcoinLocation extends Omit<LocationSource, 'category'> {
  description: string
  lightning: boolean
  boltCard: boolean
  onlinePaymentsOnly: boolean
  coordinates: string
}

async function getLocations(url: string): Promise<BridgeToBitcoinLocation[]> {
  const data = await fetch(url).then(d => d.text())
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true })
  const result = await parser.parseStringPromise(data)
  const placemarks = result.kml.Document.Folder.reduce((acc: any, folder: any) => [...acc, ...folder.Placemark], [])
  const locations = placemarks.map((placemark: any) => {
    const name = placemark.name
    const id = hash(name)
    let description = placemark.description
    description = description.startsWith('Description: ') ? description.slice('Description: '.length) : description
    description = description.split('<br>').shift() || ''
    const lightning = placemark.ExtendedData.Data.find((data: any) => data.name === 'Lightning').value === 'Yes'
    const coordinates = placemark.Point.coordinates.trim()
    const lat = Number(coordinates.split(',')[1])
    const lng = Number(coordinates.split(',')[0])
    const boltCard = true
    const onlinePaymentsOnly = true
    const accepts = [Currency.BTC]

    return { id, name, description, lightning, lat, lng, boltCard, onlinePaymentsOnly, coordinates, accepts } satisfies BridgeToBitcoinLocation
  })
  return locations
}
