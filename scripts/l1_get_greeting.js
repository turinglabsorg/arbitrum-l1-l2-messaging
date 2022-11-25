const { providers, Wallet } = require('ethers')
const ethers = require('ethers')
const fs = require('fs')

async function main() {
  const config_file = "./configs/goerli.json"
  const configs = JSON.parse(fs.readFileSync(config_file).toString())
  const ABI = JSON.parse(fs.readFileSync('./artifacts/contracts/ethereum/GreeterL1.sol/GreeterL1.json').toString())
  // Init L1 contract
  const l1Provider = new providers.JsonRpcProvider(configs.l1_provider)
  const l1Wallet = new Wallet(configs.owner_key, l1Provider)
  const contract = new ethers.Contract(configs.l1_contract_address, ABI.abi, l1Wallet)
  console.log('Reading L1 greeting..')
  const greet = await contract.greet()
  console.log("Current value is:", greet)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
