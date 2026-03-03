"use client";

import React, { createContext, useContext, useMemo } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { Umi } from "@metaplex-foundation/umi";

/**
 * UmiContext
 * Provides a Umi instance throughout the app.
 * Umi is Metaplex's framework for interacting with Solana programs.
 */
const UmiContext = createContext<Umi | null>(null);

/**
 * useUmi hook
 * Access the Umi instance from any child component.
 * Throws if used outside of UmiProvider.
 */
export function useUmi(): Umi {
    const umi = useContext(UmiContext);
    if (!umi) {
        throw new Error("useUmi must be used within a UmiProvider");
    }
    return umi;
}

/**
 * UmiProvider
 * Creates a Umi instance connected to Devnet, with:
 * - mplTokenMetadata plugin (for createNft)
 * - walletAdapterIdentity (bridges Solana wallet adapter → Umi signer)
 */
export default function UmiProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const wallet = useWallet();
    const { connection } = useConnection();

    const umi = useMemo(() => {
        const endpoint =
            process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

        // Create Umi instance with default plugins and token metadata support
        const umiInstance = createUmi(endpoint).use(mplTokenMetadata());

        // If wallet is connected, attach it as the Umi identity/signer
        if (wallet.publicKey) {
            umiInstance.use(walletAdapterIdentity(wallet));
        }

        return umiInstance;
    }, [wallet, connection]);

    return <UmiContext.Provider value={umi}>{children}</UmiContext.Provider>;
}
