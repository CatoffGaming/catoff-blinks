import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import { Cubik } from "@cubik-so/sdk";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import * as anchor from "@project-serum/anchor";
import nextCors from "nextjs-cors";
import fetch from "node-fetch";
import { connection, program, programId } from "./idl";
// import generateCollageImageUrl from '../../../components/ImageConverter'


interface CustomActionPostRequest extends SolanaActionPostRequest {
  submission_id?: string | number | string[];
}

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = new URL(req.url as string, `https://${req.headers.host}`);
    const challengeID = requestUrl.searchParams.get("challengeID");

    if (!challengeID) {
      return res.status(400).json({
        error: 'Missing "challengeID" parameter',
      });
    }

    // Ensure absolute URL for fetching submissions
    const submissionsResponse = await fetch(
      `https://apiv2.catoff.xyz/player/submissions/${challengeID}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!submissionsResponse.ok) {
      throw new Error("Failed to fetch submissions");
    }

    const responseJson = await submissionsResponse.json() as { data: any };
    const { data: submissions } = responseJson;
    // console.log(submissions);
    const baseHref = new URL(
      "/api/actions/submit-vote",
      requestUrl.origin
    ).toString();

    const actions = submissions.map((submission: { ID: number }) => ({
      label: `Vote for Submission ${submission.ID}`,
      href: `${baseHref}?submission_id=${submission.ID}`,
    }));

    const firstSubmissionMedia =
      submissions.length > 0 && submissions[0].Player.Challenge.Media
        ? submissions[0].Player.Challenge.Media
        : "/solana_devs.jpg";
        const iconUrl = new URL(firstSubmissionMedia, requestUrl.origin).toString();
        const mediaUrls = submissions.map((submission: { MediaUrl: any }) => submission.MediaUrl);
        const submissionids = submissions.map((submission: { ID: number }) => submission.ID)
    // Generate collage image URL
    // const collageImageUrl = await generateCollageImageUrl(mediaUrls , submissionids);

    const payload: ActionGetResponse = {
      title: "Vote for Submissions",
      icon: iconUrl,
      description: "Vote for a submission on-chain",
      type: "action",
      label: "Vote",
      links: {
        actions: actions,
      },
    };

    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body: CustomActionPostRequest = req.body;

    let submission_id: string | number | string[] | undefined =
      body.submission_id || req.query.submission_id;

    if (typeof submission_id === "undefined") {
      return res.status(400).json({ error: '"submission_id" is required' });
    }

    if (Array.isArray(submission_id)) {
      return res
        .status(400)
        .json({ error: '"submission_id" cannot be an array' });
    }

    const validSubmissionId: string | number =
      typeof submission_id === "string" || typeof submission_id === "number"
        ? submission_id
        : String(submission_id);

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }
    let ixs: web3.TransactionInstruction[] = [];

    const instruction = await program.methods
      .submitVote(new anchor.BN(submission_id))
      .accounts({
        user: account,
      })
      .instruction();

    ixs.push(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: new web3.PublicKey(account),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message()
    );

    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );
    const message = `Thank you for your Vote`;

    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error(err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // Apply CORS middleware to all requests
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
