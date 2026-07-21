const fs = require("fs");
const puppeteer = require("puppeteer");

const SYSTEM_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function resolveChromeExecutable() {
  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    // bundled Chrome not installed yet
  }

  for (const candidate of SYSTEM_CHROME_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "No Chrome/Chromium found for PDF conversion. Run:\n" +
    "  npx puppeteer browsers install chrome\n" +
    "Or install Google Chrome, or set PUPPETEER_EXECUTABLE_PATH."
  );
}

module.exports = { resolveChromeExecutable };
