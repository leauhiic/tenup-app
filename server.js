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
    const url = "https://tenup.fft.fr/classement/7146157482/padel";

    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);

    const joueurs = [];

    $("tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 3) {
        const joueur = {
          classement: $(cols[0]).text().trim(),
          nom: $(cols[1]).text().trim(),
          points: $(cols[2]).text().trim(),
        };

        if (joueur.nom) {
          joueurs.push(joueur);
        }
      }
    });

    res.json(joueurs);
  } catch (error) {
    console.error("Erreur scraping :", error);
    res.status(500).json({ error: "Erreur scraping" });
  }
});

// ✅ Lancer serveur
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend lancé sur port ${PORT}`);
});
