const fs = require("fs");
const db = require("./db");

// lire le JSON
const data = JSON.parse(
  fs.readFileSync("./tournois.json", "utf-8")
);

async function importData() {
  try {
    for (const t of data) {
      await db.query(
        `INSERT INTO tournois (date, nom, categorie, partenaire, classement, point, validite)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          t.date,
          t.nom,
          t.categorie,
          t.partenaire,
          t.classement,
          t.point,
          t.validite,
        ]
      );
    }

    console.log("✅ Import terminé !");
    process.exit();
  } catch (err) {
    console.error("❌ erreur :", err);
  }
}

importData();
