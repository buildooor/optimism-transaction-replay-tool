import { Contract } from 'ethers'
import { batchFetch } from './batchFetch'
import { getProvider } from './getProvider'
import L1CrossDomainMessenger from '../abi/L1CrossDomainMessenger.json'
import { addresses } from './addresses'

export async function getL1RelayedMessageEvents (l1ChainId: number, msgHash: string) {
  if (!msgHash) {
    return []
  }
  console.log('getL1RelayedMessageEvents')
  const provider = getProvider(l1ChainId, 'ethereum')
  const l1CrossDomainMessengerAddress = addresses[l1ChainId].l1CrossDomainMessengerAddress
  const blockNumber = await provider.getBlockNumber()
  const contract = new Contract(l1CrossDomainMessengerAddress, L1CrossDomainMessenger, provider)
  const filter = contract.filters.RelayedMessage(msgHash)
  const logs = await batchFetch(contract, filter, blockNumber - 400_000, blockNumber, 10000)
  console.log('done getL1RelayedMessageEvents', logs.length)
  return logs
}
