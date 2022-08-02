package entry

import "testing"

func TestCalculateSubmissionQueueIndex(t *testing.T) {
	groupSize := uint64(64)

	var tests = map[string]struct {
		memberIndex                  uint64
		firstSubmitterMemberIndex    uint64
		expectedSubmissionQueueIndex uint64
	}{
		"checked member index greater than the first submitter index": {
			memberIndex:                  15,
			firstSubmitterMemberIndex:    10,
			expectedSubmissionQueueIndex: 5,
		},
		"checked member index equal to the first submitter index": {
			memberIndex:                  10,
			firstSubmitterMemberIndex:    10,
			expectedSubmissionQueueIndex: 0,
		},
		"checked member index lesser than the first submitter index": {
			memberIndex:                  5,
			firstSubmitterMemberIndex:    10,
			expectedSubmissionQueueIndex: 59,
		},
	}

	for testName, test := range tests {
		t.Run(testName, func(t *testing.T) {
			actualSubmissionQueueIndex := calculateSubmissionQueueIndex(
				test.memberIndex,
				test.firstSubmitterMemberIndex,
				groupSize,
			)

			if test.expectedSubmissionQueueIndex != actualSubmissionQueueIndex {
				t.Errorf(
					"unexpected index\nexpected: %v\nactual:   %v\n",
					test.expectedSubmissionQueueIndex,
					actualSubmissionQueueIndex,
				)
			}
		})
	}
}
