import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const RandomBeacon = await deployments.get("RandomBeacon")

  const GOVERNANCE_DELAY = 604_800 // 1 week

  const RandomBeaconGovernance = await deployments.deploy(
    "RandomBeaconGovernance",
    {
      from: deployer,
      args: [RandomBeacon.address, GOVERNANCE_DELAY],
      log: true,
    }
  )

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "RandomBeaconGovernance",
      address: RandomBeaconGovernance.address,
    })
  }
}

export default func

func.tags = ["RandomBeaconGovernance"]
func.dependencies = ["RandomBeacon"]
