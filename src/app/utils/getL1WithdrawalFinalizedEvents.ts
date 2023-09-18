import { Contract } from 'ethers'
import { batchFetch } from './batchFetch'
import { getProvider } from './getProvider'
import OptimismPortal from '../abi/OptimismPortal.json'
import { addresses } from './addresses'

export async function getL1WithdrawalFinalizedEvents (l1ChainId: number, withdrawalHash: string) {
  if (!withdrawalHash) {
    return []
  }
  console.log('getL1WithdrawalFinalizedEvents')
  const provider = getProvider(l1ChainId, 'ethereum')
  const optimismPortalAddress = addresses[l1ChainId].optimismPortalAddress
  const blockNumber = await provider.getBlockNumber()
  const contract = new Contract(optimismPortalAddress, OptimismPortal, provider)
  const filter = contract.filters.WithdrawalFinalized(withdrawalHash)
  const logs = await batchFetch(contract, filter, blockNumber - 400_000, blockNumber, 10000)
  console.log('done getL1WithdrawalFinalizedEvents', logs.length)
  return logs
}
