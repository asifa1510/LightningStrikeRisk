// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/opensky", // ← everything starting with /opensky will be proxied
    createProxyMiddleware({
      target: "https://opensky-network.org",
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/opensky": "" }, // /opensky/api/... -> /api/...
      onProxyReq(proxyReq) {
        const id  = process.env.REACT_APP_OPENSKY_CLIENT_ID || "sasifa-api-client";
        const key = process.env.REACT_APP_OPENSKY_API_KEY   || "t9hbVQLzbNueagscrzkD5yFAzJ7fv6gv";
        const basic = Buffer.from(`${id}:${key}`).toString("base64");
        proxyReq.setHeader("Authorization", `Basic ${basic}`);
        proxyReq.setHeader("Accept", "application/json");
      },
      logLevel: "debug", // helpful while diagnosing
    })
  );
};







