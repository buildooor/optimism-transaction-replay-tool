'use client'
import { useState, useMemo, useEffect } from 'react'
import styles from './page.module.css'
import Image from 'next/image'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import InfoIcon from '@mui/icons-material/Info'
import CloseIcon from '@mui/icons-material/Close'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import LoadingButton from '@mui/lab/LoadingButton'
import TextField from '@mui/material/TextField'
import { getAddress } from 'ethers/lib/utils'
import { CrossChainMessenger, MessageDirection } from '@eth-optimism/sdk'
import { useQuery } from 'react-query'
import { QueryClient, QueryClientProvider } from 'react-query'
import { getProvider } from './utils/getProvider'
import { getEtherscanTxs } from './utils/getEtherscanTxs'
import { getEtherscanL2MessagePassedEvents } from './utils/getEtherscanL2MessagePassedEvents'
import { getEtherscanL1TransactionDepositedEvents } from './utils/getEtherscanL1TransactionDepositedEvents'
import { replayMessage } from './utils/replayMessage'
import { getL1MessageRelayStatus } from './utils/getL1MessageRelayStatus'
import { getL1WithdrawalFinalizedStatus } from './utils/getL1WithdrawalFinalizedStatus'
import { getL2MessageRelayStatus } from './utils/getL2MessageRelayStatus'
import { getChainId } from './utils/getChainId'
import { promiseQueue } from './utils/promiseQueue'
import { hashCrossDomainMessagev1 } from '@eth-optimism/core-utils'
import Table from '@mui/material/Table'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { DateTime } from 'luxon'
import Tooltip from '@mui/material/Tooltip'
import { getExplorerUrl } from './utils/getExplorerUrl'
import Modal from '@mui/material/Modal'
import { providers } from 'ethers'
import Onboard from '@web3-onboard/core'
import injectedModule from '@web3-onboard/injected-wallets'

async function findL2ToL1Messages(l1ChainId: number, accountAddress: string, max?: number) {
  return findMessages(l1ChainId, 'optimism', 'ethereum', accountAddress)
}

async function findL1ToL2Messages(l1ChainId: number, accountAddress: string, max?: number) {
  return findMessages(l1ChainId, 'ethereum', 'optimism', accountAddress, max)
}

