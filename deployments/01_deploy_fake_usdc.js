const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Fake USDC contract with the account:", deployer.address);

  const FakeUSDC = await ethers.getContractFactory("FakeUSDC");
  const fakeUSDC = await FakeUSDC.deploy("Fake USDC", "fUSDC", 10000000000000);

  console.log("FakeUSDC contract deployed to address:", fakeUSDC.address);

    // Save the contract address to be used in the next deployment script
    await deployments.save("FakeUSDC", {
        address: fakeUSDC.address
    });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
