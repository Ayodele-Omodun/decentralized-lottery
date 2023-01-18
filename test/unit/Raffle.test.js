const { network, deployments, getNamedAccounts, ethers } = require("hardhat")
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit test", () => {
    let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async () => {
      deployer = (await getNamedAccounts()).deployer
      await deployments.fixture(["all"])
      raffle = await ethers.getContract("Raffle", deployer)
      vrfCoordinatorV2Mock = await ethers.getContract(
        "VRFCoordinatorV2Mock",
        deployer
      )
      raffleEntranceFee = await raffle.getAmount()
      interval = await raffle.getInterval()
    })

    describe("constructor", () => {
      it("innitializes the raffle correctly", async () => {
        const raffleState = await raffle.getRaffleState()
        const callBackGasLimit = await raffle.getCallBackGasLimit()
        const entranceFee = await raffle.getAmount()
        const gasLane = await raffle.getGasLane()

        assert.equal(raffleState.toString(), "0")
        assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        assert.equal(
          callBackGasLimit.toString(),
          networkConfig[chainId]["callBackGasLimit"]
        )
        assert.equal(
          entranceFee.toString(),
          networkConfig[chainId]["entranceFee"]
        )
        assert.equal(gasLane.toString(), networkConfig[chainId]["gasLane"])
      })
    })

    describe("EnterRaffle", () => {
      it("reverts when you don't pay enough", async () => {
        await expect(raffle.enterRaffle()).to.be.reverted
      })

      it("records players when they enter", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        const playerFromArray = await raffle.getPlayer(0)
        assert.equal(playerFromArray, deployer)
      })

      it("emits event on enter", async () => {
        await expect(
          raffle.enterRaffle({ value: raffleEntranceFee })
        ).to.emit(raffle, "RaffleEnter")
      })
    })

    describe("checkUpKeep", () => {

      it("returns false if people haven't sent any eth", async () => {
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
        assert.equal(upKeepNeeded, false)
      })




      it("returns false if enough time hasn't passed", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
        assert.equal(upKeepNeeded, false)
      })

      it("returns true if enough time has passed, has players, eth and is open", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.request({ method: "evm_mine", params: [] })
        const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
        assert.equal(upKeepNeeded, true)
      })
    })

    describe("performUpKeep", () => {
      it("only runs if checkUpKeep returns true", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const tx = await raffle.performUpkeep([])
        assert(tx)
      })

      it("reverts when checkUpkeep is false", async () => {
        await expect(raffle.performUpkeep([])).to.be.reverted
      })

      it("updates the raffle state", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const tx = await raffle.performUpkeep([])
        const raffleState = await raffle.getRaffleState()
        assert.equal(raffleState.toString(), "1")
      })

      it("emits an event", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        expect(raffle.performUpkeep([])).to.emit("RequestedRaffleWinner")
      })
    })

    describe("fufillRandomWords", () => {
      beforeEach(async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
      })

      it("can only be called after performUpkeep", async () => {
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.reverted
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.reverted
      })

      it("picks a winner, reset the lottery and send money", async () => {
        const additionalEntrants = 3
        const startingIndex = 1
        const accounts = await ethers.getSigners()

        for (i = startingIndex; i < startingIndex + additionalEntrants; i++) {
          const accountsConnectedToRaffle = raffle.connect(accounts[i])
          await accountsConnectedToRaffle.enterRaffle({ value: raffleEntranceFee })
        }
        const startingTimeStamp = await raffle.getLatestTimeStamp()

        await new Promise(async (resolve, reject) => {
          raffle.once("WinnerPicked", async () => {
            try {
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              const numberOfPlayers = await raffle.getNumberOfPlayers()
              const endingTimeStamp = await raffle.getLatestTimeStamp()
              const winnerFinalBalance = await accounts[1].getBalance()

// use the block of code to check for the winner if there are changes
/*            console.log(recentWinner)
              console.log(accounts[0].address)
              console.log(accounts[1].address)
              console.log(accounts[2].address)
              console.log(accounts[3].address) */


              assert(numberOfPlayers.toString() == 0)
              assert(raffleState == 0)
              assert(endingTimeStamp > startingTimeStamp)
              assert.equal(winnerFinalBalance.toString(), winnerStartingBal.add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee)).toString())
            } catch (e) {
              reject(e)
            }
            resolve()
          })
          const tx = await raffle.performUpkeep([])
          const txReceipt = await tx.wait(1)
          const winnerStartingBal = await accounts[1].getBalance()
          vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)
        })
      })
    })
  })
