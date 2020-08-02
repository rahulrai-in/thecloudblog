const chrome = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");
const wait = require("waait");

const cached = new Map();

const exePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function getOptions(isDev) {
  if (isDev) {
    return {
      product: "chrome",
      args: [],
      executablePath: exePath,
      headless: true,
    };
  }
  return {
    product: "chrome",
    args: chrome.args,
    executablePath: await chrome.executablePath,
    headless: chrome.headless,
  };
}

async function getScreenshot(url, isDev) {
  console.log({ isDev, url: process.env.URL });
  // first check if this value has been cached
  const cachedImage = cached.get(url);
  if (cachedImage) {
    return cachedImage;
  }
  const options = await getOptions(isDev);
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 297, deviceScaleFactor: 1 });
  await page.goto(url);
  await wait(1000);
  const buffer = await page.screenshot({ type: "png" });
  const base64Image = buffer.toString("base64");
  cached.set(url, base64Image);
  return base64Image;
}

exports.handler = async (event, context) => {
  const qs = new URLSearchParams(event.queryStringParameters);
  console.log(
    `${
      process.env.URL || `http://localhost:1313`
    }/opengraph.html?${qs.toString()}`
  );
  const photoBuffer = await getScreenshot(
    `${
      process.env.URL || `http://localhost:1313`
    }/opengraph.html?${qs.toString()}`,
    // Here we need to pass a boolean to say if we are on the server. Netlify has a bug where process.env.NETLIFY is undefined in functions so I'm using one of the only vars I can find
    // !process.env.NETLIFY
    process.env.URL.includes("http://localhost")
  );
  return {
    statusCode: 200,
    headers: { "Content-Type": "image/png" },
    body: photoBuffer,
    isBase64Encoded: true,
  };
};
