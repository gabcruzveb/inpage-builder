/** @type {import('next').NextConfig} */
const nextConfig = {
  // GrapeJS é carregado dinamicamente no client (useEffect) — sem SSR issues
  turbopack: {},
}

export default nextConfig;
