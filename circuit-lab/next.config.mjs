// Static site: `next build` writes plain HTML/JS/CSS to out/, servable from any static host.
/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  trailingSlash: true,
  // The workbench owns WebGL contexts and a worker; double-mounting them in development hides real leaks.
  reactStrictMode: false,
  devIndicators: false,
  turbopack: {root: import.meta.dirname},
  // keep `next dev` from writing an AGENTS.md into the project
  agentRules: false,
};
