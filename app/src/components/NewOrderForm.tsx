import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useSignMessage } from 'wagmi'

import { Button } from "../components/Button";
import { Col, SubHeader } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { SingleLineInput } from "../components/SingleLineInput";
import { generateAccountFromSignature, getPublicKeyFromAccount } from '../helpers/accountHash';


interface NewOrderFormProps {
  loggedInWalletAddress: string;
  newOrderAmount: number;
  setNewOrderAmount: (amount: number) => void;
  setVenmoIdEncryptingKey: (key: string) => void;
  writeNewOrder?: () => void;
  isWriteNewOrderLoading: boolean;
}

 
export const NewOrderForm: React.FC<NewOrderFormProps> = ({
  loggedInWalletAddress,
  newOrderAmount,
  setNewOrderAmount,
  setVenmoIdEncryptingKey,
  writeNewOrder,
  isWriteNewOrderLoading
}) => {
  const accountHashKey = `accountHash_${loggedInWalletAddress}`;
  const [accountHash, setAccountHash] = useState<string>(localStorage.getItem(accountHashKey) || "");

  const {
    data: signedMessageSignature,
    signMessage,
  } = useSignMessage({
    message: 'You are signing a message that will be used to encrypt Venmo handles.',
  })

  useEffect(() => {
    if (signedMessageSignature) {
      const accountHash = generateAccountFromSignature(signedMessageSignature);
      setAccountHash(accountHash);
      localStorage.setItem(accountHashKey, accountHash);
    }
  }, [accountHashKey, signedMessageSignature])

  useEffect(() => {
    const accountHash = localStorage.getItem(accountHashKey);
    setAccountHash(accountHash || "");
  }, [accountHashKey, loggedInWalletAddress]);

  return (
    <NewOrderFormContainer>
      <SubHeader>New Order</SubHeader>
      <NumberedStep step={1}>
        Specify an amount to on-ramp
      </NumberedStep>
      <NumberedStep step={2}>
        If this is your first time or if you are on a new browser, you'll be prompted to sign a message to encrypt Venmo handles
      </NumberedStep>
      <hr />
      <SingleLineInput
        label="Amount (USDC)"
        value={newOrderAmount}
        placeholder={'0'}
        onChange={(e) => {
          setNewOrderAmount(e.currentTarget.value);
        }}
      />
      <Button
        disabled={isWriteNewOrderLoading}
        onClick={async () => {
          if (accountHash === "") {
            await signMessage();
          } else {
            const publicKey = getPublicKeyFromAccount(accountHash);
            setVenmoIdEncryptingKey(publicKey);
            writeNewOrder?.();
          }
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
