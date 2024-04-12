import { getStats } from '../../../../../cli/core/database'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async event => getStats(event, Provider.BtcMap))
