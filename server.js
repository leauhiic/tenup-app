const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

// 🔐 redirection login TenUp
app.get("/login", (req, res) => {
  const url =
    "https://api.fft.fr/oauth/authorize?response_type=token&client_id=tenup-mobile&redirect_uri=https://leauhiic-tenup-app-front.vercel.app/callback";

  res.redirect(url);
});

// ✅ test backend
app.get("/", (req, res) => {
  res.send("✅ Backend TenUp OK");
});

// 📋 tournois
app.get("/tournois", async (req, res) => {
  try {
    const token = req.headers.authorization;

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

app.listen(3000, () => {
  console.log("✅ Backend prêt");
});

app.get("/", (req, res) => {
  res.send("✅ Backend TenUp OK");
});
