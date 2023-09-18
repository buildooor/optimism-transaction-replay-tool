import { Contract } from 'ethers'

export async function batchFetch (contract: Contract, filter: any, startBlockNumber: number, endBlockNumber: number, batchSize = 10000) {
  const logs: any[] = []
  let start = startBlockNumber
  let end = Math.min(start + batchSize, endBlockNumber)
  while (end <= endBlockNumber) {
    const _logs = await contract.queryFilter(
      filter,
      start,
      end
    )

    console.log(start, end, _logs.length)
    logs.push(..._logs)

    // Add 1 so that boundary blocks are not double counted
    start = end + 1

    // If the batch is less than the batchSize, use the endBlockNumber
    const newEnd = start + batchSize
    end = Math.min(endBlockNumber, newEnd)

    // For the last batch, start will be greater than end because end is capped at endBlockNumber
    if (start > end) {
      break
    }
  }
  return logs
}
