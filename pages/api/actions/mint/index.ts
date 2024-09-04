import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as base58 from "bs58";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { NextApiRequest, NextApiResponse } from "next";
import mitt from "next/dist/shared/lib/mitt";

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
}

const nftMetadata: NFTMetadata = {
  name: "My NFT",
  description: "This is a sample NFT",
  image: "https://localhost:3000/Catoff-128.png",
};

const isEligible = (wallet: PublicKey): boolean => {
  return true;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("Request received:", req.method, req.url);
  if (req.method === "GET") {
    try {
      const requestUrl = new URL(
        req.url as string,
        `https://${req.headers.host}`
      );
      const wallet = new PublicKey(requestUrl.searchParams.get("wallet")!);

      if (!isEligible(wallet)) {
        return res
          .status(400)
          .json({ error: "User is not eligible to mint NFT" });
      }

      const payload = {
        title: "Mint NFT",
        icon: new URL("/Catoff-128.png", requestUrl.origin).toString(),
        description: "Mint a sample NFT to your Solana wallet",
        label: "Mint NFT",
        links: {
          actions: [
            {
              label: "Mint NFT",
              href: `/api/actions/mint?wallet=${wallet.toBase58()}`,
            },
          ],
        },
      };

      return res.status(200).json(payload);
    } catch (err) {
      console.log(err);
      let message = "An unknown error occurred";
      if (typeof err === "string") message = err;
      return res.status(400).json({ error: message });
    }
  } else if (req.method === "POST") {
    try {
      const wallet = new PublicKey(req.body.wallet);
      // console.log(walletPublicKey);

      if (!isEligible(wallet)) {
        return res
          .status(400)
          .json({ error: "User is not eligible to mint NFT" });
      }

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      // console.log(process.env.ESCROW_PVT_KEY);

      const privatekey = process.env.ESCROW_PVT_KEY || "";

      const mintAuthoritySecretKey = base58.decode(process.env.ESCROW_PVT_KEY!);
      const mintAuthority = Keypair.fromSecretKey(mintAuthoritySecretKey);
      // const mintAuthority = Keypair.generate();
      console.log("111111");
      // const mintPublicKey = mintAuthority.publicKey;
      // const mint = await createMint(
      //   connection,
      //   mintAuthority,
      //   mintAuthority.publicKey,
      //   null,
      //   0
      // );
      const mint = new PublicKey("YyKQDFgiByskEahxDoGz2BA4u4ScpAstfghxnfCNnw5");
      console.log(mint.toString());
      // Fund the mint authority
      // const airdropSignature = await connection.requestAirdrop(
      //   mintAuthority.publicKey,
      //   LAMPORTS_PER_SOL
      // );
      // await connection.confirmTransaction(airdropSignature);

      console.log("connection", connection);
      console.log("mintAuthority", mintAuthority);
      console.log("mintPublicKey", mint);
      console.log("walletPublicKey", wallet);
      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        wallet
      );
      console.log("User Token Account:", userTokenAccount.address.toBase58());
      const mintToIx = createMintToInstruction(
        mint,
        userTokenAccount.address,
        mintAuthority.publicKey,
        1,
        [],
        TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction().add(mintToIx);

      transaction.feePayer = mintAuthority.publicKey;
      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [mintAuthority]
      );

      const payload = {
        transaction: signature,
        message: `Minted NFT to ${wallet.toBase58()}`,
      };

      return res.status(200).json(payload);
    } catch (err) {
      console.log(err);
      let message = "An unknown error occurred";
      if (typeof err === "string") message = err;
      return res.status(400).json({ error: message });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
