/* eslint-disable no-await-in-loop */

import { ethers, waffle, helpers } from "hardhat"
import { expect } from "chai"

import {
  constants,
  dkgState,
  params,
  randomBeaconDeployment,
} from "../fixtures"
import {
  genesis,
  signAndSubmitCorrectDkgResult,
  noMisbehaved,
} from "../utils/dkg"
import blsData from "../data/bls"
import { registerOperators } from "../utils/operators"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { RandomBeacon, RandomBeaconStub, T } from "../../typechain"

const ZERO_ADDRESS = ethers.constants.AddressZero

const { mineBlocks, mineBlocksTo } = helpers.time
const { keccak256 } = ethers.utils

const fixture = async () => {
  const contracts = await randomBeaconDeployment()

  // Accounts offset provided to slice getUnnamedSigners have to include number
  // of unnamed accounts that were already used.
  await registerOperators(
    contracts.randomBeacon as RandomBeacon,
    contracts.t as T,
    constants.groupSize,
    1
  )

  const randomBeacon = contracts.randomBeacon as RandomBeaconStub & RandomBeacon
  const t = contracts.t as T

  return {
    randomBeacon,
    t,
  }
}

// End to end test case validating the random beacon generation. This test case
// starts from the genesis call which seeds the initial value (pi) and creates a
// new signing group. The next steps call the random beacon relay requests and
// validate the results of the submitted signatures. At the end of this scenario
// 3 active groups should be added to the chain as a result of signatures submission
// and dkg under the hood. All the init params map 1:1 real params set in the
// RandomBeacon constructor.
// Signatures in bls.ts were generated outside of this test based on bls_test.go
describe("System -- e2e", () => {
  // same as in RandomBeacon constructor
  const relayEntryHardTimeout = 5760
  const relayEntrySoftTimeout = 20
  const callbackGasLimit = 56000
  const groupCreationFrequency = 5
  const groupLifetime = 403200
  const groupPubKeys = [
    blsData.groupPubKey,
    blsData.groupPubKey2,
    blsData.groupPubKey3,
  ]

  let randomBeacon: RandomBeacon
  let t: T
  let requester: SignerWithAddress
  let owner: SignerWithAddress

  before(async () => {
    const contracts = await waffle.loadFixture(fixture)

    owner = await ethers.getNamedSigner("deployer")
    ;[requester] = await ethers.getUnnamedSigners()
    randomBeacon = contracts.randomBeacon
    t = contracts.t

    await randomBeacon
      .connect(owner)
      .updateRelayEntryParameters(
        relayEntrySoftTimeout,
        relayEntryHardTimeout,
        callbackGasLimit
      )

    await randomBeacon.connect(owner).updateGroupCreationParameters(
      groupCreationFrequency,
      groupLifetime,
      10, // dkgResultChallengePeriodLength, does not matter for this test
      5, // dkgResultSubmissionTimeout, does not matter for this test
      1 // dkgSubmitterPrecedencePeriodLength, does not matter for this test
    )

    await randomBeacon
      .connect(owner)
      .setRequesterAuthorization(requester.address, true)
  })

  context("when testing a happy path with 15 relay requests", () => {
    let groupPubKeyCounter = 0
    const groupMembers = []

    it("should create 3 new groups", async () => {
      expect(await randomBeacon.getGroupCreationState()).to.be.equal(
        dkgState.IDLE
      )

      const [genesisTx, genesisSeed] = await genesis(randomBeacon)

      expect(await randomBeacon.getGroupCreationState()).to.be.equal(
        dkgState.KEY_GENERATION
      )

      // pass key generation state and transition to awaiting result state
      await mineBlocksTo(genesisTx.blockNumber + constants.offchainDkgTime + 1)

      expect(await randomBeacon.getGroupCreationState()).to.be.equal(
        dkgState.AWAITING_RESULT
      )

      let dkgResult = await signAndSubmitCorrectDkgResult(
        randomBeacon,
        groupPubKeys[groupPubKeyCounter],
        genesisSeed,
        genesisTx.blockNumber,
        noMisbehaved
      )
      groupMembers.push(dkgResult.members)

      await mineBlocks(params.dkgResultChallengePeriodLength)

      expect(await randomBeacon.getGroupCreationState()).to.be.equal(
        dkgState.CHALLENGE
      )

      await randomBeacon
        .connect(dkgResult.submitter)
        .approveDkgResult(dkgResult.dkgResult)

      for (let i = 1; i <= 14; i++) {
        await randomBeacon.connect(requester).requestRelayEntry(ZERO_ADDRESS)

        const txSubmitRelayEntry = await randomBeacon
          .connect(dkgResult.submitter)
          ["submitRelayEntry(bytes)"](blsData.groupSignatures[i - 1])

        // every 5th relay request triggers a new dkg
        if (i % groupCreationFrequency === 0) {
          groupPubKeyCounter += 1
          expect(await randomBeacon.getGroupCreationState()).to.be.equal(
            dkgState.KEY_GENERATION
          )

          await mineBlocksTo(
            txSubmitRelayEntry.blockNumber + constants.offchainDkgTime + 1
          )

          expect(await randomBeacon.getGroupCreationState()).to.be.equal(
            dkgState.AWAITING_RESULT
          )

          dkgResult = await signAndSubmitCorrectDkgResult(
            randomBeacon,
            groupPubKeys[groupPubKeyCounter],
            ethers.BigNumber.from(
              ethers.utils.keccak256(blsData.groupSignatures[i - 1])
            ),
            txSubmitRelayEntry.blockNumber,
            noMisbehaved
          )
          groupMembers.push(dkgResult.members)

          await mineBlocks(params.dkgResultChallengePeriodLength)

          expect(await randomBeacon.getGroupCreationState()).to.be.equal(
            dkgState.CHALLENGE
          )

          await randomBeacon
            .connect(dkgResult.submitter)
            .approveDkgResult(dkgResult.dkgResult)

          expect(await randomBeacon.getGroupCreationState()).to.be.equal(
            dkgState.IDLE
          )
        }
      }

      const groupsRegistry = await randomBeacon.getGroupsRegistry()
      expect(groupsRegistry).to.be.lengthOf(3)
      expect(groupsRegistry[0]).to.deep.equal(keccak256(groupPubKeys[0]))
      expect(groupsRegistry[1]).to.deep.equal(keccak256(groupPubKeys[1]))
      expect(groupsRegistry[2]).to.deep.equal(keccak256(groupPubKeys[2]))
    })
  })
})
