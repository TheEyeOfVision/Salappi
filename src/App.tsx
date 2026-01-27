import React from 'react';
import EscrowWalletApp from './EscrowWallet'; // This imports the component you just saved
import SalappiPlatform from './SalappiPlatform';

function App() {
  return (
    <div className="App">
      {/* This renders the entire Escrow system */}
      <SalappiPlatform />
    </div>
  );
}

export default App;