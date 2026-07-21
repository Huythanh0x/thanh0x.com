const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { resolveChromeExecutable } = require("./resolve_chrome");

const JSZIP_PATH = path.join(__dirname, "node_modules", "jszip", "dist", "jszip.min.js");
const DOCX_PREVIEW_PATH = path.join(__dirname, "node_modules", "docx-preview", "dist", "docx-preview.min.js");

async function convertDocxFileToPdf(docxPath, pdfPath) {
  const docxBuffer = fs.readFileSync(docxPath);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChromeExecutable(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    await page.setContent("<!DOCTYPE html><html><head></head><body><div id=\"container\"></div></body></html>");

    await page.addStyleTag({
      content: `
        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
        }
        #container {
          width: 100%;
        }
        .docx-wrapper {
          background: #fff !important;
          padding: 0 !important;
        }
        section.docx {
          box-shadow: none !important;
          margin: 0 auto !important;
        }
        @media print {
          .docx-wrapper {
            padding: 0 !important;
            background: #fff !important;
          }
          section.docx {
            box-shadow: none !important;
          }
        }
      `,
    });

    await page.addScriptTag({ path: JSZIP_PATH });
    await page.addScriptTag({ path: DOCX_PREVIEW_PATH });

    const docxBase64 = docxBuffer.toString("base64");
    await page.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob(
        [bytes],
        { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
      );

      await docx.renderAsync(blob, document.getElementById("container"), null, {
        className: "docx",
        inWrapper: true,
        hideWrapperOnPrint: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        experimental: true,
        renderHeaders: false,
        renderFooters: false,
      });

      window.__DOCX_RENDERED__ = true;
    }, docxBase64);

    await page.waitForFunction("window.__DOCX_RENDERED__", { timeout: 30000 });
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    fs.writeFileSync(pdfPath, pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = { convertDocxFileToPdf };
