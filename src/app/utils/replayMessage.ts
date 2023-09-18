import { providers } from 'ethers'
import { CrossChainMessenger, MessageStatus } from '@eth-optimism/sdk'
import { getProvider } from './getProvider'

export async function replayMessage(input: any) {
  const { l1ChainId, fromChain, originTxHash, gasLimit, getSignerOrRequestWallet, checkConnectedNetworkIdOrThrow, prove } = input

  if (!l1ChainId) {
    throw new Error('l1ChainId is required')
  }

  if (!originTxHash) {
    throw new Error('originTxHash is required')
  }

  if (!gasLimit && !prove) {
    throw new Error('gasLimit is required')
  }

  console.log('replaying')
  const l2ChainId = l1ChainId === 1 ? 10 : 420
  console.log('l1ChainId', l1ChainId, 'l2ChainId', l2ChainId, 'fromChain', fromChain)
  const signer = await getSignerOrRequestWallet()
  await checkConnectedNetworkIdOrThrow(fromChain === 'ethereum' ? l1ChainId : l2ChainId)
  console.log('signer', signer)
  console.log('address', await signer.getAddress())

  const ccm = new CrossChainMessenger({
    l1ChainId,
    l2ChainId,
    l1SignerOrProvider: fromChain !== 'ethereum' ? signer : getProvider(l1ChainId, 'ethereum'),
    l2SignerOrProvider: fromChain === 'ethereum' ? signer : getProvider(l1ChainId, 'optimism'),
    bedrock: true
  })

  if (prove) {
    const tx = await ccm.proveMessage(originTxHash)
    return tx
  }

  const tx = await ccm.finalizeMessage(originTxHash, {
    overrides: {
      gasLimit
    }
  })

  return tx
}
