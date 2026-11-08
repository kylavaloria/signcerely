import type { NextConfig } from "next";

// Cache Components is off: almost every page reads the signed-in wallet from a
// cookie, so pages render per request (classic dynamic rendering).
const nextConfig: NextConfig = {};

export default nextConfig;
