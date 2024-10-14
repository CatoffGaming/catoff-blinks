import { Connection, PublicKey } from "@solana/web3.js";
import { ONCHAIN_CONFIG } from "./helper/cluster.helper";
import { BN, Program } from "@coral-xyz/anchor";

export enum CHALLENGE_STATE {
  UPCOMING = "UPCOMING",
  ONGOING = "ONGOING",
  PROCESSING = "PROCESSING",
  PAYINGOUT = "PAYINGOUT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_WINNER = "NO_WINNER",
  NO_WINNER_PAYINGOUT = "NO_WINNER_PAYINGOUT",
  CANCELLED_PAYINGOUT = "CANCELLED_PAYINGOUT",
}

export enum ONCHAIN_STATE {
  TO_BE_MINTED = "TO_BE_MINTED",
  MINTED = "MINTED",
  UPDATED = "UPDATED",
  TRANSFERRED = "TRANSFERRED",
  CANCELLED = "CANCELLED",
  NO_WINNER = "NO_WINNER",
}

export enum VERIFIED_CURRENCY {
  // CREDITS = "CREDITS",
  USDC = "USDC",
  SOL = "SOL",
  BONK = "BONK",
  SEND = "SEND",
}

export enum CHALLENGE_CATEGORIES {
  FITNESS = "Fitness",
  ART = "Art",
  TRAVEL = "Travel",
  ADVENTURE = "Adventure",
  LIFESTYLE = "Lifestyle",
  GAMING = "Gaming",
  SPORTS = "Sports",
  SOCIAL_MEDIA = "Social Media",
  EVENT = "Event",
  RANDOM = "Random",
}

export enum PARTICIPATION_TYPE {
  ZERO_VS_ONE = 0,
  ONE_VS_ONE = 1,
  NVN = 2,
}

export enum GAME_TYPE {
  STEPS = 0,
  CALORIES = 1,
  DIGITAL_PROOF = 2,
  VALIDATOR = 3,
  VOTING = 4,
}

export enum ParticipationTypeMultiToken {
  SIDE_BET = "SideBet",
  JOIN_CHALLENGE = "JoinChallenge",
}

export enum NotificationMedium {
  APP_NOTIF = "APP_NOTIF",
  PUSH_NOTIF = "PUSH_NOTIF",
  EMAIL = "EMAIL",
}

export enum NOTIFICATION_TYPE {
  SIGNUP = "SIGNUP",
  CHALLENGE_CREATED = "CHALLENGE_CREATED",
  CHALLENGE_JOINED_SELF = "CHALLENGE_JOINED_SELF",
  CHALLENGE_JOINED_PLAYER = "CHALLENGE_JOINED_PLAYER",
  CHALLENGE_JOINED_CREATOR = "CHALLENGE_JOINED_CREATOR",
  CHALLENGE_MAX_PARTICIPATION_REACHED_CREATOR = "CHALLENGE_MAX_PARTICIPATION_REACHED_CREATOR",
  CHALLENGE_MAX_PARTICIPATION_REACHED_PLAYER = "CHALLENGE_MAX_PARTICIPATION_REACHED_PLAYER",
  CHALLENGE_CANCELLED_SELF = "CHALLENGE_CANCELLED_SELF",
  CHALLENGE_CANCELLED_PLAYER = "CHALLENGE_CANCELLED_PLAYER",
  CHALLENGE_STARTED_SELF = "CHALLENGE_STARTED_SELF",
  CHALLENGE_STARTED_PLAYER = "CHALLENGE_STARTED_PLAYER",
  CHALLENGE_ENDED_SELF = "CHALLENGE_ENDED_SELF",
  CHALLENGE_ENDED_PLAYER = "CHALLENGE_ENDED_PLAYER",
  CHALLENGE_SETTLED_WITH_NO_WINNER = "CHALLENGE_SETTLED_WITH_NO_WINNER",
  CHALLENGE_SETTLED_WITH_NO_WINNER_CREATOR = "CHALLENGE_SETTLED_WITH_NO_WINNER_CREATOR",
  CHALLENGE_SETTLED_WITH_WINNER_SELF = "CHALLENGE_SETTLED_WITH_WINNER_SELF",
  CHALLENGE_SETTLED_WITH_WINNER_CREATOR = "CHALLENGE_SETTLED_WITH_WINNER_CREATOR",
  CHALLENGE_SETTLED_WITH_WINNER = "CHALLENGE_SETTLED_WITH_WINNER",
  WITHDRAW_REQUEST = "WITHDRAW_REQUEST",
  WITHDRAW_SUCCESS = "WITHDRAW_SUCCESS",
  WITHDRAW_FAILED = "WITHDRAW_FAILED",
  DEPOSIT_REQUEST = "DEPOSIT_REQUEST",
  DEPOSIT_SUCCESS = "DEPOSTI_SUCCESS",
  DEPOSIT_FAILED = "DEPOSIT_FAILED",
}

