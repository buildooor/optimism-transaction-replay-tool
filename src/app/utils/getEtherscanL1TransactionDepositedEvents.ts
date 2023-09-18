import { Contract } from 'ethers'
import { getProvider } from './getProvider'
import { getEtherscanLogs } from './getEtherscanLogs'
import OptimismPortal from '../abi/OptimismPortal.json'
import { addresses } from './addresses'

export async function getEtherscanL1TransactionDepositedEvents (l1ChainId: number, txHashes?: string[]) {
  console.log('getEtherscanL1TransactionDepositedEvents')
  const optimismProvider = getProvider(l1ChainId, 'ethereum')
  const blockNumber = await optimismProvider.getBlockNumber()

  const optimismPortalAddress = addresses[l1ChainId].optimismPortalAddress
  const contract = new Contract(optimismPortalAddress, OptimismPortal, optimismProvider)
  const filter = contract.filters.TransactionDeposited()
  const logs = await getEtherscanLogs(l1ChainId, 'ethereum', blockNumber-100_000, blockNumber, optimismPortalAddress, filter?.topics?.[0])
  console.log('done getEtherscanL1TransactionDepositedEvents', logs.length)

  let result: any[] = []

  if (txHashes) {
    const filtered: any[] = []
    for (const log of logs) {
      if (txHashes.includes(log.transactionHash)) {
        filtered.push(log)
      }
    }
    result = filtered.map((log: any) => {
      return {
        ...log,
        ...contract.interface.parseLog(log),
      }
    })
    console.log('done getEtherscanL1TransactionDepositedEvents filtered', result.length)
  } else {
    result = logs
  }

  return result.slice(0, 100)
}
