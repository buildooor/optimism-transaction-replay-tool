export function getChainId(l1ChainId: number, chainSlug: string) {
  let chainId = l1ChainId
  if (chainSlug === 'optimism') {
    chainId = l1ChainId === 1 ? 10 : 420
  }

  return chainId
}
