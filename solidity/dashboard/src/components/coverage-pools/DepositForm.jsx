import React from "react"
import { withFormik } from "formik"
import FormInput from "../../components/FormInput"
import { SubmitButton } from "../../components/Button"
import Divider from "../../components/Divider"
import MaxAmountAddon from "../MaxAmountAddon"
import { normalizeAmount, formatAmount } from "../../forms/form.utils"
import { KEEP } from "../../utils/token.utils"
import List from "../List"
import * as Icons from "../Icons"
import Chip from "../Chip"
import TokenAmount from "../TokenAmount"
import { useCustomOnSubmitFormik } from "../../hooks/useCustomOnSubmitFormik"
import {
  validateAmountInRange,
  getErrorsObj,
} from "../../forms/common-validators"
import { lte } from "../../utils/arithmetics.utils"
import useSetMaxAmountToken from "../../hooks/useSetMaxAmountToken"
import { displayPercentageValue } from "../../utils/general.utils"

const DepositForm = ({ tokenAmount, onSubmit, apy, ...formikProps }) => {
  const onSubmitBtn = useCustomOnSubmitFormik(onSubmit)
  const onAddonClick = useSetMaxAmountToken("tokenAmount", tokenAmount)

  const estimatedReward =
    formikProps.values.tokenAmount && apy > 0 && isFinite(apy)
      ? KEEP.fromTokenUnit(formikProps.values.tokenAmount)
          .multipliedBy(apy.toString())
          .toFixed()
          .toString()
      : 0

  return (
    <form className="deposit-form">
      <div className="deposit-form__token-amount-wrapper">
        <FormInput
          name="tokenAmount"
          type="text"
          label="Amount"
          placeholder="0"
          normalize={normalizeAmount}
          format={formatAmount}
          inputAddon={
            <MaxAmountAddon onClick={onAddonClick} text="Max Stake" />
          }
          additionalInfoText={`KEEP Balance ${KEEP.displayAmountWithSymbol(
            tokenAmount
          )}`}
        />
      </div>
      <List>
        <List.Title className="mb-2">Estimated Rewards</List.Title>
        <List.Content>
          <EstimatedAPYListItem
            apy={apy}
            reward={estimatedReward}
            label="Yearly"
          />
        </List.Content>
      </List>
      <Divider className="divider divider--tile-fluid" />

      <p>
        Risk warning:&nbsp;
        <a
          href="https://example.com"
          rel="noopener noreferrer"
          target="_blank"
          className="text-black"
        >
          Read the documentation
        </a>
      </p>
      <SubmitButton
        className="btn btn-lg btn-primary w-100"
        onSubmitAction={onSubmitBtn}
        disabled={!(formikProps.isValid && formikProps.dirty)}
      >
        deposit
      </SubmitButton>
    </form>
  )
}

const EstimatedAPYListItem = ({ apy, reward, label }) => {
  return (
    <List.Item className="mb-1">
      <div className="flex row center">
        <Icons.Time
          className="time-icon time-icon--grey-50"
          width={16}
          height={16}
        />
        &nbsp;
        <span className="text-grey-50">{label}</span>
        &nbsp;
        <Chip
          text={`${displayPercentageValue(apy * 100, false)} APY`}
          size="small"
        />
        <TokenAmount
          wrapperClassName="ml-a"
          amount={reward}
          amountClassName=""
          symbolClassName=""
        />
      </div>
    </List.Item>
  )
}

export default withFormik({
  validateOnChange: true,
  validateOnBlur: true,
  mapPropsToValues: () => ({
    tokenAmount: "0",
  }),
  validate: (values, props) => {
    const { tokenAmount } = values
    const errors = {}

    if (lte(props.tokenAmount || 0, 0)) {
      errors.tokenAmount = "Insufficient funds"
    } else {
      errors.tokenAmount = validateAmountInRange(
        tokenAmount,
        props.tokenAmount,
        KEEP.fromTokenUnit(1)
      )
    }

    return getErrorsObj(errors)
  },
  displayName: "CovPoolsDepositForm",
})(DepositForm)
