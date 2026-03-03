/** localStorage key for recent mint history */
export const RECENT_MINTS_KEY = "metaplex-nft-minter-recent";

/** Max image file size (5 MB) */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

/** Max recent mints to keep */
export const RECENT_MINTS_LIMIT = 10;

export type RecentMint = {
  signature: string;
  mintAddress: string;
  name: string;
  timestamp: number;
};

export function getRecentMints(): RecentMint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_MINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentMint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentMint(mint: RecentMint): void {
  const list = getRecentMints();
  list.unshift(mint);
  const trimmed = list.slice(0, RECENT_MINTS_LIMIT);
  localStorage.setItem(RECENT_MINTS_KEY, JSON.stringify(trimmed));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("recent-mints-updated"));
  }
}
