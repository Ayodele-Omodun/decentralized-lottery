// Requirements to run the staging test
/*  1. Get subId from chainlink VRF
 2. Deploy the contract using the subId
 3. Register the contract with chainlink VRF and it's subId
 4. Register the contract with chainlink keepers
 5. Then, you can run the test
 */

const { network, deployments, getNamedAccounts, ethers } = require("hardhat")
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit test", () => {
    let raffle, raffleEntranceFee, deployer

    beforeEach(async () => {
      deployer = (await getNamedAccounts()).deployer
      raffle = await ethers.getContract("Raffle", deployer)
      raffleEntranceFee = await raffle.getAmount()
    })

    describe("fulfillRandomWords", () => {
        it("works with chainlink keepers and chainlink VRF, we get a random winner", async () => {
            const startingTimeStamp = await raffle.getLatestTimeStamp()
            const accounts = await ethers.getSigners()

            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    try{
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const raffleState  = await raffle.getRaffleState()
                        const numberOfPlayers = await raffle.getNumberOfPlayers()
                        const endingTimeStamp = await raffle.getLatestTimeStamp()
                        const recentWinner = await raffle.getRecentWinner()

                        assert(numberOfPlayers == 0)
                        assert(raffleState == 0)
                        assert(recentWinner.toString() == accounts[0].address)
                        assert.equal(winnerEndingBalance, winnerEndingBalance.add(raffleEntranceFee).toString())
                        assert(endingTimeStamp > startingTimeStamp)

                        resolve()
                    }catch(error) {
                        reject(error)
                    }
                    await raffle.enterRaffle({value: raffleEntranceFee})
                    const winnerStartingBal = await accounts[0].getBalance()
                })
            })
        })
    })
})