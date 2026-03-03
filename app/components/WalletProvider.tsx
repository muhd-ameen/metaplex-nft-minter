"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

// Default wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * WalletProvider
 * Wraps the app with Solana wallet connection providers.
 * - ConnectionProvider: connects to the Devnet RPC endpoint
 * - WalletProvider: manages wallet adapters (Phantom)
 * - WalletModalProvider: provides the connect/disconnect modal UI
 */
export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read RPC URL from env, fallback to Devnet
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
    []
  );

  // Initialize Phantom wallet adapter
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
