"use client";

/**
 * Admin Batch Airdrop — mint Attendance NFT to a single wallet.
 * Reusable helper: mints NFT to recipient, optionally makes it soulbound.
 */

import type { Umi } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey as toUmiPublicKey, percentAmount } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { METADATA_NAME_MAX_LENGTH } from "./constants";

export type MintAttendanceNftParams = {
  /** Umi instance (with wallet identity set) */
  umi: Umi;
  /** Recipient wallet address (base58) */
  wallet: string;
  /** NFT display name */
  name: string;
  /** Metadata JSON URI (from Pinata) */
  metadataUri: string;
  /** If true, revoke mint and freeze authority so NFT is "locked" (soulbound-style). Note: true non-transferability requires Token-2022; this revokes mint/freeze on the mint account. */
  soulbound: boolean;
  /** Solana connection (for soulbound setAuthority tx) */
  connection: Connection;
  /** Current signer public key (admin) for soulbound revocation */
  authorityPublicKey: SolanaPublicKey;
  /** Sign and send transaction (wallet adapter) */
  signAndSendTransaction: (tx: Transaction) => Promise<string>;
};

export type MintAttendanceNftResult = {
  success: true;
  signature: string;
  mintAddress: string;
} | {
  success: false;
  error: string;
};

/**
 * Mints one Attendance NFT to the given wallet.
 * Uses same metadata URI for all airdrops; name can include edition if desired.
 * On-chain name is truncated to METADATA_NAME_MAX_LENGTH (32); full name lives in IPFS metadata.
 * If soulbound: after mint, revokes MintTokens and FreezeAccount authorities on the mint
 * so no more tokens can be minted and freeze is disabled (soulbound-style lock).
 */
export async function mintAttendanceNft(
  params: MintAttendanceNftParams
): Promise<MintAttendanceNftResult> {
  const {
    umi,
    wallet,
    name,
    metadataUri,
    soulbound,
    connection,
    authorityPublicKey,
    signAndSendTransaction,
  } = params;

  let mint: ReturnType<typeof generateSigner>;

  try {
    // Validate recipient public key
    const tokenOwner = toUmiPublicKey(wallet);

    mint = generateSigner(umi);

    // Metaplex on-chain name is max 32 chars; full name is in IPFS metadata
    const onChainName =
      name.length > METADATA_NAME_MAX_LENGTH
        ? name.slice(0, METADATA_NAME_MAX_LENGTH)
        : name;

    // Mint NFT to recipient: create metadata + mint 1 token to tokenOwner
    const tx = await createNft(umi, {
      mint,
      name: onChainName,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      tokenOwner, // recipient of the airdrop
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    const mintAddress = String(mint.publicKey);

    if (!soulbound) {
      return { success: true, signature, mintAddress };
    }

    // ——— Soulbound: revoke mint and freeze authority on the mint account ———
    // This prevents any future minting and removes freeze capability.
    // Note: Standard SPL Token does not support true "non-transferable"; the holder can still transfer.
    // For true non-transferability you would use Token-2022 with NonTransferable extension.
    try {
      const mintPubkey = new PublicKey(mintAddress);

      const revokeTx = new Transaction().add(
        // Revoke mint authority: no more tokens can ever be minted.
        createSetAuthorityInstruction(
          mintPubkey,
          authorityPublicKey,
          AuthorityType.MintTokens,
          null,
          [],
          TOKEN_PROGRAM_ID
        ),
        // Revoke freeze authority: no one can freeze token accounts.
        createSetAuthorityInstruction(
          mintPubkey,
          authorityPublicKey,
          AuthorityType.FreezeAccount,
          null,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      await signAndSendTransaction(revokeTx);
    } catch (revokeErr: unknown) {
      // Mint succeeded; only the soulbound revoke failed. Don't fail the whole airdrop.
      const revokeMsg = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
      console.warn("Soulbound revoke failed (NFT was minted):", revokeMsg);
    }
    // Return the mint tx signature for Explorer link (user sees the mint).
    return { success: true, signature, mintAddress };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
