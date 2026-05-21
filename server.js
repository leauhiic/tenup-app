const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(cors());


const Tournois = [
  {
    "name": "datadome",
    "value": "1WICZHgcIcTaoVMPewpDfGDTUJPdepQTOFOxzeFgXHjHhajujeJf8OWFVVD_93Qx3csa9nVFYGxR01JMsX5DnF40P0mHo1UVyHN78Q96mAVEJ6r4HZ4jHBSxsYhKCPdS",
    "domain": ".fft.fr",
    "path": "/"
  }
];

app.get("/", (req, res) => {
  res.send("✅ Backend connecté TenUp OK");
});

// ✅ scraping automatique connecté

app.get("/tournois", (req, res) => {
  res.json(Tournois);
});




app.listen(3000, () => {
  console.log("✅ Backend prêt");
});
