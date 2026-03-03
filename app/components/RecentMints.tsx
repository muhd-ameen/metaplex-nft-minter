"use client";

import React, { useState, useEffect } from "react";
import { getRecentMints, type RecentMint } from "../lib/constants";

const SOLANA_NETWORK =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SOLANA_NETWORK) ||
  "devnet";

export default function RecentMints() {
  const [mints, setMints] = useState<RecentMint[]>([]);

  useEffect(() => {
    setMints(getRecentMints());
  }, []);

  // Re-read when a new mint is added or window gains focus
  useEffect(() => {
    const refresh = () => setMints(getRecentMints());
    window.addEventListener("recent-mints-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("recent-mints-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (mints.length === 0) return null;

  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_NETWORK}`;

  return (
    <div className="mt-6 pt-6 border-t border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-2">Recent mints</h3>
      <ul className="space-y-1.5">
        {mints.map((m) => (
          <li key={m.signature} className="flex items-center justify-between gap-2">
            <span className="text-sm text-zinc-300 truncate flex-1" title={m.name}>
              {m.name}
            </span>
            <a
              href={explorerUrl(m.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 shrink-0"
            >
              View tx
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
