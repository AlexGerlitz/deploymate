const path = require("node:path");

const mockFontPath = path.join(__dirname, "font-mock.woff2");

function buildFontCss(fontFamily, weightRange) {
  return [
    "/* latin */",
    "@font-face {",
    `  font-family: '${fontFamily}';`,
    "  font-style: normal;",
    `  font-weight: ${weightRange};`,
    "  font-display: swap;",
    `  src: url(${mockFontPath}) format('woff2');`,
    "}",
  ].join("\n");
}

module.exports = new Proxy(
  {},
  {
    get(_target, url) {
      if (typeof url !== "string") {
        return undefined;
      }

      if (url.includes("family=Manrope")) {
        return buildFontCss("Manrope", "200 800");
      }

      if (url.includes("family=Space+Grotesk")) {
        return buildFontCss("Space Grotesk", "300 700");
      }

      return undefined;
    },
  },
);
