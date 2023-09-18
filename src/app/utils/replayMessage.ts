import { CrossChainMessenger, MessageStatus } from '@eth-optimism/sdk'
import { getProvider } from './getProvider'
import { formatUnits } from 'ethers/lib/utils'

export async function replayMessage(input: any): Promise<any> {
  const { l1ChainId, fromChain, originTxHash, gasLimit, getSignerOrRequestWallet, checkConnectedNetworkIdOrThrow, prove, estimateOnly } = input

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
  await checkConnectedNetworkIdOrThrow(fromChain === 'ethereum' ? l2ChainId : l1ChainId)
  console.log('signer', signer)
  console.log('address', await signer.getAddress())

  const ccm = new CrossChainMessenger({
    l1ChainId,
    l2ChainId,
    l1SignerOrProvider: fromChain === 'optimism' ? signer : getProvider(l1ChainId, 'ethereum'),
    l2SignerOrProvider: fromChain === 'ethereum' ? signer : getProvider(l1ChainId, 'optimism'),
    bedrock: true
  })

  const messageStatus = await ccm.getMessageStatus(originTxHash)
  if (messageStatus === MessageStatus.STATE_ROOT_NOT_PUBLISHED) {
    throw new Error('State root not published yet')
  }

  if (messageStatus === MessageStatus.RELAYED) {
    throw new Error('Message already relayed')
  }

  if (messageStatus === MessageStatus.IN_CHALLENGE_PERIOD) {
    throw new Error('Message is in challenge period')
  }

  if (prove) {
    if (messageStatus !== MessageStatus.READY_TO_PROVE) {
      throw new Error('Message not ready to prove')
    }
    const tx = await ccm.proveMessage(originTxHash)
    return tx
  }

  if (estimateOnly) {
    const estimatedGas = await ccm.estimateGas.finalizeMessage(originTxHash, {
      overrides: {
        gasLimit
      }
    })

    const gasPrice = await signer.getGasPrice()
    return formatUnits(estimatedGas.mul(gasPrice), 9)
  }

  const tx = await ccm.finalizeMessage(originTxHash, {
    overrides: {
      gasLimit
    }
  })

  return tx
}
