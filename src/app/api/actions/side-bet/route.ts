import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
  ActionError,
  LinkedAction,
} from "@solana/actions";
import { PublicKey, Transaction } from "@solana/web3.js";
import logger from "@/common/logger";
import { BN, web3 } from "@coral-xyz/anchor";
import {
  CHALLENGE_STATE,
  CLUSTER_TYPES,
  IGetChallengeByID,
  IGetTxObject,
  ONCHAIN_PARTICIPATE_TYPE,
  Submission,
} from "@/common/types";
import { getRequestParam } from "@/common/helper/getParams";
import { ONCHAIN_CONFIG } from "@/common/helper/cluster.helper";
import {
  getChallengeById,
  getSubmissionsById,
} from "@/common/utils/api.util";
import { jsonResponse, Promisify } from "@/common/helper/responseMaker";
import { StatusCodes } from "http-status-codes";
import { GenericError } from "@/common/helper/error";
import { getTxObject, initWeb3, parseToPrecision, tokenAccounts } from "@/common/helper/helper";

// create the standard headers for this route (including CORS)
const headers = createActionHeaders();

export const GET = async (req: Request) => {
  try {
    logger.info("GET request received");
    /////////////////////////////////////
    /////////Extract Params//////////////
    /////////////////////////////////////
    const requestUrl = new URL(req.url);
    const challengeID = getRequestParam<number>(requestUrl, "challengeID", true);
    const clusterurl = getRequestParam<CLUSTER_TYPES>(
      requestUrl,
      "clusterurl",
      true,
      Object.values(CLUSTER_TYPES),
    );

    const basicUrl =
      process.env.IS_PROD === "prod" ? "https://join.catoff.xyz" : new URL(req.url).origin; // TODO: edit text here

    logger.info("Fetching challenge by ID: %s", challengeID);

    const challenge = await Promisify<IGetChallengeByID>(getChallengeById(clusterurl, challengeID));

    const submissions = await Promisify<Submission[]>(getSubmissionsById(clusterurl, challengeID));

    const submissionUserMap: Record<number, string | null> = {};

    submissions.forEach((submission) => {
      const userName = submission.Player.User.UserName;
      submissionUserMap[submission.ID] = userName ? userName : null;
    });
    logger.info("SubmissionID to UserName map: %o", submissionUserMap);

    const actions: LinkedAction[] = submissions.map((submission, index) => {
      const username = submission.Player.User.UserName || `User ${index + 1}`;
      const sideWagerAmount = challenge.SideBetsWager || 0;
      const currency = challenge.Currency;

      return {
        type: "transaction",
        label: `Bet ${sideWagerAmount} ${currency} on ${username}`, // Button label updated with side vote amount
        href: `/api/actions/side-bet?clusterurl=${clusterurl}&vote=${submission.ID}&challengeID=${challengeID}`, // URL triggers vote submission directly
        parameters: [], // No parameters needed, each button represents a direct vote for one submission
      };
    });

    const iconUrl = challenge.Media ?? new URL("/sidebet.gif", basicUrl).toString();

    const payload: ActionGetResponse = {
      title: "🚀 Bet on your favorite player!",
      icon: iconUrl,
      type: "action",
      description: `- ${challenge.ChallengeName}\n${challenge.ChallengeDescription}`,
      label: "Vote",
      links: {
        actions: actions,
      },
    };

    logger.info("Payload constructed successfully for ChallengeID: %s", challengeID);
    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error("An error occurred in GET handler: %s", err);
    const errorMessage = err instanceof GenericError ? err.message : "An unknown error occurred";
    const actionError: ActionError = { message: errorMessage };

    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = async () => Response.json(null, { headers });

export const POST = async (req: Request) => {
  try {
    /////////////////////////////////////
    /////////Extract Params//////////////
    /////////////////////////////////////
    const requestUrl = new URL(req.url);
    const clusterurl = getRequestParam<CLUSTER_TYPES>(
      requestUrl,
      "clusterurl",
      true,
      Object.values(CLUSTER_TYPES),
    );
    const challengeID = getRequestParam<number>(requestUrl, "challengeID", true);
    const vote = getRequestParam<number>(requestUrl, "vote", true);

    /////////////////////////////////////
    /////////Extract Account/////////////
    /////////////////////////////////////
    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      throw 'Invalid "account" provided';
    }

    /////////////////////////////////////
    ///////////Parse Phase///////////////
    /////////////////////////////////////

    const challenge = await Promisify<IGetChallengeByID>(getChallengeById(clusterurl, challengeID));
    if (challenge.State !== CHALLENGE_STATE.UPCOMING) {
      throw new GenericError(`Challenge is already ${challenge.State}`, StatusCodes.BAD_REQUEST);
    }

    const submissions = await Promisify<Submission[]>(getSubmissionsById(clusterurl, challengeID));

    const submission = submissions.find((sub) => sub.ID === vote);
    if (!submission) {
      logger.error("No submission found for submission ID: %s", vote);
      throw new GenericError(
        `No submission found for submission ID: ${vote}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    /////////////////////////////////////
    /////////Transaction Phase///////////
    /////////////////////////////////////

    const { program, connection } = await initWeb3(clusterurl);

    const { escrowTokenAccount, userTokenAccount } = await tokenAccounts({
      connection,
      currency: challenge.Currency,
      escrowPublicKey: ONCHAIN_CONFIG[clusterurl].escrowAccountPublicKey,
      userPublicKey: account,
      cluster: clusterurl,
    });

    const web3Join: IGetTxObject = {
      onchainParticipateType: ONCHAIN_PARTICIPATE_TYPE.SIDE_BET,
      account,
      program,
      playerId: new BN(0),
      challengeId: new BN(submission.Player.PlayerID),
      amount: new BN(
        parseToPrecision(
          challenge.SideBetsWager,
          ONCHAIN_CONFIG[clusterurl]?.Decimals[challenge.Currency],
        ),
      ),
      currency: challenge.Currency,
      userPublicKey: account,
      userTokenAccount,
      escrowTokenAccount,
      cluster: clusterurl,
    };

    const transaction = await Promisify<Transaction>(getTxObject(web3Join));

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: "successfully placed sidebet!",
      },
    });
    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error(err);
    let actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof err == "string") actionError.message = err;
    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};
