import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // `next dev` otherwise appends a managed block to CLAUDE.md on every run, which
  // leaves the tree permanently dirty and puts vendor text in a hand-written file.
  // The advice it carries is kept in our own words on CLAUDE.md's Framework row.
  agentRules: false,
};

export default nextConfig;
