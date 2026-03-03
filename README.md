# Metaplex NFT Minter

Mint, view, and transfer NFTs on Solana (Devnet/Mainnet) using Metaplex. Connect a wallet, upload an image and metadata to IPFS, and mint on-chain in one flow.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | [Next.js](https://nextjs.org) 16 (App Router), React 19 |
| **Styling** | Tailwind CSS 4 |
| **Chain** | [Solana](https://solana.com) (`@solana/web3.js`, `@solana/spl-token`) |
| **Wallet** | [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) (Phantom), `@solana/wallet-adapter-react` + `-react-ui` |
| **NFT / Metadata** | [Metaplex Umi](https://github.com/Metaplex-foundation/umi) + [mpl-token-metadata](https://github.com/Metaplex-foundation/mpl-token-metadata) |
| **Storage** | [Pinata](https://pinata.cloud) (IPFS) for images and metadata JSON |

### Providers (app layout)

- **WalletProvider** – `ConnectionProvider` → `WalletProvider` (Phantom) → `WalletModalProvider` for connect/disconnect and RPC endpoint.
- **UmiProvider** – Umi instance with `mplTokenMetadata` and `walletAdapterIdentity` for signing; used for minting and fetching NFTs.

### Main dependencies

```
@metaplex-foundation/mpl-token-metadata  # createNft, fetchAllDigitalAssetByOwner
@metaplex-foundation/umi                 # Umi framework
@metaplex-foundation/umi-bundle-defaults
@metaplex-foundation/umi-signer-wallet-adapters
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets           # PhantomWalletAdapter
@solana/spl-token                       # NFT transfer
@solana/web3.js
next, react, react-dom
tailwindcss
```

---

## Features

- **Mint NFT** – Upload image (PNG/JPG/GIF/WEBP, max 5 MB), name, description, optional attributes → upload to IPFS (Pinata) → mint on Solana via Metaplex.
- **My NFTs** – List NFTs owned by the connected wallet (Metaplex); optional **Transfer** to another address (SPL token transfer).
- **Recent mints** – Last 10 mints in localStorage with “View tx” links.
- **Copy** – Copy transaction signature and mint address after minting.
- **Network** – Badge and explorer links use Devnet or Mainnet from env.

---

## Environment (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `PINATA_JWT` | Yes | Pinata API JWT for IPFS uploads. |
| `NEXT_PUBLIC_RPC_URL` | No | Solana RPC URL (default: Devnet). |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | `devnet` or `mainnet-beta` for explorer links and label. |
| `NEXT_PUBLIC_PINATA_GATEWAY` | No | IPFS gateway base URL for metadata/image URIs. |

---

## Getting started

```bash
git clone <repo-url>
cd solana-nft
npm install
```

Add `.env.local` with at least `PINATA_JWT`, then:

```bash
npm run dev    # http://localhost:3000
npm run build
npm start
```

---

## Project structure (relevant parts)

```
app/
  layout.tsx           # WalletProvider → UmiProvider → children
  page.tsx             # Header, wallet section, MyNFTs, MintForm, RecentMints
  components/
    WalletProvider.tsx # Solana connection + Phantom + modal
    UmiProvider.tsx    # Umi + mplTokenMetadata + wallet signer
    MintForm.tsx       # Image upload, metadata, IPFS → mint
    MyNFTs.tsx         # Fetch owned NFTs, transfer modal
    RecentMints.tsx    # localStorage recent mints list
  api/upload/route.ts  # POST: image + metadata → Pinata → metadata URI
  lib/constants.ts     # Recent mints key, image limits, helpers
```
