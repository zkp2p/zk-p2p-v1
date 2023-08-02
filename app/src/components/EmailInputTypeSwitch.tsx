import React, { useEffect, useState } from 'react';
import { Switch } from '@mui/material';
import styled from 'styled-components';


interface EmailInputTypeSwitchProps {
  inputTypeChecked: boolean;
  isLightMode: boolean;
  onSwitchChange: (checked: boolean) => void;
}

export const EmailInputTypeSwitch: React.FC<EmailInputTypeSwitchProps> = ({
  inputTypeChecked = true,
  isLightMode,
  onSwitchChange,
}) => {
  const [checked, setChecked] = useState(() => {
    const saved = localStorage.getItem('proofEmailVersion');
    return saved !== null ? JSON.parse(saved) : inputTypeChecked;
  });

  useEffect(() => {
    onSwitchChange(checked);
    
    return () => {
      localStorage.setItem('proofEmailVersion', JSON.stringify(checked));
    };
  }, [checked]);

  useEffect(() => {
    setChecked(inputTypeChecked);
  }, [inputTypeChecked]);

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <SwitchLabel>
        Input Mode
      </SwitchLabel>
      <Switch
        checked={checked}
        onChange={handleSwitchChange}
        color={checked ? (!isLightMode ? 'primary' : 'secondary') : 'default'}
      />
    </div>
  )
};

const SwitchLabel = styled.span`
  margin-right: 10px;
  color: '#888888';
`;
