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

// ✅ route scraping
app.get("/classement", async (req, res) => {
  try {
    const url = "https://tenup.fft.fr/classement/7146157482/padel";

    // ✅ important : headers + timeout
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

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
    console.error("❌ Erreur scraping :", error.message);

    // ✅ fallback si TenUp bloque
    try {
      const proxyUrl =
        "https://api.allorigins.win/raw?url=https://tenup.fft.fr/classement/7146157482/padel";

      const proxyResponse = await axios.get(proxyUrl);

      const $ = cheerio.load(proxyResponse.data);
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

      res.json(joueurs);
    } catch (err) {
      res.status(500).json({
        error: "Erreur scraping",
        detail: err.message,
      });
    }
  }
});
