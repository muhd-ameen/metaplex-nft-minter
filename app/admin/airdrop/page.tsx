"use client";

/**
 * Admin-only Batch Airdrop: mint Attendance NFTs to multiple wallets.
 * Renders only when connected wallet === NEXT_PUBLIC_ADMIN_WALLET.
 */

import React, { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "../../components/UmiProvider";
import { mintAttendanceNft } from "../../lib/mintToWallet";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "../../lib/constants";

const ADMIN_WALLET = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ADMIN_WALLET : "";
const SOLANA_NETWORK =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_NETWORK) || "devnet";
const APP_NAME = "Solana NFT Minter";

type RowStatus = "pending" | "success" | "failed";

type ResultRow = {
  wallet: string;
  status: RowStatus;
  signature: string | null;
  error: string | null;
};

function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}

export default function AdminAirdropPage() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const umi = useUmi();

  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [walletList, setWalletList] = useState("");
  const [soulbound, setSoulbound] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);

  const isAdmin =
    !!ADMIN_WALLET &&
    !!connected &&
    !!publicKey &&
    publicKey.toBase58() === ADMIN_WALLET;

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(`Invalid type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
      setImageFile(null);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(`Max size ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`);
      setImageFile(null);
      return;
    }
    setImageFile(file);
  }, []);

  const runAirdrop = useCallback(async () => {
    if (!isAdmin || !publicKey || !imageFile || !eventName.trim() || !eventDescription.trim()) return;

    const rawWallets = walletList
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const wallets = rawWallets.filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    });

    if (wallets.length === 0) {
      setResults([{ wallet: "(none)", status: "failed", signature: null, error: "No valid wallet addresses" }]);
      return;
    }

    setRunning(true);
    setProgress({ current: 0, total: wallets.length });
    setResults(wallets.map((wallet) => ({ wallet, status: "pending" as RowStatus, signature: null, error: null })));

    try {
      // Step 1: Upload image to Pinata
      const imageFormData = new FormData();
      imageFormData.append("file", imageFile);

      const imageRes = await fetch("/api/upload", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append("file", imageFile);
          fd.append("name", eventName.trim());
          fd.append("description", eventDescription.trim());
          const attributes = [
            { trait_type: "Event Type", value: "Attendance" },
            { trait_type: "Issued By", value: APP_NAME },
          ];
          fd.append("attributes", JSON.stringify(attributes));
          return fd;
        })(),
      });

      if (!imageRes.ok) {
        const data = await imageRes.json();
        throw new Error(data.error || "Failed to upload to IPFS");
      }

      const { metadataUri: uri } = await imageRes.json();
      setMetadataUri(uri);

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const signAndSend = async (tx: Parameters<typeof sendTransaction>[0]) => {
        if (!sendTransaction) throw new Error("Wallet not ready");
        return sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
      };

      for (let i = 0; i < wallets.length; i++) {
        setProgress({ current: i + 1, total: wallets.length });
        const wallet = wallets[i];

        const result = await mintAttendanceNft({
          umi,
          wallet,
          name: eventName.trim(),
          metadataUri: uri,
          soulbound,
          connection,
          authorityPublicKey: publicKey,
          signAndSendTransaction: signAndSend,
        });

        setResults((prev) =>
          prev.map((row) =>
            row.wallet === wallet
              ? result.success
                ? { ...row, status: "success" as RowStatus, signature: result.signature, error: null }
                : { ...row, status: "failed" as RowStatus, signature: null, error: result.error }
              : row
          )
        );

        if (i < wallets.length - 1) await delay(1000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResults((prev) =>
        prev.map((row) =>
          row.status === "pending"
            ? { ...row, status: "failed" as RowStatus, error: message }
            : row
        )
      );
    } finally {
      setRunning(false);
    }
  }, [
    isAdmin,
    publicKey,
    imageFile,
    eventName,
    eventDescription,
    walletList,
    soulbound,
    umi,
    connection,
    sendTransaction,
  ]);

  if (!ADMIN_WALLET) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 flex items-center justify-center">
        <p className="text-amber-400">NEXT_PUBLIC_ADMIN_WALLET is not set.</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 flex items-center justify-center">
        <p className="text-amber-400">Connect your wallet to access the admin page.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 flex items-center justify-center">
        <p className="text-red-400 font-medium">Unauthorized</p>
        <p className="text-zinc-500 text-sm mt-1">Only the admin wallet can access this page.</p>
      </div>
    );
  }

  const canStart =
    eventName.trim() &&
    eventDescription.trim() &&
    imageFile &&
    walletList.trim() &&
    !running &&
    !imageError;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-white mb-2">Admin — Batch Airdrop</h1>
        <p className="text-zinc-500 text-sm mb-8">Mint Attendance NFTs to multiple wallets.</p>

        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. DevCon 2025"
              maxLength={100}
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              disabled={running}
            />
            <p className="mt-1 text-xs text-zinc-500">
              On-chain display is truncated to 32 characters; full name is stored in metadata.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Event Description</label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Describe the event..."
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
              disabled={running}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Event Image (max 5MB)</label>
            <input
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={handleImageChange}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-200"
              disabled={running}
            />
            {imageError && <p className="mt-1 text-sm text-red-400">{imageError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Wallet Addresses (one per line)</label>
            <textarea
              value={walletList}
              onChange={(e) => setWalletList(e.target.value)}
              placeholder="7xKX...&#10;9pQm..."
              rows={6}
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm resize-y"
              disabled={running}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soulbound}
              onChange={(e) => setSoulbound(e.target.checked)}
              disabled={running}
              className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm text-zinc-400">Make Non-Transferable (Soulbound)</span>
          </label>

          <button
            type="button"
            onClick={runAirdrop}
            disabled={!canStart}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700"
          >
            {running ? `Minting ${progress.current} / ${progress.total}...` : "Mint & Airdrop"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-700 text-sm font-medium text-zinc-300">
              Results
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-700">
                    <th className="px-4 py-2 font-medium">Wallet</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Tx Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800 last:border-0">
                      <td className="px-4 py-2 font-mono text-zinc-400 truncate max-w-[200px]" title={row.wallet}>
                        {row.wallet}
                      </td>
                      <td className="px-4 py-2">
                        {row.status === "pending" && (
                          <span className="text-amber-400">Pending</span>
                        )}
                        {row.status === "success" && (
                          <span className="text-emerald-400">Success</span>
                        )}
                        {row.status === "failed" && (
                          <span className="text-red-400" title={row.error ?? undefined}>
                            Failed {row.error ? `— ${row.error}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {row.signature ? (
                          <a
                            href={explorerTxUrl(row.signature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 truncate max-w-[120px] inline-block"
                          >
                            {row.signature.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
