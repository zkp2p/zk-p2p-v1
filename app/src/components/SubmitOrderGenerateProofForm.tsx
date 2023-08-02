import React, { useState } from 'react';
import { useAsync, useUpdateEffect } from "react-use";
import styled from 'styled-components';

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { LabeledTextArea } from './LabeledTextArea';
import { ProgressBar } from "../components/ProgressBar";
import { NumberedStep } from "../components/NumberedStep";
import { EmailInputTypeSwitch } from "./EmailInputTypeSwitch";
import { DragAndDropTextBox } from "./DragAndDropTextBox";

import { downloadProofFiles, generateProof } from "../helpers/zkp";
import { insert13Before10 } from "../scripts/generate_input";
import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";

const generate_input = require("../scripts/generate_input");


interface SubmitOrderGenerateProofFormProps {
  loggedInWalletAddress: string;
  selectedOrder: OnRampOrder;
  selectedOrderClaim: OnRampOrderClaim;
  setSubmitOrderProof: (proof: string) => void;
  setSubmitOrderPublicSignals: (publicSignals: string) => void;
}
 
export const SubmitOrderGenerateProofForm: React.FC<SubmitOrderGenerateProofFormProps> = ({
  loggedInWalletAddress,
  selectedOrder,
  selectedOrderClaim,
  setSubmitOrderProof,
  setSubmitOrderPublicSignals
}) => {
  const [isEmailInputSettingDrag, setIsEmailInputSettingDrag] = useState<boolean>(true);
  
  const [emailFull, setEmailFull] = useState<string>(localStorage.emailFull || "");

  const [displayMessage, setDisplayMessage] = useState<string>("Generate Proof");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const [status, setStatus] = useState<
    | "not-started"
    | "generating-input"
    | "downloading-proof-files"
    | "generating-proof"
    | "error-bad-input"
    | "error-failed-to-download"
    | "error-failed-to-prove"
    | "done"
    | "sending-on-chain"
    | "sent"
  >("not-started");

  const [stopwatch, setStopwatch] = useState<Record<string, number>>({
    startedDownloading: 0,
    finishedDownloading: 0,
    startedProving: 0,
    finishedProving: 0,
  });

  const recordTimeForActivity = (activity: string) => {
    setStopwatch((prev) => ({
      ...prev,
      [activity]: Date.now(),
    }));
  };

  const filename = "circuit";

  var Buffer = require("buffer/").Buffer; // note: the trailing slash is important!

  // computed state
  const { value, error } = useAsync(async () => {
    try {
      const circuitInputs = await generate_input.generate_inputs(
        Buffer.from(atob(emailFull)),
        selectedOrder.orderId,
        selectedOrderClaim.claimId
      );
      return circuitInputs;
    } catch (e) {
      return {};
    }
  }, [emailFull, loggedInWalletAddress]);

  // local storage stuff
  useUpdateEffect(() => {
    if (value) {
      if (localStorage.emailFull !== emailFull) {
        console.info("Wrote email to localStorage");
        localStorage.emailFull = emailFull;
      }
    }
  }, [value]);

  if (error) console.error(error);
  
  const circuitInputs = value || {};
  console.log("Circuit inputs:", circuitInputs);

  const handleEmailInputTypeChanged = (checked: boolean) => {
    setIsEmailInputSettingDrag(checked);
  };

  return (
    <ComponentWrapper>
      <SubHeader>Generate Proof</SubHeader>
      <Body>
        <NumberedStep>
          Select one of the claims in the table above. To generate a proof, open the transaction
          email from Venmo and select 'Show original' to view the full contents. You can either
          download and drag the .eml file into the box below or paste the contents directly. If this
          is your first time, you will then need to download proving keys. Allot approximately 10
          minutes for proof generation and do not close your browser.
        </NumberedStep>
        <InputWithTitleContainer>
          <HeaderContainer>
            <Title>
              {isEmailInputSettingDrag ? 'Drag and Drop .eml' : 'Paste Email'}
            </Title>
            <EmailInputTypeSwitch
              inputTypeChecked={isEmailInputSettingDrag}
              isLightMode={false}
              onSwitchChange={handleEmailInputTypeChanged}
            />
          </HeaderContainer>
          {isEmailInputSettingDrag ? (
            <DragAndDropTextBox
              onFileDrop={(file: File) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  if (e.target) {
                    setEmailFull(e.target.result as string);
                  }
                };
                reader.readAsText(file);
              }}
            />
          ) : (
            <LabeledTextArea
              label=""
              value={emailFull}
              onChange={(e) => {
                setEmailFull(e.currentTarget.value);
              }}
            />
          )}
        </InputWithTitleContainer>
        <ButtonContainer>
          <Button
            disabled={emailFull.length === 0 || selectedOrderClaim === undefined}
            onClick={async () => {
              console.log("Generating proof...");
              setDisplayMessage("Generating proof...");
              setStatus("generating-input");

              console.log(emailFull);

              const formattedArray = await insert13Before10(Uint8Array.from(Buffer.from(emailFull)));

              // Due to a quirk in carriage return parsing in JS, we need to manually edit carriage returns to match DKIM parsing
              console.log("formattedArray", formattedArray);
              console.log("buffFormArray", Buffer.from(formattedArray.buffer));
              console.log("buffFormArray", formattedArray.toString());

              let input = "";
              try {
                input = await generate_input.generate_inputs(
                  Buffer.from(formattedArray.buffer),
                  selectedOrder.orderId,
                  selectedOrderClaim.claimId
                );
              } catch (e) {
                console.log("Error generating input", e);
                setDisplayMessage("Prove");
                setStatus("error-bad-input");
                return;
              }
              console.log("Generated input:", JSON.stringify(input));

              /*
                Download proving files
              */
              console.time("zk-dl");
              recordTimeForActivity("startedDownloading");
              setDisplayMessage("Downloading compressed proving files... (this may take a few minutes)");
              setStatus("downloading-proof-files");
              await downloadProofFiles(filename, () => {
                setDownloadProgress((p) => p + 1);
              });
              console.timeEnd("zk-dl");
              recordTimeForActivity("finishedDownloading");

              /*
                Generate proof
              */
              console.time("zk-gen");
              recordTimeForActivity("startedProving");
              setDisplayMessage("Starting proof generation... (this will take 6-10 minutes and ~5GB RAM)");
              setStatus("generating-proof");
              console.log("Starting proof generation");
              // alert("Generating proof, will fail due to input");

              const { proof, publicSignals } = await generateProof(input, "circuit"); 
              console.log("Finished proof generation");
              console.timeEnd("zk-gen");
              recordTimeForActivity("finishedProving");

              /*
                Set proof
              */
              setSubmitOrderProof(JSON.stringify(proof));
              
              /*
                Set public signals
              */
              setSubmitOrderPublicSignals(JSON.stringify(publicSignals));

              if (!circuitInputs) {
                setStatus("error-failed-to-prove");
                return;
              }
              setDisplayMessage("Finished computing ZK proof");
              setStatus("done");
              try {
                (window as any).cJson = JSON.stringify(circuitInputs);
                console.log("wrote circuit input to window.cJson. Run copy(cJson)");
              } catch (e) {
                console.error(e);
              }
            }}
          >
            {displayMessage}
          </Button>
        </ButtonContainer>
        {displayMessage === "Downloading compressed proving files... (this may take a few minutes)" && (
            <ProgressBar width={downloadProgress * 10} label={`${downloadProgress} / 10 items`} />
          )}
          <ProcessStatus status={status}>
            {status !== "not-started" ? (
              <div>
                Status:
                <span data-testid={"status-" + status}>{status}</span>
              </div>
            ) : (
              <div data-testid={"status-" + status}></div>
            )}
            <TimerDisplay timers={stopwatch} />
          </ProcessStatus>
      </Body>
    </ComponentWrapper>
  );
};

