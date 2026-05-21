const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(cors());

const browser = await puppeteer.launch({
  args: [
    ...chromium.args,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu"
  ],
  executablePath: await chromium.executablePath(),
  headless: true,
});


const Tournois = [
  {
    "Date tournoi": "27/07/2025",
    "Nom": "tournoi interne P250",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Damien VILLEDIEU",
    "Classement": 3,
    "Point": 188,
    "Validité": "juil-26"
  },
  {
    "Date tournoi": "27/07/2025",
    "Nom": "tournoi interne P250",
    "type": "P250",
    "Catégorie": "DX",
    "Partenaire": "Elise SAVARIT",
    "Classement": 4,
    "Point": 180,
    "Validité": "juil-26"
  },
  {
    "Date tournoi": "30/01/2026",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Sébastien CREUSOT",
    "Classement": 9,
    "Point": 108,
    "Validité": "janv-27"
  },
  {
    "Date tournoi": "12/08/2025",
    "Nom": "P250 H",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Damien VILLEDIEU",
    "Classement": 9,
    "Point": 108,
    "Validité": "août-26"
  },
  {
    "Date tournoi": "15/07/2025",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Mathieu SOUNIER",
    "Classement": 9,
    "Point": 108,
    "Validité": "juil-26"
  },
  {
    "Date tournoi": "16/01/2026",
    "Nom": "p250 messieurs",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Clement TRICHARD",
    "Classement": 6,
    "Point": 100,
    "Validité": "janv-27"
  },
  {
    "Date tournoi": "28/01/2026",
    "Nom": "Circuit M+ Matériaux Par Equipes - 4ème étape",
    "type": "P100",
    "Catégorie": "DM",
    "Partenaire": "David SALA",
    "Classement": 3,
    "Point": 70,
    "Validité": "janv-27"
  },
  {
    "Date tournoi": "20/08/2025",
    "Nom": "P250 MIXTE SOIREE",
    "type": "P250",
    "Catégorie": "DX",
    "Partenaire": "Chloé CAIZERGUES",
    "Classement": 11,
    "Point": 63,
    "Validité": "août-26"
  },
  {
    "Date tournoi": "13/06/2025",
    "Nom": "p250 hommes",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 9,
    "Point": 63,
    "Validité": "juin-26"
  },
  {
    "Date tournoi": "06/06/2025",
    "Nom": "P250H Mam's Padel",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 11,
    "Point": 45,
    "Validité": "juin-26"
  },
  {
    "Date tournoi": "14/07/2025",
    "Nom": "P100 MIXTE PADEL GENTLE LUNDI 14/07 MATIN",
    "type": "P100",
    "Catégorie": "DX",
    "Partenaire": "Mathilde BENOIT",
    "Classement": 5,
    "Point": 35,
    "Validité": "juil-26"
  },
  {
    "Date tournoi": "16/02/2026",
    "Nom": "P250H PUNTACO Padel",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Stéphane HUYGHE",
    "Classement": 21,
    "Point": 25,
    "Validité": "févr-27"
  },
  {
    "Date tournoi": "25/07/2025",
    "Nom": "P250 HOMMES",
    "type": "P250",
    "Catégorie": "DM",
    "Partenaire": "Vincent ROBERT",
    "Classement": 21,
    "Point": 25,
    "Validité": "juil-26"
  },
  {
    "Date tournoi": "24/02/2026",
    "Nom": "P100 HOMMES",
    "type": "P100",
    "Catégorie": "DM",
    "Partenaire": "Adrien EMERAUX",
    "Classement": 18,
    "Point": 18,
    "Validité": "févr-27"
  }
];

app.get("/", (req, res) => {
  res.send("✅ Backend connecté TenUp OK");
});

// ✅ scraping automatique connecté

app.get("/tournois", (req, res) => {
  res.json(Tournois);
});


app.get("/tournois2", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    await page.goto(
      "https://tenup.fft.fr/classement/7146157482/padel",
      { waitUntil: "networkidle2" }
    );

    await page.waitForSelector(".mes-competitions-container");

    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        ".mes-competitions-container tbody tr"
      );

      const result = [];

      rows.forEach((row) => {
        const cols = row.querySelectorAll("td");

        if (cols.length >= 7) {
          result.push({
            date: cols[0].innerText.trim(),
            nom: cols[1].innerText.trim(),
            categorie: cols[2].innerText.trim(),
            partenaire: cols[4].innerText.trim(),
            classement: cols[5].innerText.trim(),
            points: cols[6].innerText.trim(),
          });
        }
      });

      return result;
    });

    await browser.close();

    res.json(data);
  } catch (err) {
    console.error("❌ ERREUR:", err.message);
    res.status(500).json({ error: err.message });
  }
});



app.listen(3000, () => {
  console.log("✅ Backend prêt");
});
