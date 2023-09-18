import { getProvider } from './getProvider'
import { Contract } from 'ethers'
import L2CrossDomainMessenger from '../abi/L2CrossDomainMessenger.json'
import { addresses } from './addresses'

export async function getL2MessageRelayStatus (l1ChainId: number, msgHash: string) {
  if (!msgHash) {
    return {}
  }
  console.log('getL2MessageRelayStatus')
  const provider = getProvider(l1ChainId, 'optimism')
  const l2CrossDomainMessengerAddress = addresses[l1ChainId].l2CrossDomainMessengerAddress
  const contract = new Contract(l2CrossDomainMessengerAddress, L2CrossDomainMessenger, provider)
  const failed = await contract.failedMessages(msgHash)
  const successful = await contract.successfulMessages(msgHash)
  const result = {
    failed,
    successful
  }
  console.log('done getL2MessageRelayStatus', result)
  return result
}
