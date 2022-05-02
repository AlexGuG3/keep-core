import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import type { ProxyAdmin } from "../typechain"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, getNamedAccounts, upgrades, deployments } = hre
  const { deployer, dao, esdm } = await getNamedAccounts()

  const WalletRegistryProxyAdminWithDeputy = await deployments.deploy(
    "WalletRegistryProxyAdminWithDeputy",
    {
      contract: "ProxyAdminWithDeputy",
      from: deployer,
      args: [dao, esdm],
      log: true,
    }
  )

  const WalletRegistry = await deployments.get("WalletRegistry")

  const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

  await proxyAdmin
    .connect(await ethers.getSigner(esdm))
    .changeProxyAdmin(
      WalletRegistry.address,
      WalletRegistryProxyAdminWithDeputy.address
    )
}

export default func

func.tags = ["WalletRegistryProxyAdminWithDeputy"]
func.dependencies = ["WalletRegistry"]

// For now we skip this script as DAO is not yet established.
func.skip = async () => true