export enum GENDER {
  MALE = "male",
  FEMALE = "female",
  OTHER = "others",
  UNKNOWN = "unknown",
}

export enum WALLET_TYPES {
  OKTO = "OKTO",
  EXTERNAL = "EXTERNAL",
}

export enum AdditionalNotificationType {
  OKTO = "OKTO",
}

export enum REFUND_STATE {
  NOT_ELIGIBLE = "NOT_ELIGIBLE",
  ELIGIBLE = "ELIGIBLE",
  REFUND_PROCESSING = "REFUND_PROCESSING",
  REFUNDED = "REFUNDED",
}

export enum WITHDRAW_STATE {
  CREATE = "CREATE",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface Challenge {
  ChallengeID: number;
  ChallengeName: string;
  ChallengeDescription: string;
  ChallengeCreator: User;
  ChallengePublicKey: string | null;
  StartDate: number | null;
  EndDate: number | null;
  Game: Game;
  State: CHALLENGE_STATE;
  PaymentProcessed: boolean;
  Winners: Player[];
  MaxParticipants: number;
  Players: PlayerWithDetails[];
  Media: string | null;
  NFTMedia: string | null;
  Wager: number;
  Target: number | null;
  Unit: string | null;
  Category: CHALLENGE_CATEGORIES | null;
  Notifications: Notification[];
  AllowSideBets: boolean;
  SideBetsWager: number;
  Slug: string | null;
  IsPrivate: boolean;
  AssetAddresses: string[];
  OnChainState: ONCHAIN_STATE;
  Currency: VERIFIED_CURRENCY;
  createdAt: string;
  updatedAt: string;
}

export interface Game {
  GameID: number;
  GameName: string;
  ParticipationType: PARTICIPATION_TYPE | null;
  GameType: GAME_TYPE;
  GameDescription: string;
  Challenges: Challenge[];
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  PlayerID: number;
  Submission: Submission | null;
  User: User;
  Challenge: Challenge;
  WinningChallenge: Challenge | null;
  Value: number | null;
  Device: string | null;
  DeviceDataSource: string | null;
  PlayerPublicKey: string | null;
  VariableDescription: string | null;
  IsActive: boolean | null;
  Betters: Better[];
  TxHash: string | null;
  IsOnChainVerified: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerWithDetails extends Player {
  rank: number;
  pastChallengesWon: number;
  pastChallengesLost: number;
  bio: string | null;
}

export interface User {
  UserID: number;
  Email: string | null;
  UserName: string | null;
  Wallets: Wallet[];
  WalletAddress: string | null;
  Bio: string | null;
  Tag: string | null;
  Credits: number;
  InvestedCredits: number | null;
  ProfilePicture: string | null;
  CoverHexCode: string | null;
  Gender: GENDER | null;
  Transactions: Transaction[];
  SentTransactions: Transaction[];
  UserConfig: UserConfig | null;
  CreatedChallenges: Challenge[];
  Players: Player[];
  WithdrawRequests: WithdrawRequest[];
  DepositRequests: DepositRequest[];
  Notifications: Notification[];
  VotedSubmissions: Submission[];
  Betters: Better[];
  createdAt: string;
  updatedAt: string;
}

export interface Better {
  ID: number;
  Player: Player;
  User: User;
  IsOnChainVerified: boolean | null;
  TxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  ID: number;
  MediaUrls: string[];
  IsValid: boolean;
  Player: Player;
  Voters: User[];
  VotedWallets: string[];
  NumberOfVotes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  ID: number;
  Title: string | null;
  Description: string | null;
  Type: NOTIFICATION_TYPE;
  Challenge: Challenge | null;
  User: User | null;
  WithdrawRequest: WithdrawRequest | null;
  DepositRequest: DepositRequest | null;
  MediaUrl: string | null;
  IsRead: boolean;
  createdAt: string;
}

export interface Wallet {
  ID: number;
  PublicKey: string;
  Type: WALLET_TYPES;
  AirDrop: AirDrop;
  User: User;
  createdAt: string;
  updatedAt: string;
}

export interface AirDrop {
  sendTx: string;
  usdcTx: string;
  bonkTx: string;
}

export interface WithdrawRequest {
  ID: number;
  User: User;
  Amount: number;
  Currency: string;
  JobID: number | null;
  Status: WITHDRAW_STATE;
  TxHash: string | null;
  FailureReason: string | null;
  Notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

export interface DepositRequest {
  ID: number;
  User: User;
  Amount: number;
  Currency: string;
  JobID: string | null;
  Status: string;
  TxHash: string | null;
  FailureReason: string | null;
  Notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  TxID: number;
  TxHash: string | null;
  ToUser: User | null;
  FromUser: User | null;
  TokenAmount: string | null;
  Token: string | null;
  CreditAmount: number | null;
  Description: string | null;
  RefundState: REFUND_STATE;
  FailureReason: string | null;
  Timestamp: number;
}

export interface UserConfig {
  ID: number;
  User: User;
  PlatformRefreshToken: string | null;
  GoogleRefreshToken: string | null;
  OktoRefreshToken: string | null;
  OktoDeviceToken: string | null;
  OktoAuthToken: string | null;
  IdToken: string | null;
  Devices: string[];
  DataStreams: string[];
  DefaultDevice: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  UserID: number;
  Email: string | null;
  UserName: string | null;
  Wallets: Wallet[];
  WalletAddress: string | null;
  Bio: string | null;
  Tag: string | null;
  Credits: number;
  InvestedCredits: number | null;
  ProfilePicture: string | null;
  CoverHexCode: string | null;
  Gender: GENDER | null;
  Transactions: Transaction[];
  SentTransactions: Transaction[];
  UserConfig: UserConfig | null;
  CreatedChallenges: Challenge[];
  Players: Player[];
  WithdrawRequests: WithdrawRequest[];
  DepositRequests: DepositRequest[];
  Notifications: Notification[];
  VotedSubmissions: Submission[];
  Betters: Better[];
  createdAt: string;
  updatedAt: string;
}

export interface IChallengeById {
  ChallengeID: number;
  ChallengeName: string;
  ChallengeDescription: string;
  ChallengePublicKey: string | null;
  StartDate: number;
  EndDate: number;
  State: CHALLENGE_STATE;
  PaymentProcessed: boolean;
  MaxParticipants: number;
  Media: string | null;
  NFTMedia: string | null;
  Wager: number;
  Target: number;
  Unit: string | null;
  Category: CHALLENGE_CATEGORIES;
  AllowSideBets: boolean;
  SideBetsWager: number;
  Slug: string | null;
  IsPrivate: boolean;
  AssetAddresses: string[];
  OnChainState: ONCHAIN_STATE;
  Currency: VERIFIED_CURRENCY;
  ChallengeCreator: User;
  Game: Game;
  ChallengeWinner: User[];
  Players: PlayerWithDetails[];
}

export const getGameID = (
  participationType: PARTICIPATION_TYPE,
  gameType: GAME_TYPE,
): number | undefined => {
  const gameMapping: Record<string, number> = {
    [`${PARTICIPATION_TYPE.ZERO_VS_ONE}_${GAME_TYPE.STEPS}`]: 1, // Solo Step Quest
    [`${PARTICIPATION_TYPE.ZERO_VS_ONE}_${GAME_TYPE.CALORIES}`]: 2, // Solo Calorie Crunch
    [`${PARTICIPATION_TYPE.ZERO_VS_ONE}_${GAME_TYPE.VALIDATOR}`]: 10, // Single Validator Based Game (0v1)

    [`${PARTICIPATION_TYPE.ONE_VS_ONE}_${GAME_TYPE.STEPS}`]: 3, // Step Duel
    [`${PARTICIPATION_TYPE.ONE_VS_ONE}_${GAME_TYPE.CALORIES}`]: 4, // Calorie Combat
    [`${PARTICIPATION_TYPE.ONE_VS_ONE}_${GAME_TYPE.DIGITAL_PROOF}`]: 7, // Twitter Analytics Views (1v1)
    [`${PARTICIPATION_TYPE.ONE_VS_ONE}_${GAME_TYPE.VALIDATOR}`]: 11, // Single Validator Based Game (1v1)
    [`${PARTICIPATION_TYPE.ONE_VS_ONE}_${GAME_TYPE.VOTING}`]: 12, // Voting Based Dare Game

    [`${PARTICIPATION_TYPE.NVN}_${GAME_TYPE.STEPS}`]: 5, // Pedometer Pandemonium
    [`${PARTICIPATION_TYPE.NVN}_${GAME_TYPE.CALORIES}`]: 6, // Calorie Conquest Community Edition
    [`${PARTICIPATION_TYPE.NVN}_${GAME_TYPE.DIGITAL_PROOF}`]: 8, // Twitter Analytics Views (nvn)
    [`${PARTICIPATION_TYPE.NVN}_${GAME_TYPE.VALIDATOR}`]: 10, // Single Validator Based Game (nvn)
    [`${PARTICIPATION_TYPE.NVN}_${GAME_TYPE.VOTING}`]: 14, // Voting Based multi-player Game
  };

  return gameMapping[`${participationType}_${gameType}`];
};

export enum CLUSTER_TYPES {
  DEVNET = "devnet",
  MAINNET = "mainnet",
}

export interface IWeb3Participate {
  account: PublicKey;
  playerId: BN;
  challengeId: BN;
  amount: BN;
  currency?: VERIFIED_CURRENCY;
  onchainParticipateType: ONCHAIN_PARTICIPATE_TYPE;
}

export enum ONCHAIN_PARTICIPATE_TYPE {
  JOIN_CHALLENGE = "joinChallenge",
  SIDE_BET = "sideBet",
}

export interface IGetTxObject extends IWeb3Participate {
  userPublicKey: PublicKey;
  escrowTokenAccount: PublicKey;
  userTokenAccount: PublicKey;
  program: Program;
  cluster: keyof typeof ONCHAIN_CONFIG;
}

export interface ITokenAccountGetter {
  connection: Connection;
  currency: VERIFIED_CURRENCY;
  escrowPublicKey: PublicKey;
  userPublicKey: PublicKey;
  cluster: keyof typeof ONCHAIN_CONFIG;
}

export interface ResultWithError {
  data: any;
  error: any;
}

export interface ICreateChallenge {
  ChallengeName: string;
  ChallengeDescription: string;
  StartDate: number;
  EndDate: number;
  GameID: number;
  Wager: number;
  Target: number;
  AllowSideBets: boolean;
  SideBetsWager: number;
  Unit: string;
  IsPrivate: boolean; //keep it always false
  Currency: VERIFIED_CURRENCY; //keep it VERIFIED_CURRENCY.SOL
  ChallengeCategory: CHALLENGE_CATEGORIES; //keep it CHALLENGE_CATEGORIES.SOCIAL_MEDIA
  NFTMedia?: string; // create using ai -> ipfs
  Media?: string; // baad mey
  UserAddress?: string;
}

export interface ICreateTransaction {
  accountPublicKey: PublicKey;
  recipientPublicKey: PublicKey;
  currency: VERIFIED_CURRENCY;
  amount: number;
  connection: Connection;
  cluster: keyof typeof ONCHAIN_CONFIG,
  zeroWager?: boolean;
}

export interface IGetChallengeByID {
  ChallengeID: number;
  ChallengeName: string;
  ChallengeDescription: string;
  ChallengePublicKey: string | null;
  StartDate: number;
  EndDate: number;
  State: CHALLENGE_STATE;
  PaymentProcessed: boolean;
  MaxParticipants: number;
  Media: string | null;
  NFTMedia: string | null;
  Wager: number;
  Target: number;
  Unit: string | null;
  Category: CHALLENGE_CATEGORIES;
  AllowSideBets: boolean;
  SideBetsWager: number;
  Slug: string | null;
  IsPrivate: boolean;
  AssetAddresses: string[];
  OnChainState: ONCHAIN_STATE;
  Currency: VERIFIED_CURRENCY;
  ChallengeCreator: User;
  Game: Game;
  ChallengeWinner: User[];
  Players: PlayerWithDetails[];
}

export enum JOIN_CHALLENGE_METHOD {
  LINK = "LINK",
  SLUG = "SLUG",
  CHALLENGE_ID = "CHALLENGE_ID"
}