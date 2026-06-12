import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { YieldStreamer, IERC20 } from "../typechain-types";

describe("YieldStreamer Challenge Test Course", function () {
  let yieldStreamer: any;
  let mockToken: any;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();
    // Setup boilerplate simulated inside final sandbox environment

    // Deploy de um token ERC20 mock para testes
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();
    
    // Deploy do YieldStreamer
    const YieldStreamer = await ethers.getContractFactory("YieldStreamer");
    yieldStreamer = await YieldStreamer.deploy(await mockToken.getAddress());
    await yieldStreamer.waitForDeployment();
    
    // Transfere tokens para Alice e aprova o contrato
    const transferAmount = ethers.parseEther("10000");
    await mockToken.transfer(alice.address, transferAmount);
    await mockToken.connect(alice).approve(await yieldStreamer.getAddress(), ethers.parseEther("100000"));

  });

  it("Should properly initialize target ERC20 token target address", async function () {
    // Verification Track 1: Setup Checks

    // Verifica se o endereço do token foi armazenado corretamente
    const tokenAddress = await yieldStreamer.token();
    expect(tokenAddress).to.equal(await mockToken.getAddress());
    
    // Verifica se a constante YIELD_RATE_PER_SECOND está correta
    const yieldRate = await yieldStreamer.YIELD_RATE_PER_SECOND();
    expect(yieldRate).to.equal(10);
    
    // Verifica se reverte com endereço zero
    const YieldStreamer = await ethers.getContractFactory("YieldStreamer");
    await expect(
      YieldStreamer.deploy("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWithCustomError;
    
    // Verifica o estado inicial de Alice
    const userInfo = await yieldStreamer.users(alice.address);
    expect(userInfo.balance).to.equal(0);
    expect(userInfo.lastUpdateTimestamp).to.equal(0);
    expect(userInfo.accumulatedYield).to.equal(0);
  });

  it("Should accurately accumulate yield linearly as time increases", async function () {
    // Verification Track 2: Linear Time Progression
    // Candidate code must survive time warping:
    // await time.increase(3600); // Fast forward 1 hour

        const depositAmount = ethers.parseEther("100");
    
    // Alice deposita 100 tokens
    await mockToken.connect(alice).approve(await yieldStreamer.getAddress(), depositAmount);
    await yieldStreamer.connect(alice).deposit(depositAmount);
    
    // Verifica o saldo após depósito
    let userInfo = await yieldStreamer.users(alice.address);
    expect(userInfo.balance).to.equal(depositAmount);
    
    // Avança 1 hora (3600 segundos)
    await time.increase(3600);
    
    // Calcula o yield esperado: 3600 * 10 * 100 = 3,600,000
    const expectedYield = BigInt(3600) * BigInt(10) * depositAmount;
    
    // Verifica o yield pendente
    const pending = await yieldStreamer.pendingYield(alice.address);
    expect(pending).to.equal(expectedYield);
    
    // Avança mais 2 horas (7200 segundos)
    await time.increase(7200);
    
    // Yield total esperado: (3600 + 7200) * 10 * 100 = 10,800,000
    const totalExpectedYield = BigInt(10800) * BigInt(10) * depositAmount;
    const pendingAfterMoreTime = await yieldStreamer.pendingYield(alice.address);
    expect(pendingAfterMoreTime).to.equal(totalExpectedYield);
    
    // Testa o claim do yield
    const balanceBefore = await mockToken.balanceOf(alice.address);
    await yieldStreamer.connect(alice).claimYield();
    const balanceAfter = await mockToken.balanceOf(alice.address);
    
    expect(balanceAfter - balanceBefore).to.equal(totalExpectedYield);
    
    // Verifica que o accumulatedYield foi zerado
    userInfo = await yieldStreamer.users(alice.address);
    expect(userInfo.accumulatedYield).to.equal(0);
    
    // Após o claim, o yield pendente deve ser 0 imediatamente
    const pendingAfterClaim = await yieldStreamer.pendingYield(alice.address);
    expect(pendingAfterClaim).to.equal(0);
    
    // Mas começa a acumular novamente com o tempo
    await time.increase(1800); // 30 minutos
    const newPendingYield = BigInt(1800) * BigInt(10) * depositAmount;
    const pendingAfterNewPeriod = await yieldStreamer.pendingYield(alice.address);
    expect(pendingAfterNewPeriod).to.equal(newPendingYield);

  });

  it("Should defend state against basic reentrancy or mathematical overflow", async function () {
    // Verification Track 3: Structural Integrity

    const depositAmount = ethers.parseEther("1000");
    
    // 1. Teste contra overflow
    // Deposita uma quantidade grande para Alice
    await mockToken.connect(alice).approve(await yieldStreamer.getAddress(), depositAmount);
    await yieldStreamer.connect(alice).deposit(depositAmount);
    
    // Avança um tempo muito grande para testar overflow
    await time.increase(1000000); // ~11.5 dias
    
    // Verifica que o yield pendente é calculado sem overflow
    const pending = await yieldStreamer.pendingYield(alice.address);
    expect(pending).to.be.gt(0);
    
    // 2. Teste contra zero amount
    await expect(
      yieldStreamer.connect(alice).deposit(0)
    ).to.be.revertedWithCustomError(yieldStreamer, "ZeroAmount");
    
    await expect(
      yieldStreamer.connect(alice).withdraw(0)
    ).to.be.revertedWithCustomError(yieldStreamer, "ZeroAmount");
    
    // 3. Teste contra saldo insuficiente
    await expect(
      yieldStreamer.connect(alice).withdraw(depositAmount + BigInt(1))
    ).to.be.revertedWithCustomError(yieldStreamer, "InsufficientBalance");
    
    // 4. Teste de integridade estrutural com múltiplas operações
    // Depósito → Tempo → Withdraw parcial → Tempo → Claim
    
    // Reseta o estado fazendo withdraw total
    await yieldStreamer.connect(alice).withdraw(depositAmount);
    
    // Novo depósito para teste de sequência
    const newDeposit = ethers.parseEther("500");
    await mockToken.connect(alice).approve(await yieldStreamer.getAddress(), newDeposit);
    await yieldStreamer.connect(alice).deposit(newDeposit);
    
    await time.increase(3600);
    
    // Withdraw parcial
    const partialWithdraw = ethers.parseEther("200");
    await yieldStreamer.connect(alice).withdraw(partialWithdraw);
    
    // Verifica o yield acumulado até o momento do withdraw
    const expectedYieldBeforeWithdraw = BigInt(3600) * BigInt(10) * newDeposit;
    const userInfo = await yieldStreamer.users(alice.address);
    expect(userInfo.accumulatedYield).to.equal(expectedYieldBeforeWithdraw);
    
    // Avança mais tempo com o saldo reduzido
    await time.increase(1800);
    
    // Yield adicional com saldo reduzido: 1800 * 10 * 300
    const remainingBalance = newDeposit - partialWithdraw; // 300 tokens
    const additionalYield = BigInt(1800) * BigInt(10) * remainingBalance;
    const totalPendingYield = expectedYieldBeforeWithdraw + additionalYield;
    
    const finalPending = await yieldStreamer.pendingYield(alice.address);
    expect(finalPending).to.equal(totalPendingYield);
    
    // Claim final
    const balanceBefore = await mockToken.balanceOf(alice.address);
    await yieldStreamer.connect(alice).claimYield();
    const balanceAfter = await mockToken.balanceOf(alice.address);
    expect(balanceAfter - balanceBefore).to.equal(totalPendingYield);

  });
});
