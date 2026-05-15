import type { NextConfig } from "next";

const API = process.env.NEXT_PUBLIC_API_URL;

if (!API) {
  throw new Error(
    "Build aborted: NEXT_PUBLIC_API_URL must be set (check frontend/.env.production or Vercel project env vars).",
  );
}

if (process.env.VERCEL_ENV === "production" && API.includes("localhost")) {
  throw new Error(
    `Build aborted: production NEXT_PUBLIC_API_URL points to localhost (${API}).`,
  );
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: API,
  },
};

export default nextConfig;
