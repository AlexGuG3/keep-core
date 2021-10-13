import { waffle } from "hardhat"
import { testModUtilsDeployment } from "./fixtures"
import type { TestModUtils } from "../typechain"

describe("ModUtils", () => {
  let testModUtils: TestModUtils

  beforeEach("load test fixture", async function () {
    const contracts = await waffle.loadFixture(testModUtilsDeployment)

    testModUtils = contracts.testModUtils as TestModUtils
  })

  it("runModExponentTest()", async () => {
    await testModUtils.runModExponentTest()
  })

  it("runLegendreRangeTest()", async () => {
    await testModUtils.runLegendreRangeTest()
  })

  it("runLegendreListTest()", async () => {
    await testModUtils.runLegendreListTest()
  })

  it("runModSqrtOf0Test()", async () => {
    await testModUtils.runModSqrtOf0Test()
  })

  it("runModSqrtMultipleOfPTest()", async () => {
    await testModUtils.runModSqrtMultipleOfPTest()
  })

  it("runModSqrtAgainstListTest()", async () => {
    await testModUtils.runModSqrtAgainstListTest()
  })

  it("runModSqrtAgainstNonSquaresTest()", async () => {
    await testModUtils.runModSqrtAgainstNonSquaresTest()
  })

  it("runModSqrtALessThanPTest()", async () => {
    await testModUtils.runModSqrtALessThanPTest()
  })

  it("runModSqrtAGreaterThanPTest()", async () => {
    await testModUtils.runModSqrtAGreaterThanPTest()
  })
})
