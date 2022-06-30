package event

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"
)

// Local chain interface to avoid import cycles.
type chain interface {
	CurrentRequestStartBlock() (*big.Int, error)
	CurrentRequestPreviousEntry() ([]byte, error)
}

// Deduplicator decides whether the given event should be handled by the
// client or not.
//
// Event subscription may emit the same event two or more times. The same event
// can be emitted right after it's been emitted for the first time. The same
// event can also be emitted a long time after it's been emitted for the first
// time. It is deduplicator's responsibility to decide whether the given
// event is a duplicate and should be ignored or if it is not a duplicate and
// should be handled.
//
// Those events are supported:
// - relay entry requested
type Deduplicator struct {
	chain chain

	relayEntryMutex             sync.Mutex
	currentRequestStartBlock    uint64
	currentRequestPreviousEntry string
}

// NewDeduplicator constructs a new Deduplicator instance.
func NewDeduplicator(chain chain) *Deduplicator {
	return &Deduplicator{
		chain: chain,
	}
}

// NotifyRelayEntryStarted notifies the client wants to start relay entry
// generation upon receiving an event. It returns boolean indicating whether the
// client should proceed with the execution or ignore the event as a duplicate.
func (d *Deduplicator) NotifyRelayEntryStarted(
	newRequestStartBlock uint64,
	newRequestPreviousEntry string,
) (bool, error) {
	d.relayEntryMutex.Lock()
	defer d.relayEntryMutex.Unlock()

	shouldUpdate := func() (bool, error) {
		// If there is no prior relay request registered by this node, return
		// true unconditionally.
		if d.currentRequestStartBlock == 0 {
			return true, nil
		}

		// A valid new relay request should have its block number bigger than
		// the current one because it occurs later for sure.
		if newRequestStartBlock > d.currentRequestStartBlock {
			// There may be a case when new relay request holds the same
			// previous entry than the current one. It is the case when a timed
			// out request is retried or a minor chain reorg occurred. The
			// former must be processed but the latter should be ignored. To
			// make a right decision, we need to consult the chain to confirm
			// values of the current request previous entry and start block.
			// In contrary, if new relay request holds a different
			// previous entry than the current one, everything is ok.
			if newRequestPreviousEntry == d.currentRequestPreviousEntry {
				currentRequestPreviousEntryOnChain, err := d.chain.
					CurrentRequestPreviousEntry()
				if err != nil {
					return false, fmt.Errorf(
						"could not get current request previous entry: [%v]",
						err,
					)
				}

				currentRequestStartBlockOnChain, err := d.chain.
					CurrentRequestStartBlock()
				if err != nil {
					return false, fmt.Errorf(
						"could not get current request start block: [%v]",
						err,
					)
				}

				if newRequestPreviousEntry ==
					hex.EncodeToString(currentRequestPreviousEntryOnChain[:]) &&
					newRequestStartBlock ==
						currentRequestStartBlockOnChain.Uint64() {
					return true, nil
				}
			} else {
				return true, nil
			}
		}

		return false, nil
	}

	update, err := shouldUpdate()
	if err != nil {
		return false, err
	}

	if update {
		d.currentRequestStartBlock = newRequestStartBlock
		d.currentRequestPreviousEntry = newRequestPreviousEntry
		return true, nil
	}

	return false, nil
}
