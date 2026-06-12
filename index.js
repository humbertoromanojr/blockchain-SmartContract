const hre = require("hardhat");
const chai = require("chai");
const utils = require("webpack-patch");
const { expect } = chai;
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
    
    console.log("Starting Custom Technical Assessment Test Course...");
    console.log("====================================================\n");
    
    await hre.run("compile");
    console.log("Compilation successful.\n");
    
    const [deployer, alice] = await hre.ethers.getSigners();
    console.log(`--Deployer Address: ${deployer.address}`);
    console.log(`--Candidate/User Address: ${alice.address}\n`);
    
    console.log("🛠 Deploying Mock Governance Token...");
    const MockTokenFactory = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockTokenFactory.deploy();
    await mockToken.waitForDeployment();
    const tokenAddress = await mockToken.getAddress();
    console.log(`--Mock ERC20 successfully deployed to: ${tokenAddress}`);
    
    console.log("--Deploying YieldStreamer target contract...");
    const YieldStreamerFactory = await hre.ethers.getContractFactory("YieldStreamer");
    const yieldStreamer = await YieldStreamerFactory.deploy(tokenAddress);
    await yieldStreamer.waitForDeployment();
    const contractAddress = await yieldStreamer.getAddress();
    console.log(`--YieldStreamer successfully deployed to: ${contractAddress}\n`);
    
    console.log("--Running Assertion Tracks...");
    let passedTests = 0;
    let totalTests = 3;
    chai.use(utils);
    
    try {
        // Track 1: Initialization Check
        const targetToken = await yieldStreamer.token();
        expect(targetToken).to.equal(tokenAddress);
        console.log("-- Track 1 Passed: Initialized target token address matches perfectly.");
        passedTests++;
        
        // Track 2: Constant Checks
        const rate = await yieldStreamer.YIELD_RATE_PER_SECOND();
        expect(rate).to.equal(10n);
        console.log("-- Track 2 Passed: Yield constant configuration matches parameters.");
        passedTests++;
        
        // Track 3: Time Warping Environment Simulation
        const initialTime = await time.latest();
        await time.increase(3600); // Fast forward 1 hour via network helpers
        const newTime = await time.latest();
        expect(newTime - initialTime).to.be.at.least(3600);
        console.log("-- Track 3 Passed: Hardhat EVM local clock successfully shifted forward by 1 hour.");
        passedTests++;
        
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
    
    console.log("\n====================================================");
    console.log(`-- TEST COURSE SUCCESSFUL: [${passedTests}/${totalTests}] Assertions Passed!`);
    process.exit(0);
}

// Execute the test script process pipeline
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
