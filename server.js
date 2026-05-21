const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

// ✅ test backend
app.get("/", (req, res) => {
  res.send("✅ Backend TenUp OK");
});

app.listen(3000, () => {
  console.log("✅ Backend prêt");
});


// SCRAPING
app.get("/classement", async (req, res) => {
  try {
    const url = "https://tenup.fft.fr/classement/7146157482/padel";

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = response.data;

    // 🔍 Cherche les noms directement dans le HTML
    const regexNom = /"(prenom|nom)":"(.*?)"/g;

    let match;
    const joueurs = [];

    while ((match = regexNom.exec(html)) !== null) {
      joueurs.push(match[2]);
    }

    res.json(joueurs.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
