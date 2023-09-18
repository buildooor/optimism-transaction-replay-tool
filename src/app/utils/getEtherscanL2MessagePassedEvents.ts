import { Contract } from 'ethers'
import { getProvider } from './getProvider'
import { getEtherscanLogs } from './getEtherscanLogs'
import L2ToL1MessagePasser from '../abi/L2ToL1MessagePasser.json'
import { addresses } from './addresses'

export async function getEtherscanL2MessagePassedEvents (l1ChainId: number, txHashes?: string[]) {
  console.log('getEtherscanL2MessagePassedEvents')
  const optimismProvider = getProvider(l1ChainId, 'optimism')
  const blockNumber = await optimismProvider.getBlockNumber()

  const l2ToL1MessagePasserAddress = addresses[l1ChainId].l2ToL1MessagePasserAddress
  const contract = new Contract(l2ToL1MessagePasserAddress, L2ToL1MessagePasser, optimismProvider)
  const filter = contract.filters.MessagePassed()
  const logs = await getEtherscanLogs(l1ChainId, 'optimism', 0, blockNumber, l2ToL1MessagePasserAddress, filter?.topics?.[0])
  console.log('done getEtherscanL2MessagePassedEvents', logs.length)

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
    console.log('done getEtherscanL2MessagePassedEvents filtered', result.length)
  } else {
    result = logs
  }

  return result.slice(0, 100)
}
