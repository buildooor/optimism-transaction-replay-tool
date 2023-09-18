import { makeEtherscanRequest } from './makeEtherscanRequest'
import { getEtherscanApiUrl } from './getEtherscanApiUrl'

export async function getEtherscanTxs(l1ChainId: number, chain: string, accountAddress: string) {
  try {
    console.log('getEtherscanTxs')
    const baseUrl = getEtherscanApiUrl(l1ChainId, chain)

    const url = `${baseUrl}/api?module=account&action=txlist&address=${accountAddress}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
    console.log(url)
    const txs = await makeEtherscanRequest(url)
    console.log('done getEtherscanTxs', txs.length)
    return txs
  } catch (err: any) {
    if (err.message.includes('No transactions found')) {
      return []
    }
    throw err
  }
}
