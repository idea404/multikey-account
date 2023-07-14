import { utils, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import dotenv from "dotenv";

const FACTORY_CONTRACT_NAME = "AAFactory";
const MULTISIG_CONTRACT_NAME = "MultiUserMultisig";

const PRIVATE_KEY: any = dotenv.config().parsed?.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

export default async function (hre: HardhatRuntimeEnvironment) {
  // Private key of the account used to deploy
  const wallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, wallet);
  const factoryArtifact = await deployer.loadArtifact(FACTORY_CONTRACT_NAME);
  const accountArtifact = await deployer.loadArtifact(MULTISIG_CONTRACT_NAME);

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

  const factory = await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [
    // Since the factory requires the code of the multisig to be available,
    // we should pass it here as well.
    accountArtifact.bytecode,
  ]);

  console.log(`AA factory address: ${factory.address}`);
}
