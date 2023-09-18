export function getEtherscanApiUrl (l1ChainId: number, chain: string) {
  let baseUrl = l1ChainId === 1 ? 'https://api.etherscan.io' : 'https://api-goerli.etherscan.io'
  if (chain === 'optimism') {
    baseUrl = l1ChainId === 1 ? 'https://api-optimistic.etherscan.io' : 'https://api-goerli-optimistic.etherscan.io'
  }

  return baseUrl
}
