import React from 'react';
import styled from 'styled-components';
import {
  useContractWrite,
  usePrepareContractWrite,
  useNetwork,
} from 'wagmi'

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { LabeledTextArea } from './LabeledTextArea';
import { NumberedStep } from "../components/NumberedStep";
import { abi } from "../helpers/ramp.abi";
import { useRampContractAddress } from '../hooks/useContractAddress';


interface SubmitOrderOnRampFormProps {
  proof: string;
  publicSignals: string;
}
 
export const SubmitOrderOnRampForm: React.FC<SubmitOrderOnRampFormProps> = ({
  proof,
  publicSignals,
}) => {
  const { chain } = useNetwork();

  /*
    Contract Writes
  */

  //
  // legacy: onRamp(uint256 _orderId, uint256 _offRamper, VenmoId, bytes calldata _proof)
  // new:    onRamp(uint256[2] memory _a, uint256[2][2] memory _b, uint256[2] memory _c, uint256[msgLen] memory _signals)
  //
  const reformatProofForChain = (proof: string) => {
    return [
      proof ? JSON.parse(proof)["pi_a"].slice(0, 2) : null,
      proof
        ? JSON.parse(proof)
            ["pi_b"].slice(0, 2)
            .map((g2point: any[]) => g2point.reverse())
        : null,
      proof ? JSON.parse(proof)["pi_c"].slice(0, 2) : null,
    ];
  };

  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    addressOrName: useRampContractAddress(chain),
    contractInterface: abi,
    functionName: 'onRamp',
    args: [
      ...reformatProofForChain(proof),
      publicSignals ? JSON.parse(publicSignals) : null,
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteCompleteOrderLoading,
    write: writeCompleteOrder
  } = useContractWrite(writeCompleteOrderConfig);

  return (
    <SubmitOrderOnRampFormHeaderContainer>
      <SubHeader>Submit Proof</SubHeader>
      <SubmitOrderOnRampFormBodyContainer>
          <NumberedStep>
            Upon successful proof generation above, both the proof and public inputs will be
            populated automatically. Prior to submission, select the correct order claim for
            the Venmo payment you completed from table of claims above.
          </NumberedStep>
        <LabeledTextArea
          label="Proof Output"
          value={proof}
          disabled={true}
        />
        <LabeledTextArea
          label="Public Signals"
          value={publicSignals}
          disabled={true}
          secret
        />
        <Button
          disabled={proof.length === 0 || publicSignals.length === 0 || isWriteCompleteOrderLoading}
          onClick={async () => {
            writeCompleteOrder?.();
          }}
        >
          Submit and Retrieve USDC
        </Button>
      </SubmitOrderOnRampFormBodyContainer>
    </SubmitOrderOnRampFormHeaderContainer>
  );
};

const SubmitOrderOnRampFormHeaderContainer = styled.div`
  width: 100%;
  gap: 1rem;
`;

const SubmitOrderOnRampFormBodyContainer = styled(Col)`
  gap: 2rem;
`;
