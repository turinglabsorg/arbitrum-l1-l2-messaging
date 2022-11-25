const { providers, Wallet } = require('ethers')
const ethers = require('ethers')
const fs = require('fs')
const {
  L1TransactionReceipt,
  L1ToL2MessageStatus,
  EthBridger,
  getL2Network,
} = require('@arbitrum/sdk')
const { hexDataLength } = require('@ethersproject/bytes')
const {
  L1ToL2MessageGasEstimator,
} = require('@arbitrum/sdk/dist/lib/message/L1ToL2MessageGasEstimator')

async function main() {
  const config_file = "./configs/goerli.json"
  const configs = JSON.parse(fs.readFileSync(config_file).toString())

  // Init L2 provider
  const l2Provider = new providers.JsonRpcProvider(configs.l2_provider)
  const l2Wallet = new Wallet(configs.owner_key, l2Provider)

  // Init L1 contract
  const l1Provider = new providers.JsonRpcProvider(configs.l1_provider)
  const l1Wallet = new Wallet(configs.owner_key, l1Provider)
  console.log('Setting new greeting from L1..')

  const newGreeting = 'Greeting from far, far away'
  const newGreetingBytes = ethers.utils.defaultAbiCoder.encode(
    ['string'],
    [newGreeting]
  )
  const newGreetingBytesLength = hexDataLength(newGreetingBytes) + 4
  console.log("New greeting bytes length:", newGreetingBytesLength)
  // Calculating needed gas on L2
  const l1ToL2MessageGasEstimate = new L1ToL2MessageGasEstimator(l2Provider)
  const _submissionPriceWei =
    await l1ToL2MessageGasEstimate.estimateSubmissionFee(
      l1Provider,
      await l1Provider.getGasPrice(),
      newGreetingBytesLength
    )

  console.log(`Current retryable base submission price: ${_submissionPriceWei.toString()}`)
  const submissionPriceWei = _submissionPriceWei.mul(5)
  console.log("Effective submission price:", submissionPriceWei.toString())
  // Calculating calldata
  const ABI = ['function setGreeting(string _greeting)']
  const iface = new ethers.utils.Interface(ABI)
  const calldata = iface.encodeFunctionData('setGreeting', [newGreeting])
  const maxGas = await l1ToL2MessageGasEstimate.estimateRetryableTicketGasLimit(
    {
      from: configs.l1_contract_address,
      to: configs.l2_contract_address,
      l2CallValue: 0,
      excessFeeRefundAddress: await l2Wallet.address,
      callValueRefundAddress: await l2Wallet.address,
      data: calldata,
    },
    ethers.utils.parseEther('1')
  )
  console.log("CallData:", calldata)
  console.log("Max gas:", maxGas.toString())
  // Calculating final amount we need to send L1 to L2 message
  const gasPriceBid = await l2Provider.getGasPrice()
  console.log(`L2 gas price: ${gasPriceBid.toString()}`)
  const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas))
  console.log(`Sending greeting to L2 with ${callValue.toString()} callValue for L2 fees..`)

  // Finally send transaction
  const l1ABI = JSON.parse(fs.readFileSync('./artifacts/contracts/ethereum/GreeterL1.sol/GreeterL1.json').toString())
  const contract = new ethers.Contract(configs.l1_contract_address, l1ABI.abi, l1Wallet)
  const setGreetingTx = await contract.setGreetingInL2(
    newGreeting, // string memory _greeting,
    submissionPriceWei,
    maxGas,
    gasPriceBid,
    {
      value: callValue,
    }
  )
  console.log("Waiting at:", setGreetingTx.hash)
  const setGreetingRec = await setGreetingTx.wait()
  console.log(`Greeting txn confirmed on L1! 🙌`)
  const l1TxReceipt = new L1TransactionReceipt(setGreetingRec)
  console.log("Receipt:", l1TxReceipt)
  // Wait for receipt
  const messages = await l1TxReceipt.getL1ToL2Messages(l2Wallet)
  const message = messages[0]
  console.log('Waiting for L2 side. It may take 10-15 minutes ⏰⏰')
  const messageResult = await message.waitForStatus()
  const status = messageResult.status
  if (status === L1ToL2MessageStatus.REDEEMED) {
    console.log(
      `L2 retryable txn executed 🥳 ${messageResult.l2TxReceipt.transactionHash}`
    )
  } else {
    console.log(
      `L2 retryable txn failed with status ${L1ToL2MessageStatus[status]}`
    )
  }

  console.log("Done.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
