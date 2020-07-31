const puppeteer = require("puppeteer-serverless");
// const chromium = require("chrome-aws-lambda");
const renderSocialImage = require("puppeteer-social-image");

// import puppeteer from "puppeteer-serverless";
// import renderSocialImage from "puppeteer-social-image";
let browser;

exports.handler = async function (event, context, callback) {
  browser = browser || (await puppeteer.launch({}));
  await renderSocialImage({
    template: "basic",
    templateParams: {
      imageUrl:
        "https://images.unsplash.com/photo-1557958114-3d2440207108?w=1950&q=80",
      title: "Hello, world",
    },
    browser,
  });
};
