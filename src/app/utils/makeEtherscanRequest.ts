import wait from 'wait'

export async function makeEtherscanRequest(url: string) {
  const maxRetries = 5
  let retries = 0
  while (true) {
    try {
      return await attemptRequest(url)
    } catch (err: any) {
      if (!err.message.includes('Max rate limit reached')) {
        throw err
      }
      retries++
      if (retries > maxRetries) {
        throw err
      }
      console.log('retrying', retries)
      await wait(5 * 1000)
    }
  }
}

async function attemptRequest(url: string) {
  console.log(url)
  const res = await fetch(url)
  const json = await res.json()
  if (json.status === '0') {
    throw new Error(`${json.message}: ${json.result?.toString()}`)
  }
  const result = json.result
  return result
}
