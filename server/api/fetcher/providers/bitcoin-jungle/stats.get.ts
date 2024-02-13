import { getStats } from '../../lib/database'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async event => getStats(event, Provider.BitcoinJungle))
