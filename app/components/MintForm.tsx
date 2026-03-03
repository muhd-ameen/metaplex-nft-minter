"use client";

import React, { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "./UmiProvider";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  addRecentMint,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "../lib/constants";

const SOLANA_NETWORK =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SOLANA_NETWORK) ||
  "devnet";

type AttributeRow = { trait_type: string; value: string };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 px-2 py-1 text-xs rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

/**
 * MintForm
 * Handles the entire NFT minting flow with validation, attributes,
 * and success state (mint address, copy, recent mints).
 */
export default function MintForm() {
  const { publicKey, connected } = useWallet();
  const umi = useUmi();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [attributes, setAttributes] = useState<AttributeRow[]>([
    { trait_type: "", value: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [mintedImageUrl, setMintedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setImageError(null);
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setImageError(
          `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
        );
        setImageFile(null);
        setImagePreview(null);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setImageError(
          `File too large. Max size is ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`
        );
        setImageFile(null);
        setImagePreview(null);
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    },
    []
  );

  const addAttribute = useCallback(() => {
    setAttributes((prev) => [...prev, { trait_type: "", value: "" }]);
  }, []);

  const updateAttribute = useCallback(
    (index: number, field: "trait_type" | "value", value: string) => {
      setAttributes((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, [field]: value } : row
        )
      );
    },
    []
  );

  const removeAttribute = useCallback((index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMint = useCallback(async () => {
    if (!connected || !publicKey || !imageFile || !name.trim() || !description.trim())
      return;
    if (imageError) return;

    setLoading(true);
    setError(null);
    setTxSignature(null);
    setMintAddress(null);
    setMintedImageUrl(null);

    try {
      setStatus("Uploading to IPFS...");

      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      const validAttrs = attributes.filter(
        (a) => a.trait_type.trim() && a.value.trim()
      );
      if (validAttrs.length > 0) {
        formData.append("attributes", JSON.stringify(validAttrs));
      }

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || "Failed to upload to IPFS");
      }

      const { metadataUri, imageUrl } = await uploadRes.json();

      setStatus("Minting NFT on Solana...");

      const mint = generateSigner(umi);
      const tx = await createNft(umi, {
        mint,
        name: name.trim(),
        uri: metadataUri,
        sellerFeeBasisPoints: 0,
      }).sendAndConfirm(umi);

      const signature = base58.deserialize(tx.signature)[0];
      const mintAddr = String(mint.publicKey);

      setTxSignature(signature);
      setMintAddress(mintAddr);
      setMintedImageUrl(imageUrl);
      setStatus("NFT minted successfully!");

      addRecentMint({
        signature,
        mintAddress: mintAddr,
        name: name.trim(),
        timestamp: Date.now(),
      });
    } catch (err: unknown) {
      console.error("Mint error:", err);
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, [
    connected,
    publicKey,
    imageFile,
    name,
    description,
    attributes,
    imageError,
    umi,
  ]);

  const canMint =
    connected &&
    imageFile &&
    name.trim() &&
    description.trim() &&
    !loading &&
    !imageError;

  const explorerTxUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=${SOLANA_NETWORK}`;
  const explorerMintUrl = (mint: string) =>
    `https://explorer.solana.com/address/${mint}?cluster=${SOLANA_NETWORK}`;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* ── Image Upload ── */}
      <div className="mb-6">
        <label
          htmlFor="image-upload"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          NFT Image
        </label>
        <div
          className="border-2 border-dashed border-zinc-600 rounded-xl p-6 text-center 
                     hover:border-purple-500/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("image-upload")?.click()}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg object-contain"
            />
          ) : (
            <div className="text-zinc-500">
              <svg
                className="mx-auto h-12 w-12 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Click to upload an image</p>
              <p className="text-xs text-zinc-600 mt-1">
                PNG, JPG, GIF, WEBP · Max 5 MB
              </p>
            </div>
          )}
        </div>
        {imageError && (
          <p className="mt-2 text-sm text-red-400">{imageError}</p>
        )}
        <input
          id="image-upload"
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={handleImageChange}
          className="hidden"
        />
      </div>

      {/* ── Name ── */}
      <div className="mb-4">
        <label
          htmlFor="nft-name"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          Name
        </label>
        <input
          id="nft-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome NFT"
          className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl 
                     text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 
                     focus:ring-1 focus:ring-purple-500 transition-all"
        />
      </div>

      {/* ── Description ── */}
      <div className="mb-4">
        <label
          htmlFor="nft-description"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          Description
        </label>
        <textarea
          id="nft-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your NFT..."
          rows={3}
          className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl 
                     text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 
                     focus:ring-1 focus:ring-purple-500 transition-all resize-none"
        />
      </div>

      {/* ── Attributes ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-300">
            Attributes (optional)
          </label>
          <button
            type="button"
            onClick={addAttribute}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {attributes.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={row.trait_type}
                onChange={(e) =>
                  updateAttribute(i, "trait_type", e.target.value)
                }
                placeholder="Trait (e.g. Background)"
                className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateAttribute(i, "value", e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => removeAttribute(i)}
                disabled={attributes.length <= 1}
                className="px-2 text-zinc-500 hover:text-red-400 disabled:opacity-50"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mint Button ── */}
      <button
        onClick={handleMint}
        disabled={!canMint}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
          ${
            canMint
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {status}
          </span>
        ) : !connected ? (
          "Connect Wallet to Mint"
        ) : (
          "Mint NFT"
        )}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ── Success Result ── */}
      {txSignature && (
        <div className="mt-6 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-emerald-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-emerald-400 font-semibold">
              NFT Minted Successfully!
            </h3>
          </div>

          <div>
            <p className="text-xs text-zinc-400 mb-1">Transaction</p>
            <div className="flex items-center flex-wrap gap-1">
              <span className="text-xs text-zinc-300 font-mono break-all bg-zinc-800/50 rounded-lg px-2 py-1.5">
                {txSignature}
              </span>
              <CopyButton text={txSignature} label="Copy tx" />
            </div>
            <a
              href={explorerTxUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 mt-1"
            >
              View on Solana Explorer
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {mintAddress && (
            <div>
              <p className="text-xs text-zinc-400 mb-1">Mint address</p>
              <div className="flex items-center flex-wrap gap-1">
                <span className="text-xs text-zinc-300 font-mono break-all bg-zinc-800/50 rounded-lg px-2 py-1.5">
                  {mintAddress}
                </span>
                <CopyButton text={mintAddress} label="Copy mint" />
              </div>
              <a
                href={explorerMintUrl(mintAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 mt-1"
              >
                View mint on Explorer
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {mintedImageUrl && (
            <div>
              <p className="text-xs text-zinc-400 mb-2">Your NFT</p>
              <img
                src={mintedImageUrl}
                alt={name}
                className="max-h-48 rounded-lg border border-zinc-700"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
