import { makeEtherscanRequest } from './makeEtherscanRequest'
import { getEtherscanApiUrl } from './getEtherscanApiUrl'

export async function getEtherscanLogs (l1ChainId: number, chain: string, fromBlock: number, toBlock: number, address: string, topic0?: string | string[], topic1?: string | string[]) {
  console.log('getEtherscanLogs')
  const baseUrl = getEtherscanApiUrl(l1ChainId, chain)

  let url = `${baseUrl}/api?module=logs&action=getLogs&address=${address}&fromBlock=${fromBlock}&toBlock=${toBlock}&topic0=${topic0}&page=1&offset=0&sort=desc&apikey=YourApiKeyToken`
  if (topic1) {
    url += `&topic0_1_opr=and&topic1=${topic1}`
  }
  const logs = await makeEtherscanRequest(url)
  return logs
}
