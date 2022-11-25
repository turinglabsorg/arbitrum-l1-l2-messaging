const { providers, Wallet } = require('ethers')
const hre = require('hardhat')
const ethers = require('ethers')
const fs = require('fs');
const {
  EthBridger,
  getL2Network,
} = require('@arbitrum/sdk')

async function main() {
  const config_file = "./configs/goerli.json"
  const configs = JSON.parse(fs.readFileSync(config_file).toString())
  // Init L1 provider
  const l1Provider = new providers.JsonRpcProvider(configs.l1_provider)
  const l1Wallet = new Wallet(configs.owner_key, l1Provider)
  // Init L2 provider
  const l2Provider = new providers.JsonRpcProvider(configs.l2_provider)
  const l2Network = await getL2Network(l2Provider)
  const ethBridger = new EthBridger(l2Network)
  const inboxAddress = ethBridger.l2Network.ethBridge.inbox
  console.log("Inbox address is:", inboxAddress)
  // Deploy as usual
  console.log('Deploying contract on L1..')
  const Contract = await (
    await hre.ethers.getContractFactory('GreeterL1')
  ).connect(l1Wallet)
  const contract = await Contract.deploy(
    'Hello world in L1',
    ethers.constants.AddressZero,
    inboxAddress
  );
  console.log('Deploy transaction is: ' + contract.deployTransaction.hash)
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
  configs.l1_contract_address = contract.address
  fs.writeFileSync(config_file, JSON.stringify(configs, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
