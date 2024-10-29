import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
  ActionError,
  LinkedAction,
  ActionParameterSelectable,
} from "@solana/actions";
import { PublicKey, Transaction } from "@solana/web3.js";
import logger from "@/common/logger";
import { BN, web3 } from "@coral-xyz/anchor";
import {
  CHALLENGE_STATE,
  CLUSTER_TYPES,
  IChallengeById,
  IGetTxObject,
  JOIN_CHALLENGE_METHOD,
  ONCHAIN_PARTICIPATE_TYPE,
} from "@/common/types";
import { getRequestParam } from "@/common/helper/getParams";
import { ONCHAIN_CONFIG } from "@/common/helper/cluster.helper";
import { getChallengeById, getChallengeShareLink } from "@/common/utils/api.util";
import { jsonResponse, Promisify } from "@/common/helper/responseMaker";
import { StatusCodes } from "http-status-codes";
import { GenericError } from "@/common/helper/error";
import { getTxObject, initWeb3, parseToPrecision, tokenAccounts } from "@/common/helper/helper";

// create the standard headers for this route (including CORS)
const headers = createActionHeaders();

export const GET = async (req: Request) => {
  try {
    logger.info("GET request received");
    const requestUrl = new URL(req.url);
    const challengeID = getRequestParam<number>(requestUrl, "challengeID", false);
    const clusterurl = getRequestParam<CLUSTER_TYPES>(requestUrl, "clusterurl", false);
    const clusterOptions: ActionParameterSelectable<"radio">[] = clusterurl
      ? []
      : [
          {
            name: "clusterurl",
            label: "Select Cluster",
            type: "radio",
            required: true,
            options: [
              {
                label: "Devnet",
                value: CLUSTER_TYPES.DEVNET,
                selected: true,
              },
              {
                label: "Mainnet",
                value: CLUSTER_TYPES.MAINNET,
              },
            ],
          },
        ];

    const basicUrl =
      process.env.IS_PROD === "prod" ? "https://join.catoff.xyz" : new URL(req.url).origin;

    if (challengeID && clusterurl) {
      logger.info("Fetching challenge by ID: %s", challengeID);

      const { data: challenge, error } = await getChallengeById(clusterurl, challengeID);
      if (error) {
        logger.error("Error fetching challenge: %s", error);
        throw new GenericError("Failed to fetch challenge details", StatusCodes.BAD_REQUEST);
      }

      const actions: LinkedAction[] = [
        {
          type: "transaction",
          label: `Join Challenge ${challenge.ChallengeID}`,
          href: `/api/actions/join-challenge?clusterurl=${clusterurl}&challengeId=${challengeID}`,
        },
      ];

      const iconUrl = challenge.Media ?? new URL("/join.png", basicUrl).toString();

      const payload: ActionGetResponse = {
        title: "Join Challenge",
        icon: iconUrl,
        type: "action",
        description: `${challenge.ChallengeName}\n${challenge.ChallengeDescription}`,
        label: "Join",
        links: {
          actions: actions,
        },
      };

      logger.info("Payload constructed successfully for challengeID: %s", challengeID);
      return jsonResponse(payload, StatusCodes.OK, headers);
    } else {
      logger.info("Fetching default action payload for joining challenges");

      const href = `/api/actions/join-challenge?clusterurl=${
        clusterurl ?? "{clusterurl}"
      }&method={method}&value={value}`;

      const actions: LinkedAction[] = [
        {
          type: "transaction",
          label: "Join Catoff Challenge",
          href,
          parameters: [
            ...clusterOptions,
            {
              name: "method",
              label: "You have?",
              type: "radio",
              options: [
                {
                  label: "Challenge Link",
                  value: JOIN_CHALLENGE_METHOD.LINK,
                  selected: true,
                },
                {
                  label: "Challenge SLUG",
                  value: JOIN_CHALLENGE_METHOD.SLUG,
                },
                {
                  label: "Challenge ID",
                  value: JOIN_CHALLENGE_METHOD.CHALLENGE_ID,
                },
              ],
            },
            {
              name: "value",
              label: "Paste the link/SLUG/Challenge ID",
            },
          ],
        },
      ];

      const iconUrl = new URL("/join.png", basicUrl).toString();

      const payload: ActionGetResponse = {
        title: "Join Challenges",
        icon: iconUrl,
        type: "action",
        description: `🚀 Join the Action!\n- Enter thrilling IRL or in-game Challenges\n- Compete in high-stakes dares, duels, and multiplayer showdowns\n- Who will rise or crack under pressure? Join the fun, win big! 🎯🔥`,
        label: "Join",
        links: {
          actions: actions,
        },
      };

      logger.info("Default response payload for joining challenges created successfully");
      return jsonResponse(payload, StatusCodes.OK, headers);
    }
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
    let challengeID = getRequestParam<number>(requestUrl, "challengeId", false);
    const method = getRequestParam<JOIN_CHALLENGE_METHOD>(requestUrl, "method", false);
    const value = getRequestParam<string>(requestUrl, "value", false);

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

    if (!challengeID && value) {
      switch (method) {
        case JOIN_CHALLENGE_METHOD.CHALLENGE_ID:
          challengeID = Number(value);
          logger.info("Parsed challenge ID from value: %s", challengeID);
          break;
        case JOIN_CHALLENGE_METHOD.LINK:
          const linkParts = value.split("/");
          const idFromLink = linkParts[linkParts.length - 1];
          challengeID = Number(idFromLink);
          if (isNaN(challengeID)) {
            logger.error("Invalid challenge ID in link for value: %s", value);
            throw new GenericError("Invalid challenge ID in link", StatusCodes.BAD_REQUEST);
          }
          logger.info("Extracted challenge ID from link: %s", challengeID);
          break;
        case JOIN_CHALLENGE_METHOD.SLUG:
          const link = await Promisify<string>(getChallengeShareLink(clusterurl, value));
          const linkPartsSlug = link.split("/");
          challengeID = parseInt(linkPartsSlug[linkPartsSlug.length - 1]);
          if (isNaN(challengeID)) {
            logger.error("Invalid challenge ID in link from slug with value: %s", value);
            throw new GenericError(
              `Invalid challenge ID in link from slug with value: ${value}`,
              StatusCodes.BAD_REQUEST,
            );
          }
          logger.info("Extracted challenge ID from slug: %s");
          break;
        default:
          logger.error(
            "Invalid method provided for joining challenge for account: %s",
            account.toString(),
          );
          throw new GenericError(
            "Invalid method provided for joining challenge",
            StatusCodes.BAD_REQUEST,
          );
      }
    }

    if (challengeID === null) {
      throw new GenericError("Challenge ID is required", StatusCodes.BAD_REQUEST);
    }

    const challenge = await Promisify<IChallengeById>(getChallengeById(clusterurl, challengeID));

    if (challenge.State !== CHALLENGE_STATE.UPCOMING) {
      throw new GenericError(`Challenge is already ${challenge.State}`, StatusCodes.BAD_REQUEST);
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
      onchainParticipateType: ONCHAIN_PARTICIPATE_TYPE.JOIN_CHALLENGE,
      account,
      program,
      playerId: new BN(0),
      challengeId: new BN(challenge.ChallengeID),
      amount: new BN(
        parseToPrecision(challenge.Wager, ONCHAIN_CONFIG[clusterurl]?.Decimals[challenge.Currency]),
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
        message: "Challenge successfully joined!",
      },
    });
    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error("An error occurred in POST handler:", err);
    let actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof err === "string") actionError.message = err;
    else if (err instanceof GenericError) actionError.message = err.message;

    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};
