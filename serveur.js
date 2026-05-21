require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/tournois", async (req, res) => {
  const token = req.headers.authorization;

  try {
    const response = await axios.get(
      "https://api.fft.fr/fft/v1/competition/tournois",
      {
        headers: {
          Authorization: token,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erreur API TenUp" });
  }
});

app.listen(4000, () => {
  console.log("✅ Backend lancé sur port 4000");
});
