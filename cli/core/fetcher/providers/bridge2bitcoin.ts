import * as xml2js from 'xml2js'
import { hash } from 'ohash'
import type { FetcherResult, LocationSource } from '../src/types'
import { fetcher } from '../src'
import { getAuthClient } from '../src/database'
import { Currency, Provider } from '~/types/crypto-map'

// The original app is: https://bridgetobitcoin.ts

const PROVIDER = Provider.Bridge2Bitcoin

export async function fetchBridge2Bitcoin(): Promise<FetcherResult> {
  const supabaseClient = await getAuthClient()
  const locations = await getLocations(useRuntimeConfig().providersSources[PROVIDER])
  const res = await fetcher(locations, PROVIDER, supabaseClient)
  return res
}

interface BridgeToBitcoinLocation extends LocationSource {
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
