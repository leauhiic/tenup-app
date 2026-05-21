require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

// 🔐 LOGIN (redirige vers TenUp)
app.get("/login", (req, res) => {
  const url = `https://api.fft.fr/oauth/authorize?response_type=token&client_id=${process.env.TENUP_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`;

  res.redirect(url);
});

// 📊 Tournois
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
    res.status(500).json({ error: "Erreur TenUp" });
  }
});

app.listen(3000, () => console.log("✅ API prête"));

app.get("/", (req, res) => {
  res.send("✅ Backend TenUp OK");
});
