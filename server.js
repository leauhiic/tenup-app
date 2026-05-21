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
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(response.data);

    const joueurs = [];

    // ✅ cibler la bonne table
    $(".table-ranking tbody tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 4) {
        const joueur = {
          saison: $(cols[0]).text().trim(),
          classement: $(cols[1]).text().trim(),
          date: $(cols[2]).text().trim(),
          progression: $(cols[3]).text().trim(),
        };

        joueurs.push(joueur);
      }
    });

    res.json(joueurs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/tournois", async (req, res) => {
  try {
    const url = "https://tenup.fft.fr/classement/7146157482/padel";

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(response.data);

    const tournois = [];

    $(".mes-competitions-container tbody tr").each((i, el) => {
      const cols = $(el).find("td");

      if (cols.length >= 7) {
        tournois.push({
          date: $(cols[0]).text().trim(),
          nom: $(cols[1]).text().trim(),
          categorie: $(cols[2]).text().trim(),
          partenaire: $(cols[4]).text().trim(),
          points: $(cols[6]).text().trim(),
        });
      }
    });

    res.json(tournois);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
