const delegateStakeFromGrant = require('../helpers/delegateStakeFromGrant')
const {contract, accounts, web3} = require("@openzeppelin/test-environment")
const {expectRevert, time} = require("@openzeppelin/test-helpers")
const grantTokens = require('../helpers/grantTokens');
const { createSnapshot, restoreSnapshot } = require('../helpers/snapshot');

const BN = web3.utils.BN
const chai = require('chai')
chai.use(require('bn-chai')(BN))
const expect = chai.expect

const KeepToken = contract.fromArtifact('KeepToken');
const TokenStaking = contract.fromArtifact('TokenStaking');
const TokenGrant = contract.fromArtifact('TokenGrant');
const Registry = contract.fromArtifact("Registry");
const PermissiveStakingPolicy = contract.fromArtifact('PermissiveStakingPolicy');

describe('TokenGrant/Withdraw', function() {

  let tokenContract, registryContract, grantContract, stakingContract, permissivePolicy;

  const tokenOwner = accounts[0],
    grantee = accounts[1],
    operatorOne = accounts[2],
    magpie = accounts[4],
    authorizer = accounts[5];

  let grantId, grantStart, grantAmount;

  const grantRevocable = false;
  const grantDuration = time.duration.seconds(60);
  const grantCliff = time.duration.seconds(1);
    
  const initializationPeriod = time.duration.seconds(10);
  const undelegationPeriod = time.duration.seconds(30);

  before(async () => {
    tokenContract = await KeepToken.new({from: accounts[0]});
    registryContract = await Registry.new({from: accounts[0]});
    stakingContract = await TokenStaking.new(
      tokenContract.address, 
      registryContract.address, 
      initializationPeriod, 
      undelegationPeriod,
      {from: accounts[0]}
    );
    grantAmount = (await stakingContract.minimumStake()).muln(10);

    grantContract = await TokenGrant.new(tokenContract.address, {from: accounts[0]});
    
    await grantContract.authorizeStakingContract(stakingContract.address, {from: accounts[0]});

    permissivePolicy = await PermissiveStakingPolicy.new()

    grantStart = await time.latest();

    grantId = await grantTokens(
      grantContract, 
      tokenContract,
      grantAmount,
      tokenOwner, 
      grantee, 
      grantDuration, 
      grantStart, 
      grantCliff, 
      grantRevocable,
      permissivePolicy.address,
      {from: accounts[0]}
    );
  });

  beforeEach(async () => {
    await createSnapshot()
  })

  afterEach(async () => {
    await restoreSnapshot()
  })

  it("should allow to wihtdraw some tokens", async () => {
    await time.increaseTo(grantStart.add(grantDuration) - 30)

    const withdrawable = await grantContract.withdrawable(grantId)
    const granteeTokenGrantBalancePre = await grantContract.balanceOf(grantee)
    await grantContract.withdraw(grantId)
    const granteeTokenGrantBalancePost = await grantContract.balanceOf(grantee)

    const granteeTokenBalance = await tokenContract.balanceOf(grantee)
    const grantDetails = await grantContract.getGrant(grantId)
    
    expect(withdrawable).to.be.gt.BN(
      0,
      "Should allow to withdraw more than 0"
    )
    expect(granteeTokenBalance).to.eq.BN(
      grantDetails.withdrawn,
      "Grantee KEEP token balance should be equal to the grant withdrawn amount"
    )
    expect(granteeTokenGrantBalancePre.sub(granteeTokenGrantBalancePost)).to.eq.BN(
      grantDetails.withdrawn,
      "Grantee token grant balance should be updated"
    )
  })

  it("should allow to wihtdraw the whole grant amount ", async () => {
    await time.increaseTo(grantStart.add(grantDuration))

    const withdrawablePre = await grantContract.withdrawable(grantId)
    const granteeTokenGrantBalancePre = await grantContract.balanceOf(grantee)
    await grantContract.withdraw(grantId)
    const withdrawablePost = await grantContract.withdrawable(grantId)
    const granteeTokenGrantBalancePost = await grantContract.balanceOf(grantee)

    const granteeTokenBalance = await tokenContract.balanceOf(grantee)
    const grantDetails = await grantContract.getGrant(grantId)

    expect(withdrawablePre).to.eq.BN(
      grantAmount,
      "The withdrawable amount should be equal to the whole grant amount"
    )
    expect(granteeTokenBalance).to.eq.BN(
      grantAmount,
      "Grantee KEEP token balance should be equal to the grant amount"
    )
    expect(withdrawablePost).to.eq.BN(
      0,
      "The withdrawable amount should be equal to 0, when the whole grant amount has been withdrawn"
    )
    expect(granteeTokenGrantBalancePre.sub(grantAmount)).to.eq.BN(
      granteeTokenGrantBalancePost,
      "Grantee token grant balance should be updated"
    )
    expect(grantDetails.withdrawn).to.eq.BN(
      grantAmount,
      "The grant withdrawan amount should be updated"
    )
  })

  it("should not allow to withdraw delegated tokens", async () => {
    await time.increaseTo(grantStart.add(grantDuration))
    const withdrawable = await grantContract.withdrawable(grantId)
    await delegateStakeFromGrant(
        grantContract,
        stakingContract.address,
        grantee,
        operatorOne,
        magpie,
        authorizer,
        grantAmount,
        grantId
    )
    const withdrawableAfterStake = await grantContract.withdrawable(grantId)

    await expectRevert(
      grantContract.withdraw(grantId),
      "Grant available to withdraw amount should be greater than zero."
    )
    expect(withdrawableAfterStake).to.eq.BN(
      0,
      "The withdrawable amount should be equal to 0"
    )
  })
});