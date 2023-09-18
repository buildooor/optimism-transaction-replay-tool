import { getProvider } from './getProvider'
import { Contract, BigNumber } from 'ethers'
import OptimismPortal from '../abi/OptimismPortal.json'
import { addresses } from './addresses'

export async function getL1WithdrawalFinalizedStatus (l1ChainId: number, withdrawalHash: string) {
  if (!withdrawalHash) {
    return false
  }
  console.log('getL1WithdrawalFinalizedStatus')
  const provider = getProvider(l1ChainId, 'ethereum')
  const optimismPortalAddress = addresses[l1ChainId].optimismPortalAddress
  const contract = new Contract(optimismPortalAddress, OptimismPortal, provider)
  const proven = BigNumber.from((await contract.provenWithdrawals(withdrawalHash)).outputRoot).gt(0)
  const finalized = await contract.finalizedWithdrawals(withdrawalHash)
  console.log('done getL1WithdrawalFinalizedStatus', {proven, finalized})
  return  {
    proven,
    finalized
  }
}
