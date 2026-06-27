import React, { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [provider, setProvider] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask");
        return;
      }

      setIsConnecting(true);

      const accs = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });

      const ethersProvider = new ethers.BrowserProvider(window.ethereum);

      setAccounts(accs);
      setAccount(accs[0]);
      setProvider(ethersProvider);
    } catch (err) {
      console.error("Wallet connection failed:", err?.message || "Unknown error");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setAccounts([]);
    setProvider(null);
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;

      const accs = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accs.length > 0) {
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);
        setAccounts(accs);
        setAccount(accs[0]);
        setProvider(ethersProvider);
      }
    };

    checkConnection();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accs) => {
      if (accs.length === 0) {
        disconnect();
      } else {
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);
        setAccounts(accs);
        setAccount(accs[0]);
        setProvider(ethersProvider); 
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        accounts,
        provider,
        connect,
        disconnect,
        isConnecting,
        setAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);