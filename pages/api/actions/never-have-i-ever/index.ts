import { ActionGetResponse, LinkedAction } from "@solana/actions";
import * as web3 from "@solana/web3.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import { initWeb3 } from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BlinksightsClient } from "blinksights-sdk";
import logger from "../../common/logger";
import { getAnswerPercentage, storeNeverHaveIEverResponse } from "./helper";
import { NeverHaveIEverResponse } from "./types";

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = req.url ?? "";

    
    const baseHref = new URL(`/api/actions/never-have-i-ever`, `https://${req.headers.host}`).toString();
    const actions: LinkedAction[] = [
      {
        type: 'post',
        label: 'Submit',  
        href: `${baseHref}?method={method}&value={value}`,
        parameters: [
          {
            name: "question1",
            label: "Never Have I Ever said a baby was cute when it was obviously ugly!",
            type: "radio",
            options: [
              {
                label: "I Have",
                value: "I Have",
                
              },
              {
                label: "I Have Never",
                value: "I Have Never",
              },
            ],
          },
          {
            name: "question2",
            label: "What do you think the majority of people would've chosen for this question?",
            type: "radio",
            options: [
              {
                label: "I Have",
                value: "I Have",
              },
              {
                label: "I Have Never",
                value: "I Have Never",
              },
            ],
          },
        ],
      },
    ];
    
      

    const payload = await blinksightsClient.createActionGetResponseV1(requestUrl, {
      title: `🚀 Never Have I Ever`,
      icon: `https://${req.headers.host}/dare.png`,
      type: "action",
      description: `🕶️ Spill the tea, no holding back! Never Have I Ever—where we find out who's been naughty, who's been nice, and who’s just plain shady. Get ready to confess or play it cool… but remember, the truth always comes out! 😏✨`,
      label: "Choose your answer",
      links: { actions }
    });

    if (!payload) {
      logger.error("Payload construction failed");
      return res.status(400).json({ error: "Payload is incorrect" });
    }

    await blinksightsClient.trackRenderV1(requestUrl, payload);
    res.status(200).json(payload);
  } catch (err) {
    logger.error("Error in getHandler: %s", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { account, answer1, answer2 } = req.body;
    const accountPublicKey = new PublicKey(account);
    
    logger.info("Received response with account: %s, answer1: %s, answer2: %s", account, answer1, answer2);

    if (!account || !answer1 || !answer2) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    
    await storeNeverHaveIEverResponse(accountPublicKey.toString(), answer1, answer2);

    
    const { cal1, cal2 } = await getAnswerPercentage();

    let winnerMessage: string;
    if (cal1 > cal2) {
      winnerMessage = "Players who answered 'I Have' for question 2 are the winners!";
    } else {
      winnerMessage = "Players who answered 'I Have Never' for question 2 are the winners!";
    }

    
    const { program, connection, wallet } = await initWeb3();
    const instruction = await program.methods
      .processStringInput("never-have-i-ever", answer1)
      .accounts({
        user: accountPublicKey,
        systemProgram: SystemProgram.programId
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: accountPublicKey,
        recentBlockhash: blockhash,
        instructions: [instruction]
      }).compileToV0Message()
    );

    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

    res.status(200).json({ transaction: base64Transaction, message: winnerMessage });
  } catch (err) {
    logger.error("An error occurred in postHandler: %s", err);
    return res.status(400).json({ error: err || "An unknown error occurred" });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    await nextCors(req, res, {
      methods: ["GET", "POST"],
      origin: "*", 
      optionsSuccessStatus: 200
    });

    if (req.method === "GET") {
      await getHandler(req, res);
    } else if (req.method === "POST") {
      await postHandler(req, res);
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (err) {
    logger.error("Error in main handler: %s", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
