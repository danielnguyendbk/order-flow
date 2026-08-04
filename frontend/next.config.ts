import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lưu ý: `next build` bản thường đang dính bug upstream của Next.js 16.3 + React 19.2
  // khi prerender trang /_global-error ("Cannot read properties of null (reading
  // 'useContext')") — đã tái hiện trên scaffold hoàn toàn mới. Workaround hiện tại
  // nằm ở script "build" (--debug-prerender). Khi Next fix bug có thể bỏ cờ này.
};

export default nextConfig;
