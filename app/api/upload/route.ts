import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/upload
 *
 * Receives FormData with:
 * - file: the NFT image
 * - name: NFT name
 * - description: NFT description
 *
 * Steps:
 * 1. Upload image to Pinata IPFS → get image CID
 * 2. Build metadata JSON with IPFS image URL
 * 3. Upload metadata JSON to Pinata → get metadata CID
 * 4. Return metadata URI to client for minting
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string | null;
        const description = formData.get("description") as string | null;
        const attributesRaw = formData.get("attributes") as string | null;

        // Validate required fields
        if (!file || !name || !description) {
            return NextResponse.json(
                { error: "Missing required fields: file, name, description" },
                { status: 400 }
            );
        }

        const pinataJwt = process.env.PINATA_JWT;
        if (!pinataJwt || pinataJwt === "your_pinata_jwt_here") {
            return NextResponse.json(
                { error: "Pinata JWT not configured. Add PINATA_JWT to .env.local" },
                { status: 500 }
            );
        }

        const gateway =
            process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud";

        // ──────────────────────────────────────────────
        // Step 1: Upload image to Pinata
        // ──────────────────────────────────────────────
        const imageFormData = new FormData();
        imageFormData.append("file", file);

        const imageUploadRes = await fetch(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${pinataJwt}`,
                },
                body: imageFormData,
            }
        );

        if (!imageUploadRes.ok) {
            const errorText = await imageUploadRes.text();
            console.error("Pinata image upload failed:", errorText);
            return NextResponse.json(
                { error: "Failed to upload image to IPFS" },
                { status: 500 }
            );
        }

        const imageData = await imageUploadRes.json();
        const imageCid = imageData.IpfsHash;
        const imageUrl = `${gateway}/ipfs/${imageCid}`;

        // Parse optional attributes (array of { trait_type, value })
        let attributes: { trait_type: string; value: string }[] = [];
        if (attributesRaw && attributesRaw.trim()) {
            try {
                const parsed = JSON.parse(attributesRaw) as unknown;
                if (Array.isArray(parsed)) {
                    attributes = parsed.filter(
                        (a): a is { trait_type: string; value: string } =>
                            a != null &&
                            typeof a === "object" &&
                            typeof (a as { trait_type?: string }).trait_type === "string" &&
                            typeof (a as { value?: string }).value === "string"
                    );
                }
            } catch {
                // ignore invalid JSON
            }
        }

        // ──────────────────────────────────────────────
        // Step 2: Build metadata JSON
        // ──────────────────────────────────────────────
        const metadata = {
            name,
            description,
            image: imageUrl,
            attributes,
            properties: {
                files: [
                    {
                        uri: imageUrl,
                        type: file.type,
                    },
                ],
                category: "image",
            },
        };

        // ──────────────────────────────────────────────
        // Step 3: Upload metadata JSON to Pinata
        // ──────────────────────────────────────────────
        const metadataUploadRes = await fetch(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${pinataJwt}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    pinataContent: metadata,
                    pinataMetadata: {
                        name: `${name}-metadata.json`,
                    },
                }),
            }
        );

        if (!metadataUploadRes.ok) {
            const errorText = await metadataUploadRes.text();
            console.error("Pinata metadata upload failed:", errorText);
            return NextResponse.json(
                { error: "Failed to upload metadata to IPFS" },
                { status: 500 }
            );
        }

        const metadataData = await metadataUploadRes.json();
        const metadataCid = metadataData.IpfsHash;
        const metadataUri = `${gateway}/ipfs/${metadataCid}`;

        // Return the metadata URI for the client to use during minting
        return NextResponse.json({
            metadataUri,
            imageUrl,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Internal server error during upload" },
            { status: 500 }
        );
    }
}
