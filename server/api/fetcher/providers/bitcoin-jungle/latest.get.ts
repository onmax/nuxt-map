import { getLatestsFiles } from '../../../../../cli/core/database'
import { Provider } from '~/types/crypto-map'

export default defineEventHandler(async event => getLatestsFiles(event, Provider.BitcoinJungle))
