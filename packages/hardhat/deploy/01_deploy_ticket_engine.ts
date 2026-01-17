import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployTicketEngine: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("TicketEngine", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("TicketEngine deployed!");
};

export default deployTicketEngine;

deployTicketEngine.tags = ["TicketEngine"];
