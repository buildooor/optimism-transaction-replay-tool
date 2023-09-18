export function getExplorerUrl(l1ChainId: number, chain: string, txHash: string) {
  let baseUrl = l1ChainId === 1 ? 'https://etherscan.io' : 'https://goerli.etherscan.io'
  if (chain === 'optimism') {
    baseUrl = l1ChainId === 1? 'https://optimistic.etherscan.io' : 'https://goerli-optimism.etherscan.io'
  }
  return `${baseUrl}/tx/${txHash}`
}
