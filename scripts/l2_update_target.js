const { providers, Wallet } = require('ethers')
const ethers = require('ethers')
const fs = require('fs')

async function main() {
  const config_file = "./configs/goerli.json"
  const configs = JSON.parse(fs.readFileSync(config_file).toString())
  const ABI = JSON.parse(fs.readFileSync('./artifacts/contracts/arbitrum/GreeterL2.sol/GreeterL2.json').toString())
  // Init L2 contract
  const l2Provider = new providers.JsonRpcProvider(configs.l2_provider)
  const l2Wallet = new Wallet(configs.owner_key, l2Provider)
  const contract = new ethers.Contract(configs.l2_contract_address, ABI.abi, l2Wallet)
  console.log('Updating L2 target..')
  const updateL2Tx = await contract.updateL1Target(configs.l1_contract_address)
  console.log("Target updating at:", updateL2Tx.hash)
  await updateL2Tx.wait()
  console.log("Done.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
