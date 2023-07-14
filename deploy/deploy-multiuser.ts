import { utils, Wallet, Provider, EIP712Signer, types } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import dotenv from "dotenv";

const AA_FACTORY_ADDRESS = "0x9247EE7f96a42F34436bd098bD1e708027C7Ba1F";
const FACTORY_CONTRACT_NAME = "AAFactory";
const PRIVATE_KEY: any = dotenv.config().parsed?.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("https://testnet.era.zksync.dev");
  // Private key of the account used to deploy
  const wallet = new Wallet(PRIVATE_KEY).connect(provider);
  const owner1 = wallet;
  const factoryArtifact = await hre.artifacts.readArtifact(FACTORY_CONTRACT_NAME);

  const aaFactory = new ethers.Contract(AA_FACTORY_ADDRESS, factoryArtifact.abi, wallet);

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account owned by the address of owner1
  const tx = await aaFactory.deployAccount(salt, owner1.address);
  await tx.wait();

  // Getting the address of the deployed contract account
  // Always use the JS utility methods
  const abiCoder = new ethers.utils.AbiCoder();
  const multisigAddress = utils.create2Address(AA_FACTORY_ADDRESS, await aaFactory.aaBytecodeHash(), salt, abiCoder.encode(["address"], [owner1.address]));
  console.log(`Multisig account deployed on address ${multisigAddress}`);

  console.log("Sending funds to multisig account");
  // Send funds to the multisig account we just deployed
  await (
    await wallet.sendTransaction({
      to: multisigAddress,
      // You can increase the amount of ETH sent to the multisig
      value: ethers.utils.parseEther("0.008"),
    })
  ).wait();

  let multisigBalance = await provider.getBalance(multisigAddress);

  console.log(`Multisig account balance is ${multisigBalance.toString()}`);

  // Transaction to deploy a new account using the multisig we just deployed
  let aaTx = await aaFactory.populateTransaction.deployAccount(
    salt,
    // These are accounts that will own the newly deployed account
    owner1.address,
    {gasLimit: 5000000}
  );

  const gasLimit = await provider.estimateGas(aaTx);
  const gasPrice = await provider.getGasPrice();

  aaTx = {
    ...aaTx,
    // deploy a new account using the multisig
    from: multisigAddress,
    gasLimit: gasLimit,
    gasPrice: gasPrice,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(multisigAddress),
    type: 113,
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,
    value: ethers.BigNumber.from(0),
  };
  const signedTxHash = EIP712Signer.getSignedDigest(aaTx);

  const signature = ethers.utils.concat([
    // Note, that `signMessage` wouldn't work here, since we don't want
    // the signed hash to be prefixed with `\x19Ethereum Signed Message:\n`
    ethers.utils.joinSignature(owner1._signingKey().signDigest(signedTxHash)),
  ]);

  aaTx.customData = {
    ...aaTx.customData,
    customSignature: signature,
  };

  console.log(`The multisig's nonce before the first tx is ${await provider.getTransactionCount(multisigAddress)}`);
  const sentTx = await provider.sendTransaction(utils.serialize(aaTx));
  await sentTx.wait();

  // Checking that the nonce for the account has increased
  console.log(`The multisig's nonce after the first tx is ${await provider.getTransactionCount(multisigAddress)}`);

  multisigBalance = await provider.getBalance(multisigAddress);

  console.log(`Multisig account balance is now ${multisigBalance.toString()}`);
}