async function findMessages(l1ChainId: number, fromChain: string, toChain: string, accountAddress: string, max: number = 10) {
  const result :any = {}
  const txs = await getEtherscanTxs(l1ChainId, fromChain, accountAddress)
  const txHashes = txs.map((tx: any) => tx.hash)
  const _logs = fromChain === 'optimism' ? await getEtherscanL2MessagePassedEvents(l1ChainId, txHashes) : await getEtherscanL1TransactionDepositedEvents(l1ChainId, txHashes)
  const logs = _logs.map((log: any) => {
    const timestamp = Number(log.timestamp || log.timeStamp)
    return {
      ...log,
      timestamp
    }
  })
  .sort((a: any, b: any) => b.timestamp - a.timestamp)
  .slice(0, max)

  const ethereumProvider = getProvider(l1ChainId, 'ethereum')
  const optimismProvider = getProvider(l1ChainId, 'optimism')

  await promiseQueue(logs, async (log: any, i: number) => {
    console.log(`processing #${i}/${logs.length}`)

    const originTxHash = log.transactionHash
    const withdrawalHash = log.args.withdrawalHash

    if (!originTxHash) {
      throw new Error('expected originTxHash')
    }

    const ccm = new CrossChainMessenger({
      l1ChainId: getChainId(l1ChainId, 'ethereum'),
      l2ChainId: getChainId(l1ChainId, 'optimism'),
      l1SignerOrProvider: ethereumProvider,
      l2SignerOrProvider: optimismProvider,
      bedrock: true
    })

    const messageIndex = 0
    let msgHash = ''
    try {
      let resolved : any = null
      if (fromChain === 'optimism') {
        resolved = await ccm.toCrossChainMessage(originTxHash, messageIndex)
      } else {
        const messages = await ccm.getMessagesByTransaction(originTxHash, { direction: MessageDirection.L1_TO_L2 })
        resolved = messages[messageIndex]
      }

      if (!resolved) {
        throw new Error('expected resolved')
      }

      msgHash = hashCrossDomainMessagev1(
        resolved.messageNonce,
        resolved.sender,
        resolved.target,
        resolved.value,
        resolved.minGasLimit,
        resolved.message
      )
    } catch (err: any) {
      if (!err.message.includes('withdrawal index 0 out of bounds. There are 0 withdrawals')) {
        console.error(err)
        throw err
      }
    }

    let error = ''
    if (!msgHash) {
      error = 'could not read message hash'
    }

    const originTxHashExplorerUrl = getExplorerUrl(l1ChainId, fromChain, originTxHash)
    const direction = fromChain === 'ethereum' ? 'L1->L2' : 'L2->L1'
    const timestamp = log.timestamp
    const relativeTime = DateTime.fromSeconds(timestamp).toRelative()
    result[originTxHash] = {
      timestamp,
      relativeTime,
      direction,
      fromChain,
      originTxHash,
      originTxHashExplorerUrl,
      withdrawalHash,
    }
    if (error) {
      result[originTxHash].error = error
    } else {
      let [relayStatus, finalizedStatus] = await Promise.all([
        toChain === 'ethereum' ? getL1MessageRelayStatus(l1ChainId, msgHash) : getL2MessageRelayStatus(l1ChainId, msgHash),
        toChain === 'ethereum' ? getL1WithdrawalFinalizedStatus(l1ChainId, withdrawalHash) : Promise.resolve({} as any)
      ])
      let isFinalized = finalizedStatus?.finalized ?? false
      let isProven = finalizedStatus?.proven ?? false
      if (!isProven) {
        isProven = (relayStatus as any)?.successful ?? false
      }
      if (!isFinalized) {
        isFinalized = (relayStatus as any)?.successful ?? false
      }

      result[originTxHash] = {
        ...result[originTxHash],
        msgHash,
        relayStatus,
        isProven,
        isFinalized,
      }
    }
  }, { concurrency: 25 })

  console.log('done findMessages result', result)

  return result
}

function useData() {
  const [l1ChainId, setL1ChainId] = useState(() => {
    try {
      return parseInt(localStorage.getItem('l1ChainId') || '1')
    } catch(err: any) {
      // console.error(err)
    }
    return 1
  })
  const [accountAddress, setAccountAddress] = useState(() => {
    try {
      return localStorage.getItem('accountAddress') || ''
    } catch(err: any) {
      // console.error(err)
    }
    return ''
  })

  useEffect(() => {
    try {
      localStorage.setItem('l1ChainId', l1ChainId?.toString())
    } catch (err: any) {
      // console.error(err)
    }
  }, [l1ChainId])

  useEffect(() => {
    try {
      localStorage.setItem('accountAddress', accountAddress)
    } catch (err: any) {
      // console.error(err)
    }
  }, [accountAddress])

  const [result, setResult] = useState<any>(null)
  const max = 10

  const { isLoading, data, error } = useQuery([`events-${accountAddress}-${l1ChainId}`, accountAddress, l1ChainId], async () => {
    try {
      // validate address
      getAddress(accountAddress)
    } catch(err: any) {
      return []
    }

    if (result) {
      return result
    }

    try {
      const result1 = await findL2ToL1Messages(l1ChainId, accountAddress, max)
      const array1 = Object.values(result1)
      const result2 = await findL1ToL2Messages(l1ChainId, accountAddress, max)
      const array2 = Object.values(result2)
      const combined = [...array1, ...array2].sort((a: any, b: any) => b.timestamp - a.timestamp)
      setResult(combined)
      return combined
    } catch (err: any) {
      console.error(err)
      throw err
    }
  }, {
    enabled: true,
    refetchInterval: 60 * 60 * 1000
  })

  const [replayItem, setReplayItem] = useState<any>(null)

  function showModal(item: any) {
    setReplayItem(item)
  }

  return {
    rows: data,
    error,
    isLoading,
    accountAddress,
    setAccountAddress,
    showModal,
    replayItem,
    setReplayItem,
    l1ChainId,
    setL1ChainId,
    max
  }
}

