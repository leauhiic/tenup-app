const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ Backend OK Railway fonctionne");
});

const PORT = process.env.PORT || 3000;

// 🔥 IMPORTANT : écoute sur 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server started on ${PORT}`);
});
