import React from 'react';
import styled from 'styled-components';

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { LabeledTextArea } from './LabeledTextArea';


interface SubmitOrderOnRampFormProps {
  proof: string;
  publicSignals: string;
  setSubmitOrderProof: (proof: string) => void;
  setSubmitOrderPublicSignals: (publicSignals: string) => void;
  writeCompleteOrder?: () => void;
  isWriteCompleteOrderLoading: boolean;
}
 
export const SubmitOrderOnRampForm: React.FC<SubmitOrderOnRampFormProps> = ({
  proof,                                  // TODO: add these to local storage by order and account id
  publicSignals,                          // TODO: add these to local storage by order and account id
  setSubmitOrderPublicSignals,
  setSubmitOrderProof,
  writeCompleteOrder,
  isWriteCompleteOrderLoading
}) => {
  return (
    <SubmitOrderOnRampFormContainer>
      <SubHeader>Submit Proof</SubHeader>
      <LabeledTextArea
        label="Proof Output"
        value={proof}
        onChange={(e) => {
          setSubmitOrderProof(e.currentTarget.value);
        }}
      />
      <LabeledTextArea
        label="Public Signals"
        value={publicSignals}
        secret
        onChange={(e) => {
          setSubmitOrderPublicSignals(e.currentTarget.value);
        }}
      />
      <Button
        disabled={proof.length === 0 || publicSignals.length === 0 || isWriteCompleteOrderLoading}
        onClick={async () => {
          writeCompleteOrder?.();
        }}
      >
        Submit and Claim
      </Button>
    </SubmitOrderOnRampFormContainer>
  );
};

const SubmitOrderOnRampFormContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;