const injected = injectedModule()

const chains = [
  {
    id: '0x1',
    token: 'ETH',
    label: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/84842078b09946638c03157f83405213'
  },
  {
    id: '0x5',
    token: 'ETH',
    label: 'Goerli',
    rpcUrl: 'https://goerli.infura.io/v3/84842078b09946638c03157f83405213'
  },
  {
    id: '0xA',
    token: 'ETH',
    label: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io'
  },
  {
    id: '0x1A4',
    token: 'ETH',
    label: 'Optimism Goerli',
    rpcUrl: 'https://goerli.optimism.io'
  }
]

function useWeb3 () {
  const [provider, setProvider] = useState<providers.Web3Provider | undefined>()
  const [address, setAddress] = useState('')
  const [connectedNetworkId, setConnectedNetworkId] = useState<number|undefined>()
  const [walletName, setWalletName] = useState<string>('')
  const [walletIcon, setWalletIcon] = useState<string>('')
  const [error, setError] = useState<any>(null)

  const onboard = useMemo(() => {
    const instance = Onboard({
      wallets: [injected],
      chains,
      connect: {
        showSidebar: false,
        disableClose: false,
        autoConnectLastWallet: true,
        autoConnectAllPreviousWallet: false,
      },
      accountCenter: {
        desktop: {
          enabled: true,
        },
        mobile: {
          enabled: true,
        }
      },
      notify: {
        enabled: true
      },
    })

    return instance
  }, [])

  async function handleWalletChange(wallet: any) {
    try {
      const _address = wallet?.accounts?.[0]?.address
      if (_address) {
        setAddress(_address)
      } else {
        setAddress('')
      }

      const connectedNetworkId = Number(wallet?.chains?.[0]?.id)
      if (connectedNetworkId) {
        setConnectedNetworkId(connectedNetworkId)
      } else {
        setConnectedNetworkId(undefined)
      }

      if (wallet?.provider) {
        const { icon, label, provider } = wallet
        const ethersProvider = new providers.Web3Provider(provider, 'any')
        if (provider.enable && !provider.isMetaMask) {
          // needed for WalletConnect and some wallets
          await provider.enable()
        } else {
          // note: this method may not be supported by all wallets
          try {
            await ethersProvider.send('eth_requestAccounts', [])
          } catch (error) {
            console.error(error)
          }
        }
        setProvider(ethersProvider)
        setWalletName(label)

        try {
          const svg = new Blob([icon], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svg)
          setWalletIcon(url)
        } catch (err: any) {
          setWalletIcon('')
        }

        return ethersProvider
      } else {
        setWalletName('')
        setWalletIcon('')
        setProvider(undefined)
        setAddress('')
      }
    } catch (err) {
      console.error(err)
      setProvider(undefined)
      setAddress('')
    }
  }

  useEffect(() => {
    const state = onboard.state.select('wallets')
    let lastUpdate = ''
    const { unsubscribe } = state.subscribe((update: any) => {
      let shouldUpdate = true
      const _walletName = update?.[0]?.label
      if (_walletName === 'WalletConnect') {
        const str = JSON.stringify({ account: update?.[0]?.accounts, chains: update?.[0]?.chains })
        shouldUpdate = lastUpdate !== str
        if (shouldUpdate) {
          lastUpdate = str
        }
      }
      if (shouldUpdate) {
        // logger.debug('onboard state update: ', update)
        const [wallet] = update
        handleWalletChange(wallet)
      }
    })

    return () => {
      try {
        unsubscribe()
      } catch (err: any) {}
    }
  }, [onboard])

  async function requestWallet() {
    try {
      localStorage.clear()
      const [primaryWallet] = onboard.state.get().wallets
      if (primaryWallet) {
        await onboard.disconnectWallet({ label: primaryWallet.label })
      }
      await onboard.connectWallet()
      const _wallet = onboard.state.get().wallets?.[0]
      if (_wallet) {
        const provider = handleWalletChange(_wallet)
        return provider
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function disconnectWallet() {
    try {
      localStorage.clear()
      const [primaryWallet] = onboard.state.get().wallets
      if (primaryWallet) {
        await onboard.disconnectWallet({ label: primaryWallet.label })
      }
    } catch (error) {
      console.error(error)
    }
  }

  const checkConnectedNetworkId = async (networkId?: number): Promise<boolean> => {
    if (!(networkId && provider)) return false

    const signerNetworkId = (await provider.getNetwork())?.chainId
    console.debug('checkConnectedNetworkId', networkId, signerNetworkId)

    try {
      // NOTE: some mobile wallets don't support wallet_switchEthereumChain or wallet_addEthereumChain.
      // NOTE: Trust Wallet hangs indefinteily on wallet_switchEthereumChain, see issues on discord.
      // Therefore if provider is already connected to correct network,
      // then there's no need to attempt to call network switcher.
      if (signerNetworkId === networkId) {
        return true
      }

      const wallets = onboard.state.get().wallets
      console.debug('onboard wallets', wallets)
      const _address = wallets?.[0].accounts?.[0]?.address
      if (_address) {
        await onboard.setChain({ chainId: networkId })
      }
    } catch (err: any) {
      console.error('checkConnectedNetworkId error:', err)
    }

    // after network switch, recheck if provider is connected to correct network.
    const net = await provider.getNetwork()
    if (net.chainId === networkId) {
      return true
    }

    return false
  }

  async function checkConnectedNetworkIdOrThrow (chainId: number) {
    const isConnected = await checkConnectedNetworkId(chainId)
    if (!isConnected) {
      throw new Error(`Please connect your wallet to the ${chainId} network`)
    }
  }

  const walletConnected = !!address

  async function getSignerOrRequestWallet() {
    let signer = provider?.getSigner()
    if (!signer) {
      const _provider = await requestWallet()
      signer = _provider?.getSigner()
    }
    if (!signer) {
      throw new Error('No signer')
    }

    return signer
  }

  return {
    onboard,
    provider,
    address,
    error,
    requestWallet,
    disconnectWallet,
    walletConnected,
    getSignerOrRequestWallet,
    checkConnectedNetworkId,
    checkConnectedNetworkIdOrThrow,
    connectedNetworkId,
  }
}

function Main() {
  const { rows, error, isLoading, accountAddress, setAccountAddress, showModal, replayItem, setReplayItem, l1ChainId, setL1ChainId, max } = useData()
  const web3 = useWeb3()

  return (
    <main className={styles.main}>
      <Box mb={5}>
        <div className={styles.titleContainer}>
          <a href="/"><Image src="/assets/optimism.svg" alt="" width={200} height={40} /> <span className={styles.title}>Transaction Replay Tool</span></a>
        </div>
      </Box>
      <Box mb={5}>
        <Typography variant="h5" component="h2" gutterBottom>
          Account Address
          <Tooltip disableFocusListener title="Sender account address to check messages for." style={{ cursor: 'help' }}>
            <InfoIcon />
          </Tooltip>
        </Typography>
        <TextField
          style={{width: '100%'}}
          value={accountAddress}
          onChange={(event: any) => setAccountAddress(event.target.value?.trim())}
        />
      </Box>
      <Tabs
        value={l1ChainId?.toString()}
        onChange={(event: any, newValue: string) => setL1ChainId(parseInt(newValue))}
        textColor="secondary"
        indicatorColor="secondary"
        aria-label="network"
      >
        <Tab value="1" label="Mainnet" />
        <Tab value="5" label="Goerli" />
      </Tabs>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>
                {'#'}
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Date</Box>
                  <Tooltip disableFocusListener title="The date when origin transaction was sent." style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Origin Transaction Hash</Box>
                  <Tooltip disableFocusListener title="The transaction hash that initiated the message." style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Direction</Box>
                  <Tooltip disableFocusListener title="Direction of message" style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Message Proven</Box>
                  <Tooltip disableFocusListener title="If proven but not finalized, message cannot replayed." style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Message Finalized</Box>
                  <Tooltip disableFocusListener title="If finalized, message cannot be replayed." style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell>
                <Box display="flex">
                  <Box mr={1}>Relay Status</Box>
                  <Tooltip disableFocusListener title="The status of the message relay. The transaction can be replayed only if failed status and not message not finalized." style={{ cursor: 'help' }}>
                    <InfoIcon />
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!accountAddress && (
              <TableRow
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell>
                  Enter an account address to get started.
                </TableCell>
              </TableRow>
            )}
            {!!accountAddress && isLoading && (
              <TableRow
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell>
                  Fetching data (this may take a minute)...
                </TableCell>
              </TableRow>
            )}
            {!!accountAddress && !isLoading && rows?.length === 0 && (
              <TableRow
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell>
                  No messages found for this account.
                </TableCell>
              </TableRow>
            )}
            {rows?.length > 0 && rows.map((row: any, i: number) => {
              return (
                <TableRow
                  key={row.originTxHash}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    {i+1}
                  </TableCell>
                  <TableCell>
                    {row.relativeTime}
                  </TableCell>
                  <TableCell>
                    <Link href={row.originTxHashExplorerUrl} target="_blank">{row.originTxHash}</Link>
                    <div style={{
                      opacity: 0.5
                      }}>
                      {!!row.msgHash && (
                        <div>
                          <small>Message hash: {row.msgHash}</small>
                        </div>
                      )}
                      {!!row.withdrawalHash && (
                        <div>
                          <small>Withdrawal hash: {row.withdrawalHash}</small>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell align="center">
                    {row.direction}
                  </TableCell>
                  <TableCell align="center">
                    {row.isProven && <CheckBoxIcon color="success" />}
                    {!row.isProven && !row?.error && <CloseIcon style={{ color: 'red' }} />}
                    {!!row?.error && 'read error'}
                  </TableCell>
                  <TableCell align="center">
                    {row.isFinalized && <CheckBoxIcon color="success" />}
                    {(!row.isFinalized && row.isProven && !row?.error) && (
                      <LoadingButton variant="contained" onClick={(event: any) => {
                        event.preventDefault()
                        showModal(row)
                      }}>
                        Replay
                      </LoadingButton>
                    )}
                    {!row.isFinalized && !row.isProven && !row?.error && (
                      <LoadingButton variant="contained" onClick={(event: any) => {
                        event.preventDefault()
                        showModal(row)
                      }}>
                        Prove
                      </LoadingButton>
                    )}
                    {!!row?.error && 'read error'}
                  </TableCell>
                  <TableCell align="center">
                    {row?.relayStatus?.successful && <CheckBoxIcon color="success" />}
                    {(row?.relayStatus?.failed || !row?.relayStatus?.successful) && <CloseIcon style={{ color: 'red' }}/>}
                    {!!row?.error && 'read error'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {rows?.length > 0 && (
        <Box mt={2} style={{ opacity: 0.5 }}>
          <small>Displaying most recent {max} results</small>
        </Box>
      )}
      <footer className={styles.footer}>
        <div className={styles.footerOptimism}>
          <span>Powered by</span> <a href="https://www.optimism.io/" target="_blank"><Image src="/assets/optimism.svg" alt="" width={135} height={25} /></a></div>
        <div className={styles.footerLinks}>
          <div className={styles.copyright}>© {new Date().getFullYear()}</div>
          <em><a href="https://github.com/buildooor" target="_blank">Built by a buildooooor</a></em>
        </div>
      </footer>
      <CustomModal props={{
        web3,
        replayItem,
        setReplayItem,
        l1ChainId
      }} />
    </main>
  )
}

function CustomModal ({props}: any) {
  const { web3, replayItem, setReplayItem, l1ChainId } = props
  const { address, connectWallet, getSignerOrRequestWallet, checkConnectedNetworkIdOrThrow } = web3
  const [gasLimit, setGasLimit] = useState<any>('')
  const [error, setError] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const prove = !replayItem?.isProven && !replayItem?.isFinalized

  useEffect(() => {
    if (replayItem?.gasLimit) {
      setGasLimit(replayItem.gasLimit)
    }
  }, [replayItem?.gasLimit])

  if (!replayItem) {
    return null
  }

  function handleModalClose () {
    setReplayItem(null)
    setError(null)
    setSending(false)
    setGasLimit('')
  }

  async function handleSubmit (event: any) {
    event.preventDefault()

    try {
      setError(null)
      setSending(true)
      await replayMessage({
        l1ChainId,
        gasLimit,
        fromChain: replayItem?.fromChain,
        originTxHash: replayItem.originTxHash,
        prove,
        getSignerOrRequestWallet,
        checkConnectedNetworkIdOrThrow
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    }
    setSending(false)
  }

  return (
    <Modal
      component="div"
      open={true}
      onClose={() => handleModalClose( )}
    >
      <Box sx={{
        position: 'absolute' as 'absolute',
        top: '50%',
        left: '50%',
        maxWidth: '700px',
        transform: 'translate(-50%, -50%)',
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        border: '0',
        borderRadius: '1rem'
        }}>
        <Box mb={4}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            {prove ? 'Prove Transaction' : 'Replay Transaction'}
          </Typography>
        </Box>
        <Box style={{
            position: 'absolute',
            top: '0',
            right: '0',
            padding: '1rem',
            cursor: 'pointer'
          }}>
          <CloseIcon onClick={() => handleModalClose()}/>
        </Box>
        <Box>
          <form onSubmit={handleSubmit}>
            <Box mb={1}>
              <Typography variant="body1">
                Direction:
              </Typography>
              <Typography variant="body1">
                {replayItem.direction}
              </Typography>
            </Box>
            <Box mb={1}>
              <Typography variant="body1">
              Origin tx hash:
              </Typography>
              <Typography variant="body1">
                {replayItem.originTxHash}
              </Typography>
            </Box>
            <Box mb={4}>
              <Typography variant="body1">
                Message hash:
              </Typography>
              <Typography variant="body1">
                {replayItem.msgHash}
              </Typography>
            </Box>
            {!prove && (
              <Box mb={2}>
                <Typography variant="body1" gutterBottom>
                  New gas limit (required)
                </Typography>
                <TextField
                  value={gasLimit}
                  placeholder={'500000'}
                  onChange={(event: any) => setGasLimit(event.target.value)}
                />
              </Box>
            )}
            <Box display="flex" gap="1rem">
              {!address && <LoadingButton variant="contained" onClick={() => connectWallet()}>Connect Wallet</LoadingButton>}
              <LoadingButton disabled={!address} loading={sending} variant="contained" type="submit">{prove ? 'Prove transaction' : 'Replay transaction'}</LoadingButton>
              <LoadingButton onClick={() => handleModalClose()}>Cancel</LoadingButton>
            </Box>
            <Box mt={4} style={{ width: '100%' }}>
              {error && (
                <Alert severity="error">{error}</Alert>
              )}
            </Box>
          </form>
        </Box>
      </Box>
    </Modal>
  )
}

export default function Home() {
  const queryClient = new QueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <Main />
    </QueryClientProvider>
  )
}
