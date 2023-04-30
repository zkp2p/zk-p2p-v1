import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useSignMessage } from 'wagmi'

import { Button } from "../components/Button";
import { Col, SubHeader } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { SingleLineInput } from "../components/SingleLineInput";
import { generateAccountFromSignature, getPublicKeyFromAccount } from '../helpers/messagEncryption';


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
    message: 'You are signing a message to log into zkp2p.xyz.',
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
    <NewOrderFormHeaderContainer>
      <SubHeader>New Order</SubHeader>
      <NewOrderFormBodyContainer>
        <NumberedStep>
          Specify an amount to on-ramp. If this is your first time or you are logged in to the same wallet from a different
          browser, you will be prompted to sign a message to register.
        </NumberedStep>
        <SingleLineInput
          label="Amount USDC to Request"
          value={newOrderAmount === 0 ? '' : newOrderAmount.toString()}
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
      </NewOrderFormBodyContainer>
    </NewOrderFormHeaderContainer>
  );
};

const NewOrderFormHeaderContainer = styled.div`
  width: 100%;
  gap: 1rem;
`;

const NewOrderFormBodyContainer = styled(Col)`
  gap: 2rem;
`;

