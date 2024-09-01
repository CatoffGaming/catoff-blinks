import axios from "axios";
import fs from "fs";
import path from "path";

const TOKEN_FILE_PATH = path.join(process.cwd(), "tokens_prod.json");

interface TokenResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    google_id_token?: string;
  };
}

// Function to refresh and save tokens
export const refreshToken = async () => {
  try {
    // Read the token.json file
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE_PATH, "utf-8"));

    // Make the API request to refresh the token
    const response = await axios.post<TokenResponse>(
        "https://apiv2.catoff.xyz/auth/refresh",
        {}, // No body content
        {
          headers: {
            Authorization: `Bearer ${tokenData.refresh_token}`,
          },
        }
      );
  

    // Check if the refresh was successful
    if (response.data.success) {
      // Update the tokens in the token.json file
      const newTokenData = {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        google_id_token: response.data.data.google_id_token,
      };

      // Save the updated tokens back to token.json
      fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(newTokenData, null, 2), "utf-8");
      console.log("Tokens refreshed and saved successfully");
      return newTokenData.access_token;
    } else {
      console.error("Failed to refresh tokens:", response.data.message);
    }
  } catch (error) {
    console.error("An error occurred while refreshing tokens:", error);
  }
};