const { developmentChains } = require("../helper-hardhat-config.js")
const { network, ethers } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the premium.
const GAS_PRICE_LINK = 1e9
const args = [BASE_FEE, GAS_PRICE_LINK]

module.exports = async function ({ deployments, getNamedAccounts }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  if (developmentChains.includes(network.name)) {
    log("local network detected! Deploying mocks.......  ")
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    })
    log("Mocks deployed!")
    log("____________________________")
  }
}

module.exports.tags = ["all", "mocks"]
