const hre = require("hardhat");
const { BigNumber } = hre.ethers;

const ONE_GWEI = BigNumber.from(1000000000);

async function main() {
  const feeData = await hre.ethers.provider.getFeeData();
  const deployGasConfig = {
    gasPrice: feeData.gasPrice.add(ONE_GWEI.mul(3)),
  }

  console.log(feeData, deployGasConfig);
  const [deployer] = await hre.ethers.getSigners();

  // console.log("Deploying Fake USDC contract with the account:", deployer.address);

  // const FakeUSDC = await hre.ethers.getContractFactory("FakeUSDC");
  // const fakeUSDC = await FakeUSDC.deploy("Fake USDC", "fUSDC", 10000000000000, deployGasConfig);

  // console.log("FakeUSDC contract deployed to address:", fakeUSDC.address);

  const fakeUSDCAddress = "0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70";
  const venmoRsaKey = [
    "683441457792668103047675496834917209",
    "1011953822609495209329257792734700899",
    "1263501452160533074361275552572837806",
    "2083482795601873989011209904125056704",
    "642486996853901942772546774764252018",
    "1463330014555221455251438998802111943",
    "2411895850618892594706497264082911185",
    "520305634984671803945830034917965905",
    "47421696716332554",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0"
  ];

  console.log("Deploying Ramp contract with the account:", deployer.address);

  const Ramp = await hre.ethers.getContractFactory("Ramp");
  const ramp = await Ramp.deploy(venmoRsaKey, fakeUSDCAddress, deployGasConfig);

  console.log("Ramp contract deployed to address:", ramp.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
