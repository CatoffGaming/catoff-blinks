import { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Run the cors middleware
  await nextCors(req, res, {
    // Options
    methods: ["GET", "HEAD"],
    origin: "*", // Change this to your frontend URL in production for security
    optionsSuccessStatus: 200,
  });

  const { challengeID } = req.query;

  if (!challengeID || typeof challengeID !== "string") {
    return res
      .status(400)
      .json({ error: 'Missing or invalid "challengeID" parameter' });
  }

  try {
    const response = await fetch(
      `https://apiv2.catoff.xyz/player/submissions/${challengeID}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch submissions: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
};

export default handler;
