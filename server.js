const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

// ✅ Test serveur
app.get("/", (req, res) => {
  res.send("✅ Backend scraping TenUp OK");
});

// ✅ Scraping classement padel
app.get("/classement", async (req, res) => {
  try {
    const url =
      "https://tenup.fft.fr/classement/7146157482/padel";

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const joueurs = [];

    // ⚠️ adapter selon structure réelle HTML
    $("tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 3) {
        const joueur = {
          classement: $(cols[0]).text().trim(),
          nom: $(cols[1]).text().trim(),
          points: $(cols[2]).text().trim(),
        };

        // éviter les lignes vides
        if (joueur.nom) {
          joueurs.push(joueur);
        }
      }
    });

    res.json(joueurs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur scraping" });
  }
});

// ✅ Exemple : endpoint pour récupérer les top 10
app.get("/top10", async (req, res) => {
  try {
    const url =
      "https://tenup.fft.fr/classement/7146157482/padel";

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const joueurs = [];

    $("tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 3) {
        joueurs.push({
          classement: $(cols[0]).text().trim(),
          nom: $(cols[1]).text().trim(),
          points: $(cols[2]).text().trim(),
        });
      }
    });

