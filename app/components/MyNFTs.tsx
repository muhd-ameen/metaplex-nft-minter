"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "./UmiProvider";
import { fetchAllDigitalAssetByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as toUmiPublicKey } from "@metaplex-foundation/umi";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

const SOLANA_NETWORK =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SOLANA_NETWORK) ||
  "devnet";

type NFTWithMeta = {
  mint: string;
  name: string;
  uri: string;
  imageUrl: string | null;
};

function TransferModal({
  nft,
  onClose,
  onSuccess,
}: {
  nft: NFTWithMeta;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransfer = useCallback(async () => {
    if (!publicKey || !destination.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const mintPubkey = new PublicKey(nft.mint);
      const destPubkey = new PublicKey(destination.trim());
      const ownerAta = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        mintPubkey,
        destPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = new Transaction();

      try {
        const destAtaInfo = await connection.getAccountInfo(destAta);
        if (!destAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              destAta,
              destPubkey,
              mintPubkey
            )
          );
        }
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            destAta,
            destPubkey,
            mintPubkey
          )
        );
      }

      tx.add(
        createTransferInstruction(
          ownerAta,
          destAta,
          publicKey,
          1,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const sig = await sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });
      console.log("Transfer tx:", sig);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    publicKey,
    destination,
    nft.mint,
    connection,
    sendTransaction,
    onSuccess,
    onClose,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Transfer NFT</h3>
        <p className="text-sm text-zinc-400 mb-2">{nft.name}</p>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Recipient wallet address"
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 mb-4"
        />
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={loading || !destination.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyNFTs() {
  const { publicKey, connected } = useWallet();
  const umi = useUmi();
  const [nfts, setNfts] = useState<NFTWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferNft, setTransferNft] = useState<NFTWithMeta | null>(null);

  const fetchNfts = useCallback(async () => {
    if (!connected || !publicKey) {
      setNfts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const owner = toUmiPublicKey(publicKey.toBase58());
      const assets = await fetchAllDigitalAssetByOwner(umi, owner);
      const withMeta: NFTWithMeta[] = await Promise.all(
        assets.map(async (a) => {
          const mint = String(a.metadata.mint);
          const name = a.metadata.name;
          const uri = a.metadata.uri;
          let imageUrl: string | null = null;
          try {
            const res = await fetch(uri);
            if (res.ok) {
              const json = (await res.json()) as { image?: string };
              imageUrl = json.image ?? null;
            }
          } catch {
            // ignore
          }
          return { mint, name, uri, imageUrl };
        })
      );
      setNfts(withMeta);
    } catch (err: unknown) {
      console.error("Fetch NFTs error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load NFTs"
      );
      setNfts([]);
    } finally {
      setLoading(false);
    }
  }, [umi, connected, publicKey]);

  useEffect(() => {
    fetchNfts();
  }, [fetchNfts]);

  if (!connected) return null;

  const explorerMint = (mint: string) =>
    `https://explorer.solana.com/address/${mint}?cluster=${SOLANA_NETWORK}`;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">My NFTs</h2>
          <button
            type="button"
            onClick={fetchNfts}
            disabled={loading}
            className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-400 mb-2">{error}</p>
        )}
        {loading && nfts.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">
            No NFTs in this wallet
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {nfts.map((nft) => (
              <div
                key={nft.mint}
                className="bg-zinc-800/80 rounded-xl overflow-hidden border border-zinc-700"
              >
                <a
                  href={explorerMint(nft.mint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square bg-zinc-900"
                >
                  {nft.imageUrl ? (
                    <img
                      src={nft.imageUrl}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                      No image
                    </div>
                  )}
                </a>
                <div className="p-2">
                  <p className="text-xs text-zinc-300 truncate" title={nft.name}>
                    {nft.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTransferNft(nft)}
                    className="mt-1 w-full text-xs py-1.5 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {transferNft && (
        <TransferModal
          nft={transferNft}
          onClose={() => setTransferNft(null)}
          onSuccess={fetchNfts}
        />
      )}
    </>
  );
}
