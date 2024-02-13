import { getLatestsFiles } from '../../lib/database'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async event => getLatestsFiles(event, Provider.BtcMap))
