package firewall

import (
	"fmt"
	"time"

	"github.com/keep-network/keep-common/pkg/cache"
	"github.com/keep-network/keep-core/pkg/chain"
	"github.com/keep-network/keep-core/pkg/net"
	"github.com/keep-network/keep-core/pkg/operator"
)

// Disabled is an empty Firewall implementation enforcing no rules
// on the connection.
var Disabled = &noFirewall{}

type noFirewall struct{}

func (nf *noFirewall) Validate(remotePeerPublicKey *operator.PublicKey) error {
	return nil
}

const (
	// PositiveMinimumStakeCachePeriod is the time period the cache maintains
	// the positive result of the last HasMinimumStake check.
	// We use the cache to minimize calls to Ethereum client.
	PositiveMinimumStakeCachePeriod = 12 * time.Hour

	// NegativeMinimumStakeCachePeriod is the time period the cache maintains
	// the negative result of the last HasMinimumStake check.
	// We use the cache to minimize calls to Ethereum client.
	NegativeMinimumStakeCachePeriod = 1 * time.Hour
)

var errNoMinimumStake = fmt.Errorf("remote peer has no minimum stake")

// MinimumStakePolicy is a net.Firewall rule making sure the remote peer
// has a stake delegation in the Threshold TokenStaking contract and the minimum
// authorization required by the application
func MinimumStakePolicy(stakeMonitor chain.StakeMonitor) net.Firewall {
	return &minimumStakePolicy{
		stakeMonitor: stakeMonitor,
	}
}

type minimumStakePolicy struct {
	stakeMonitor        chain.StakeMonitor
	positiveResultCache *cache.TimeCache
	negativeResultCache *cache.TimeCache
}

func (msp *minimumStakePolicy) Validate(
	remotePeerPublicKey *operator.PublicKey,
) error {
	remotePeerPublicKeyHex := remotePeerPublicKey.String()

	// First, check in the in-memory time caches to minimize hits to ETH client.
	// If the Keep client with the given chain address is in the positive result
	// cache it means it has had a minimum stake the last HasMinimumStake was
	// executed and caching period has not elapsed yet. Similarly, if the client
	// is in the negative result cache it means it hasn't had a minimum stake
	// during the last check.
	//
	// If the caching period elapsed, cache checks will return false and we
	// have to ask the chain about the current status.
	msp.positiveResultCache.Sweep()
	msp.negativeResultCache.Sweep()

	if msp.positiveResultCache.Has(remotePeerPublicKeyHex) {
		return nil
	}

	if msp.negativeResultCache.Has(remotePeerPublicKeyHex) {
		return errNoMinimumStake
	}

	hasMinimumStake, err := msp.stakeMonitor.HasMinimumStake(remotePeerPublicKey)
	if err != nil {
		return fmt.Errorf(
			"could not validate remote peer's minimum stake: [%v]",
			err,
		)
	}

	if !hasMinimumStake {
		// Add this address to the negative result cache.
		// We'll not hit HasMinimumStake again for the entire caching period.
		msp.negativeResultCache.Add(remotePeerPublicKeyHex)
		return errNoMinimumStake
	}

	// Add this address to the positive result cache.
	// We'll not hit HasMinimumStake again for the entire caching period.
	msp.positiveResultCache.Add(remotePeerPublicKeyHex)

	return nil
}
