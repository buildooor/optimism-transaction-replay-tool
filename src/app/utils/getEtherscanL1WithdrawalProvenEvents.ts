import { Contract } from 'ethers'
import { getProvider } from './getProvider'
import { getEtherscanLogs } from './getEtherscanLogs'
import OptimismPortal from '../abi/OptimismPortal.json'
import { addresses } from './addresses'

export async function getEtherscanL1WithdrawalProvenEvents (l1ChainId: number, withdrawalHash: string) {
  if (!withdrawalHash) {
    return []
  }
  console.log('getEtherscanL1WithdrawalProvenEvents')
  const provider = getProvider(l1ChainId, 'ethereum')
  const optimismPortalAddress = addresses[l1ChainId].optimismPortalAddress
  const blockNumber = await provider.getBlockNumber()
  const contract = new Contract(optimismPortalAddress, OptimismPortal, provider)
  const filter = contract.filters.WithdrawalProven(withdrawalHash)
  const logs = await getEtherscanLogs(l1ChainId, 'ethereum', 0, blockNumber, optimismPortalAddress, filter?.topics?.[0], filter?.topics?.[1])
  console.log('done getEtherscanL1WithdrawalFinalizedEvents', logs.length)
  const result = logs.map((log: any) => {
    return {
      ...log,
      ...contract.interface.parseLog(log),
    }
  })
  console.log('result', result)
  return result.slice(0, 100)
}
