import { providers } from 'ethers'

export function getProvider(l1ChainId: number, chain: string) {
  let rpcUrl = l1ChainId === 1 ? 'https://rpc.ankr.com/eth' : 'https://rpc.ankr.com/eth_goerli'
  if (chain === 'optimism') {
    rpcUrl = l1ChainId === 1 ? 'https://rpc.ankr.com/optimism' : 'https://rpc.ankr.com/optimism_testnet'
  }

  const provider = new providers.StaticJsonRpcProvider(rpcUrl)
  return provider
}
