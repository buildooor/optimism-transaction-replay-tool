import { Contract } from 'ethers'
import { batchFetch } from './batchFetch'
import { getProvider } from './getProvider'
import L2ToL1MessagePasser from '../abi/L2ToL1MessagePasser.json'
import { addresses } from './addresses'

export async function getL2MessagePassedEvents (l1ChainId: number, txHashes?: string[]) {
  console.log('getL2MessagePassedEvents')
  const optimismProvider = getProvider(l1ChainId, 'optimism')
  const blockNumber = await optimismProvider.getBlockNumber()

  const l2ToL1MessagePasserAddress = addresses[l1ChainId].l2ToL1MessagePasserAddress
  const contract = new Contract(l2ToL1MessagePasserAddress, L2ToL1MessagePasser, optimismProvider)
  const filter = contract.filters.MessagePassed()
  const logs = await batchFetch(contract, filter, blockNumber - 400_000, blockNumber)
  console.log('done getL2MessagePassedEvents', logs.length)

  let result: any[] = []

  if (txHashes) {
    for (const log of logs) {
      if (txHashes.includes(log.transactionHash)) {
        result.push(log)
      }
    }
    console.log('done getL2MessagePassedEvents result', result.length)
  } else {
    result = logs
  }

  return result
}