const ComponentWrapper = styled.div`
  width: 100%;
  gap: 1rem;
`;

const Body = styled(Col)`
  gap: 2rem;
`;

const InputWithTitleContainer = styled(Col)`
  gap: 0rem;
`;

const ProcessStatus = styled.div<{ status: string }>`
  font-size: 8px;
  padding: 8px;
  border-radius: 8px;
`;

const ButtonContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between; // Adjust the space between the buttons
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Title = styled.h4`
  // Add any styles you want for your title here
`;

const TimerDisplayContainer = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 8px;
`;

const TimerDisplay = ({ timers }: { timers: Record<string, number> }) => {
  return (
    <TimerDisplayContainer>
      {timers["startedDownloading"] && timers["finishedDownloading"] ? (
        <div>
          Zkey Download time:&nbsp;
          <span data-testid="download-time">{timers["finishedDownloading"] - timers["startedDownloading"]}</span>ms
        </div>
      ) : (
        <div></div>
      )}
      {timers["startedProving"] && timers["finishedProving"] ? (
        <div>
          Proof generation time:&nbsp;
          <span data-testid="proof-time">{timers["finishedProving"] - timers["startedProving"]}</span>ms
        </div>
      ) : (
        <div></div>
      )}
    </TimerDisplayContainer>
  );
};
