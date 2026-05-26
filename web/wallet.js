// SPECTER Wallet — Base Network
// Update SPECTER_TOKEN after contract deploy
window.SpectorWallet = (function () {

  const SPECTER_TOKEN  = '0x0000000000000000000000000000000000000000'; // <- replace after deploy
  const BASE_CHAIN_ID  = '0x2105'; // 8453
  const BASE_RPC       = 'https://mainnet.base.org';
  const TOKEN_DECIMALS = 18;

  const TIERS = [
    { name: 'PHANTOM', min: 100000, label: '// PHANTOM',  color: '#ffffff', desc: 'API access + raw proofs' },
    { name: 'HUNTER',  min: 10000,  label: '// HUNTER',   color: '#c4b0ff', desc: 'Full agent analysis + memory' },
    { name: 'SCOUT',   min: 1000,   label: '// SCOUT',    color: '#a68fff', desc: 'Real-time signals + alerts' },
    { name: 'FREE',    min: 0,      label: '// FREE',     color: '#7c66cc', desc: 'Public dashboard (delayed)' },
  ];

  const ERC20_ABI = [
    { inputs:[{name:'owner',type:'address'}], name:'balanceOf', outputs:[{name:'',type:'uint256'}], stateMutability:'view', type:'function' },
    { inputs:[], name:'decimals', outputs:[{name:'',type:'uint8'}], stateMutability:'view', type:'function' },
    { inputs:[], name:'symbol',   outputs:[{name:'',type:'string'}], stateMutability:'view', type:'function' },
  ];

  let state = {
    connected:  false,
    address:    null,
    balance:    0,
    tier:       TIERS[3],
    chainOk:    false,
    tokenLive:  SPECTER_TOKEN !== '0x0000000000000000000000000000000000000000',
  };

  let _onChange       = null;
  let _listenersAdded = false;

  function getTier(bal) {
    for (const t of TIERS) {
      if (bal >= t.min) return t;
    }
    return TIERS[3];
  }

  function shortAddr(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async function switchToBase() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId:  BASE_CHAIN_ID,
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [BASE_RPC],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
      }
    }
  }

  async function readBalance(addr) {
    if (!state.tokenLive) return 0;
    try {
      // Use ethers if available, else raw RPC call
      if (window.ethers) {
        const provider = new window.ethers.BrowserProvider(window.ethereum);
        const contract  = new window.ethers.Contract(SPECTER_TOKEN, ERC20_ABI, provider);
        const raw       = await contract.balanceOf(addr);
        const dec       = await contract.decimals();
        return Number(raw) / Math.pow(10, dec);
      } else {
        // Raw eth_call fallback
        const data = '0x70a08231' + addr.slice(2).padStart(64, '0');
        const res  = await window.ethereum.request({
          method: 'eth_call',
          params: [{ to: SPECTER_TOKEN, data }, 'latest'],
        });
        const raw = parseInt(res, 16);
        return raw / Math.pow(10, TOKEN_DECIMALS);
      }
    } catch {
      return 0;
    }
  }

  function _reset() {
    state.connected = false;
    state.address   = null;
    state.balance   = 0;
    state.tier      = TIERS[3];
    state.chainOk   = false;
    _onChange && _onChange(state);
  }

  async function connect() {
    if (!window.ethereum) {
      alert('No wallet detected. Install MetaMask or Coinbase Wallet.');
      return;
    }

    _onChange && _onChange({ ...state, connecting: true });

    try {
      // Step 1 — request accounts (opens MetaMask popup)
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (e) {
        _reset(); return; // user rejected or popup blocked
      }
      if (!accounts || !accounts.length) { _reset(); return; }

      state.address   = accounts[0];
      state.connected = true;

      // Step 2 — check chain, switch if needed (skip await to avoid hang)
      let chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== BASE_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            // Chain not added — add it
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID, chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: [BASE_RPC],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
            } catch { /* user rejected add — continue anyway */ }
          }
          // user rejected switch — continue anyway, just mark chainOk false
        }
      }
      chainId = await window.ethereum.request({ method: 'eth_chainId' });
      state.chainOk = chainId === BASE_CHAIN_ID;

      // Step 3 — read balance
      state.balance = await readBalance(state.address);
      state.tier    = getTier(state.balance);

      _onChange && _onChange(state);
    } catch (err) {
      console.error('[SpectorWallet]', err);
      _reset();
    }

    // Register listeners only once to avoid duplicates
    if (!_listenersAdded) {
      _listenersAdded = true;

      window.ethereum.on('accountsChanged', async (accs) => {
        if (!accs.length) { disconnect(); return; }
        state.address = accs[0];
        state.balance = await readBalance(state.address);
        state.tier    = getTier(state.balance);
        _onChange && _onChange(state);
      });

      // On chain change: update flag instead of reloading (avoids race condition on initial connect)
      window.ethereum.on('chainChanged', async (newChainId) => {
        const onBase = newChainId === BASE_CHAIN_ID;
        state.chainOk = onBase;
        if (state.connected) {
          if (!onBase) {
            // User switched away from Base — reload to reset cleanly
            window.location.reload();
          } else {
            // Switched back to Base — refresh balance silently
            state.balance = await readBalance(state.address);
            state.tier    = getTier(state.balance);
            _onChange && _onChange(state);
          }
        }
      });
    }
  }

  function disconnect() {
    state = { connected: false, address: null, balance: 0, tier: TIERS[3], chainOk: false, tokenLive: state.tokenLive };
    _onChange && _onChange(state);
  }

  function hasAccess(minTierName) {
    const order = { 'FREE': 0, 'SCOUT': 1, 'HUNTER': 2, 'PHANTOM': 3 };
    return order[state.tier.name] >= order[minTierName];
  }

  return {
    connect,
    disconnect,
    hasAccess,
    getState: () => ({ ...state }),
    getTiers: () => TIERS,
    onChange: (fn) => { _onChange = fn; },
  };
})();
