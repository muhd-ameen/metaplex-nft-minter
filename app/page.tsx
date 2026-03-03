"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import MintForm from "./components/MintForm";

/**
 * Home Page
 * Main page with wallet connection and NFT minting form.
 * Clean, centered card layout on a dark gradient background.
 */
export default function Home() {
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Avoid WalletNotReadyError: only render wallet UI after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs text-purple-300 font-medium">
              Solana Devnet
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            NFT Minter
          </h1>
          <p className="text-zinc-400 text-sm">
            Mint your NFT on Solana in seconds
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {/* Wallet Section */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Wallet</p>
              {connected && publicKey ? (
                <p className="text-sm text-zinc-300 font-mono">
                  {publicKey.toBase58().slice(0, 4)}...
                  {publicKey.toBase58().slice(-4)}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">Not connected</p>
              )}
            </div>
            {mounted ? (
              <WalletMultiButton
                style={{
                  background: connected
                    ? "rgba(39, 39, 42, 0.8)"
                    : "linear-gradient(to right, #7c3aed, #4f46e5)",
                  borderRadius: "0.75rem",
                  fontSize: "0.8rem",
                  height: "2.5rem",
                  padding: "0 1rem",
                }}
              />
            ) : (
              <div
                className="rounded-xl bg-zinc-800 animate-pulse"
                style={{ width: "10rem", height: "2.5rem" }}
                aria-hidden
              />
            )}
          </div>

          {/* Mint Form */}
          {connected ? (
            <MintForm />
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800 mb-4">
                <svg
                  className="h-8 w-8 text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm">
                Connect your wallet to start minting
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          Powered by Metaplex &middot; Solana Devnet
        </p>
      </div>
    </main>
  );
}
