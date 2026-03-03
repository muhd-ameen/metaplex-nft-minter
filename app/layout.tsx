import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletProvider from "./components/WalletProvider";
import UmiProvider from "./components/UmiProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Solana NFT Minter",
  description: "Mint NFTs on Solana Devnet using Metaplex",
};

/**
 * Root Layout
 * Wraps the entire app with:
 * 1. WalletProvider (Solana wallet adapter)
 * 2. UmiProvider (Metaplex Umi framework)
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <WalletProvider>
          <UmiProvider>{children}</UmiProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
