"use client";

import React, { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "./UmiProvider";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

/**
 * MintForm
 * Handles the entire NFT minting flow:
 * 1. Image upload + preview
 * 2. Metadata input (name, description)
 * 3. Upload to IPFS via Pinata (server-side API route)
 * 4. Mint NFT on Solana Devnet via Metaplex Umi
 * 5. Display results (tx signature, explorer link, NFT image)
 */
export default function MintForm() {
    const { publicKey, connected } = useWallet();
    const umi = useUmi();

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Process state
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    // Result state
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [mintedImageUrl, setMintedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle image file selection
     * Creates a preview URL and stores the file in state
     */
    const handleImageChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                setImageFile(file);
                const reader = new FileReader();
                reader.onload = () => setImagePreview(reader.result as string);
                reader.readAsDataURL(file);
            }
        },
        []
    );

    /**
     * Handle the full mint process
     */
    const handleMint = useCallback(async () => {
        if (!connected || !publicKey || !imageFile || !name || !description) return;

        setLoading(true);
        setError(null);
        setTxSignature(null);
        setMintedImageUrl(null);

        try {
            // ── Step 1: Upload image + metadata to IPFS via our API route ──
            setStatus("Uploading to IPFS...");

            const formData = new FormData();
            formData.append("file", imageFile);
            formData.append("name", name);
            formData.append("description", description);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json();
                throw new Error(errorData.error || "Failed to upload to IPFS");
            }

            const { metadataUri, imageUrl } = await uploadRes.json();

            // ── Step 2: Mint NFT on Solana using Metaplex Umi ──
            setStatus("Minting NFT on Solana...");

            // Generate a new keypair for the NFT mint account
            const mint = generateSigner(umi);

            // Create the NFT using mpl-token-metadata
            const tx = await createNft(umi, {
                mint,
                name,
                uri: metadataUri,
                sellerFeeBasisPoints: percentAmount(5), // 5% royalty
            }).sendAndConfirm(umi);

            // Decode the transaction signature from bytes to base58
            const signature = base58.deserialize(tx.signature)[0];

            // ── Step 3: Show results ──
            setTxSignature(signature);
            setMintedImageUrl(imageUrl);
            setStatus("NFT minted successfully!");
        } catch (err: unknown) {
            console.error("Mint error:", err);
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            setError(message);
            setStatus("");
        } finally {
            setLoading(false);
        }
    }, [connected, publicKey, imageFile, name, description, umi]);

    // Check if form is ready to submit
    const canMint = connected && imageFile && name.trim() && description.trim() && !loading;

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
                            <p className="text-xs text-zinc-600 mt-1">PNG, JPG, GIF, WEBP</p>
                        </div>
                    )}
                </div>
                <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                />
            </div>

            {/* ── Name Input ── */}
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

            {/* ── Description Input ── */}
            <div className="mb-6">
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

            {/* ── Mint Button ── */}
            <button
                onClick={handleMint}
                disabled={!canMint}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
          ${canMint
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

            {/* ── Error Message ── */}
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
                            className="h-5 w-5 text-emerald-400"
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

                    {/* Transaction signature */}
                    <div>
                        <p className="text-xs text-zinc-400 mb-1">Transaction Signature</p>
                        <p className="text-xs text-zinc-300 font-mono break-all bg-zinc-800/50 rounded-lg p-2">
                            {txSignature}
                        </p>
                    </div>

                    {/* Explorer link */}
                    <a
                        href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        View on Solana Explorer
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                        </svg>
                    </a>

                    {/* Minted NFT image */}
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
