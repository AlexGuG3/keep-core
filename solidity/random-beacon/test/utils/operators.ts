/* eslint-disable no-await-in-loop */

import { ethers } from "hardhat"

import { params } from "../fixtures"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { BigNumber, BigNumberish } from "ethers"
import type {
  RandomBeacon,
  RandomBeaconStub,
  T,
  TokenStaking,
} from "../../typechain"

export type OperatorID = number
export type Operator = { id: OperatorID; signer: SignerWithAddress }

export async function registerOperators(
  randomBeacon: RandomBeacon,
  t: T,
  numberOfOperators: number,
  unnamedSignersOffset = 0,
  stakeAmount: BigNumber = params.minimumAuthorization
): Promise<Operator[]> {
  const operators: Operator[] = []

  const sortitionPool = await ethers.getContractAt(
    "SortitionPool",
    await randomBeacon.sortitionPool()
  )

  const staking: TokenStaking = await ethers.getContractAt(
    "TokenStaking",
    await randomBeacon.staking()
  )

  const signers = (await ethers.getUnnamedSigners()).slice(unnamedSignersOffset)

  for (let i = 0; i < numberOfOperators; i++) {
    const owner: SignerWithAddress = signers[i]
    const stakingProvider: SignerWithAddress =
      signers[1 * numberOfOperators + i]
    const operator: SignerWithAddress = signers[2 * numberOfOperators + i]
    const beneficiary: SignerWithAddress = signers[3 * numberOfOperators + i]
    const authorizer: SignerWithAddress = signers[4 * numberOfOperators + i]

    await stake(
      t,
      staking,
      randomBeacon,
      owner,
      stakingProvider,
      stakeAmount,
      beneficiary,
      authorizer
    )

    await randomBeacon
      .connect(stakingProvider)
      .registerOperator(operator.address)

    await randomBeacon.connect(operator).joinSortitionPool()

    const id = await sortitionPool.getOperatorID(await operator.getAddress())

    operators.push({ id, signer: operator })
  }

  return operators
}

export async function stake(
  t: T,
  staking: TokenStaking,
  randomBeacon: RandomBeacon | RandomBeaconStub,
  owner: SignerWithAddress,
  stakingProvider: SignerWithAddress,
  stakeAmount: BigNumberish,
  beneficiary = stakingProvider,
  authorizer = stakingProvider
): Promise<void> {
  const deployer: SignerWithAddress = await ethers.getNamedSigner("deployer")

  await t.connect(deployer).mint(owner.address, stakeAmount)
  await t.connect(owner).approve(staking.address, stakeAmount)

  await staking
    .connect(owner)
    .stake(
      stakingProvider.address,
      beneficiary.address,
      authorizer.address,
      stakeAmount
    )

  await staking
    .connect(authorizer)
    .increaseAuthorization(
      stakingProvider.address,
      randomBeacon.address,
      stakeAmount
    )
}
