const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Retrieve the saved contract address from the previous deployment script
  const { usdcAddress } = await deployments.get("FakeUSDC");

  console.log("Deploying Verifier contract with the account:", deployer.address);

//   const Verifier = await ethers.getContractFactory("Verifier");
//   const verifier = await Verifier.deploy();

  // console.log("Verifier contract deployed to address:", verifier.address);

  const verifier = "";
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

  const Ramp = await ethers.getContractFactory("Ramp");
  const ramp = await Ramp.deploy(venmoRsaKey, verifier, usdcAddress);

  console.log("Ramp contract deployed to address:", ramp.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
