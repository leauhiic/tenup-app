const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

// ✅ Test
app.get("/", (req, res) => {
  res.send("✅ Backend TenUp scraping OK");
});

// ✅ Scraping sécurisé
app.get("/classement", async (req, res) => {
  try {
    const url = "https://tenup.fft.fr/classement/7146157482/padel";

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const joueurs = [];

    $("tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 3) {
        const joueur = {
          classement: $(cols[0]).text().trim(),
          nom: $(cols[1]).text().trim(),
          points: $(cols[2]).text().trim(),
        };

        if (joueur.nom) joueurs.push(joueur);
      }
    });

    res.json(joueurs);
  } catch (error) {
    console.error("❌ Erreur scraping :", error.message);

    res.status(500).json({
      error: "Erreur scraping",
      detail: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend lancé sur ${PORT}`);
});
