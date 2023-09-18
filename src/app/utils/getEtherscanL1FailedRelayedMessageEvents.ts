import { Contract } from 'ethers'
import { getProvider } from './getProvider'
import { getEtherscanLogs } from './getEtherscanLogs'
import L1CrossDomainMessenger from '../abi/L1CrossDomainMessenger.json'
import { addresses } from './addresses'

export async function getEtherscanL1FailedRelayedMessageEvents (l1ChainId: number, msgHash: string) {
  if (!msgHash) {
    return []
  }
  console.log('getEtherscanL1FailedRelayedMessageEvents')
  const provider = getProvider(l1ChainId, 'ethereum')
  const l1CrossDomainMessengerAddress = addresses[l1ChainId].l1CrossDomainMessengerAddress
  const blockNumber = await provider.getBlockNumber()
  const contract = new Contract(l1CrossDomainMessengerAddress, L1CrossDomainMessenger, provider)
  const filter = contract.filters.FailedRelayedMessage(msgHash)
  const logs = await getEtherscanLogs(l1ChainId, 'ethereum', 0, blockNumber, l1CrossDomainMessengerAddress, filter?.topics?.[0], filter?.topics?.[1])
  console.log('done getEtherscanL1FailedRelayedMessageEvents', logs.length)
  return logs.slice(0, 100)
}
