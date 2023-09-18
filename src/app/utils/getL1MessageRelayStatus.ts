import { getProvider } from './getProvider'
import { Contract } from 'ethers'
import L1CrossDomainMessenger from '../abi/L1CrossDomainMessenger.json'
import { addresses } from './addresses'

export async function getL1MessageRelayStatus (l1ChainId: number, msgHash: string) {
  if (!msgHash) {
    return {}
  }
  console.log('getL1MessageRelayStatus')
  const provider = getProvider(l1ChainId, 'ethereum')
  const l1CrossDomainMessengerAddress = addresses[l1ChainId].l1CrossDomainMessengerAddress
  const contract = new Contract(l1CrossDomainMessengerAddress, L1CrossDomainMessenger, provider)
  const failed = await contract.failedMessages(msgHash)
  const successful = await contract.successfulMessages(msgHash)
  const result = {
    failed,
    successful
  }
  console.log('done getL1MessageRelayStatus', result)
  return result
}
