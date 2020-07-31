// import puppeteer from "puppeteer-serverless";
import renderSocialImage from "puppeteer-social-image";

exports.handler = async function (event, context, callback) {
  await renderSocialImage({
    template: "basic",
    templateParams: {
      imageUrl:
        "https://images.unsplash.com/photo-1557958114-3d2440207108?w=1950&q=80",
      title: "Hello, world",
    },
    // browser: await puppeteer.launch(),
  });
};
