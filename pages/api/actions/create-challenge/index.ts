import {
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import * as anchor from "@project-serum/anchor";
import nextCors from "nextjs-cors";
import fetch from "node-fetch";
import { ApiResponse, IChallengeById, PARTICIPATION_TYPE } from "./types";
import axios from "axios";
import { getAssociatedTokenAccount, web3Constants, IWeb3Participate, initWeb3 } from './helper'
import { PublicKey, SystemProgram } from "@solana/web3.js";

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const participationtype = req.query as unknown as PARTICIPATION_TYPE;

    const baseHref = new URL(
      `/api/actions/join-challenge`,
      `http://${req.headers.host}`
    ).toString();

    console.log(baseHref);

    const actions = [
      {
        "label": "Create Challenge", // button text
        "href": `/api/create-challenge?participationtype=${participationtype}&wager={wager}&target={target}&startTime={startTime}&duration={duration}&name={name}`,
        "parameters": [
          {
            "name": "name", // field name
            "label": "Name your dare" // text input placeholder
          },
          {
            "name": "wager", // field name
            "label": "Wager amount in SOL" // text input placeholder
          },
          {
            "name": "target", // field name
            "label": "Target" // text input placeholder
          },
          {
            "name": "startTime", // field name
            "label": "Start the challenge in? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
          {
            "name": "duration", // field name
            "label": "Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
        ]
      }
    ];

    const iconUrl = new URL(
      "/logo.png",
      `http://${req.headers.host}`
    ).toString();

    const payload: ActionGetResponse = {
      title: "Dare on blinks",
      icon: iconUrl,
      type: "action",
      description: "To settle you X beef now, dare your friends or foes!",
      label: "Join",
      links: {
        actions: actions,
      },
    };

    console.log("Payload constructed successfully:", payload);

    res.status(200).json(payload);
  } catch (err) {
    console.error("Error in getHandler:", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // const account = new PublicKey(req.body?.account);
    // if (!account) {
    //   console.error("account not found in body")
    //   res.status(400).json({ error: 'Invalid "account" provided' });
    // }
    // let challengeId: number = Number(req.query.challengeId);
    // console.log("Query Challenge ID:", challengeId);

    // if (typeof challengeId === "undefined") {
    //   console.error("Challenge ID is undefined");
    //   return res.status(400).json({ error: '"challengeId" is required' });
    // }

    // const challengeResponse = await axios.get(
    //   `https://stagingapi5.catoff.xyz/challenge/${challengeId}`,
    //   {
    //     headers: {
    //       accept: "application/json",
    //     },
    //   }
    // );
    // if (!challengeResponse.data.success) {
    //   throw new Error("Failed to fetch challenge details");
    // }

    // const challenge: IChallengeById = challengeResponse.data.data;

    // const { program, connection, wallet } = await initWeb3();

    // let ixs: web3.TransactionInstruction[] = [];

    // let web3Participate: IWeb3Participate;
    // let userTokenAccount: PublicKey | null = web3Constants.escrowUSDCTokenAccount;
    // let escrowTokenAccount: PublicKey | null = web3Constants.escrowUSDCTokenAccount;
    // let TOKEN_MINT_ADDRESS: PublicKey = web3Constants.USDC_MINT_ADDRESS

    // if(challenge.Currency === "SOL"){
    //   web3Participate = {
    //     wallet,
    //     connection,
    //     playerId: new BN(0),
    //     challengeId: new BN(challenge.ChallengeID),
    //     amount: new BN(challenge.Wager * 10**9),
    //     currency: challenge.Currency,
    //   }

    //   userTokenAccount = await getAssociatedTokenAccount(
    //     connection,
    //     web3Constants.escrowAccountPublicKey,
    //     TOKEN_MINT_ADDRESS,
    //   )

    //   escrowTokenAccount = await getAssociatedTokenAccount(
    //     connection,
    //     web3Constants.escrowAccountPublicKey,
    //     TOKEN_MINT_ADDRESS,
    //   )

    // } else {
    //   switch (challenge.Currency) {
    //     case "USDC":
    //       TOKEN_MINT_ADDRESS = web3Constants.USDC_MINT_ADDRESS;
    //       break;
    //     case "BONK":
    //       TOKEN_MINT_ADDRESS = web3Constants.BONK_MINT_ADDRESS;
    //       break;
    //     case "SEND":
    //       TOKEN_MINT_ADDRESS = web3Constants.SEND_MINT_ADDRESS;
    //       break;
    //     default:
    //       break;
    //   }

    //   web3Participate = {
    //     wallet,
    //     connection,
    //     playerId: new BN(0),
    //     challengeId: new BN(challenge.ChallengeID),
    //     amount: new BN(challenge.Wager),
    //     currency: challenge.Currency,
    //   }  

    //   userTokenAccount = await getAssociatedTokenAccount(
    //     connection,
    //     account,
    //     TOKEN_MINT_ADDRESS,
    //   )

    //   escrowTokenAccount = await getAssociatedTokenAccount(
    //     connection,
    //     web3Constants.escrowAccountPublicKey,
    //     TOKEN_MINT_ADDRESS,
    //   )
    // }
    // if (!userTokenAccount) {
    //   throw new Error("user Token account not found")
    // }


    // if (!escrowTokenAccount) {
    //   throw new Error("escrow Token account not found")
    // }

    // console.log("Participate Instruction Accounts:", {
    //   user: account.toString(),
    //   userTokenAccount: userTokenAccount.toString(),
    //   escrowTokenAccount: escrowTokenAccount.toString(),
    //   escrowAccount: web3Constants.escrowAccountPublicKey.toString(),
    //   systemProgram: SystemProgram.programId.toString(),
    //   tokenProgram: web3Constants.TOKEN_PROGRAM_ID.toString(),
    // });    

    // const instruction = await program.methods
    //   .participate(web3Participate.currency, web3Participate.amount, web3Participate.challengeId, web3Participate.playerId, { joinChallenge: {} })
    //   .accounts({
    //     user: new PublicKey(account),
    //     userTokenAccount: userTokenAccount,
    //     escrowTokenAccount: escrowTokenAccount,
    //     escrowAccount: web3Constants.escrowAccountPublicKey,
    //     systemProgram: SystemProgram.programId,
    //     tokenProgram: web3Constants.TOKEN_PROGRAM_ID,
    //   })
    //   .instruction();
    // ixs.push(instruction);
    // const { blockhash } = await connection.getLatestBlockhash();
    // console.log("blockhash: ", blockhash);
    // console.log("ins: ", instruction)
    // const transaction = new web3.VersionedTransaction(
    //   new web3.TransactionMessage({
    //     payerKey: new PublicKey(account),
    //     recentBlockhash: blockhash,
    //     instructions: ixs,
    //   }).compileToV0Message()
    // );
    // const serializedTransaction = transaction.serialize();
    // const base64Transaction = Buffer.from(serializedTransaction).toString(
    //   "base64"
    // );
    const message = `Your bet has been placed!`;
    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error("An error occurred", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await nextCors(req, res, {
    methods: ["GET", "POST"],
    origin: "*", // Change this to your frontend URL in production
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  if (req.method === "GET") {
    await getHandler(req, res);
  } else if (req.method === "POST") {
    await postHandler(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
