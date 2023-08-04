import React from 'react';

import { SVGIconThemed } from '../SVGIcon/SVGIconThemed';
import './style.css';


const zkp2pInfoData = [
  {
    icon: 'github',
    title: 'Github',
    value: 'https://github.com/zkp2p',
  },
  {
    icon: 'twitter',
    title: 'Twitter',
    value: 'https://twitter.com/zkp2p',
  },
];

export const BottomNav: React.FC = () => {
  const jumpToMedia = (url: string) => {
    window.open(url, '_blank');
  };

  const openTerms = () => {
    window.open('https://builder.gitcoin.co/#/chains/1/registry/0x03506eD3f57892C85DB20C36846e9c808aFe9ef4/projects/970', '_blank');
  };

  return (
    <div className="bottom-nav">
      <div className="links">
        <div className="links-content">
          {zkp2pInfoData.map((item) => (
            <span key={item.title} className="links-item">
              <SVGIconThemed
                icon={item.icon}
                onClick={() => jumpToMedia(item.value)}
                className="links-icon"
              />
            </span>
          ))}
        </div>
      </div>
      <div className="terms" onClick={openTerms}>
        Support Further Development
      </div>
    </div>
  );
};
