import React, { useState } from 'react';
import styled from 'styled-components';

import { Button } from "../components/Button";
import { Col } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { SingleLineInput } from "../components/SingleLineInput";


interface NewOrderFormProps {
  newOrderAmount: number;
  setNewOrderAmount: (amount: number) => void;
  venmoIdEncryptingKey: string;
  setVenmoIdEncryptingKey: (key: string) => void;
  writeNewOrder?: () => void;
  isWriteNewOrderLoading: boolean;
}
 
export const NewOrderForm: React.FC<NewOrderFormProps> = ({ newOrderAmount, setNewOrderAmount, venmoIdEncryptingKey, setVenmoIdEncryptingKey, writeNewOrder, isWriteNewOrderLoading }) => {
  return (
    <NewOrderFormContainer>
      <NumberedStep step={1}>
        Specify an amount to on-ramp.
      </NumberedStep>
      <NumberedStep step={2}>
        Provide a public key that will be used to encrypt Venmo handles. You should use a separate asymmetric key pair than your on-ramping account.
      </NumberedStep>
      <SingleLineInput
        label="Amount"
        value={newOrderAmount}
        onChange={(e) => {
          setNewOrderAmount(e.currentTarget.value);
        }}
      />
      <SingleLineInput
        label="Encrypting Public Key"
        value={venmoIdEncryptingKey}
        onChange={(e) => {
          setVenmoIdEncryptingKey(e.currentTarget.value);
        }}
      />
      <Button
        disabled={isWriteNewOrderLoading}
        onClick={async () => {
          writeNewOrder?.();
        }}
        >
        Create
      </Button>
    </NewOrderFormContainer>
  );
};

const NewOrderFormContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;
