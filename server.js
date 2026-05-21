const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

// ✅ Mets tes cookies ici
const COOKIES = [
  {
    "name": "datadome",
    "value": "1WICZHgcIcTaoVMPewpDfGDTUJPdepQTOFOxzeFgXHjHhajujeJf8OWFVVD_93Qx3csa9nVFYGxR01JMsX5DnF40P0mHo1UVyHN78Q96mAVEJ6r4HZ4jHBSxsYhKCPdS",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "dtCookie",
    "value": "v_4_srv_29_sn_13196770680B0E18FC3574E87C64847C_perc_100000_ol_0_mul_1_app-3A2250bc529529d819_0_rcs-3Acss_0",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "i18n_redirected",
    "value": "fr",
    "domain": "tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "pa_user",
    "value": "%7B%22id%22%3A%227146157482%22%2C%22category%22%3A%2217%22%7D",
    "domain": "tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "QueueITAccepted-SDFrts345E-V3_tenupprod",
    "value": "EventId%3Dtenupprod%26RedirectType%3Dsafetynet%26IssueTime%3D1779377072%26Hash%3D7bdcde1887aa3dc207bef871b35379719cd6ef4c994f4323187e8b765b329737",
    "domain": "tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "SHARED_SESSION_JAVA",
    "value": "5f9eb3d7-5332-4994-80a7-a03e8e301ce4",
    "domain": "tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "SSESS7ba44afc36c80c3faa2b8fa87e7742c5",
    "value": "9IiI6LFD9yzYL6WmYUiqqAhEbPVZbpEuadEtjmvZy5U",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "tc_cj_v2",
    "value": "%5Ecl_%5Dny%5B%5D%5D_mmZZZZZZKQOLPOMSMJNJQZZZ%5D777_rn_lh%5BfyfcheZZZ%2F%20%290%2BH%2C0%200%20G%24%2FH%29%20%2FZZZKQOQPQNQLJRPQZZZ%5D777%5Ecl_%5Dny%5B%5D%5D_mmZZZZZZKQOQPQOLMKSJJZZZ%5D777_rn_lh%5BfyfcheZZZ%2F%20%290%2BH%2C0%200%20G%24%2FH%29%20%2FZZZKQOQPRQSLSMMMZZZ%5D777m_iZZZ%22**%22%27%20ZZZKQOSKLSQNRMNRZZZ%5D777_rn_lh%5BfyfcheZZZ%2F%20%290%2BH%2C0%200%20G%24%2FH%29%20%2FZZZKQOSKMKSQQMSRZZZ%5D777%5Ecl_%5Dny%5B%5D%5D_mmZZZZZZKQOSKMLKQRMOMZZZ%5D777_rn_lh%5BfyfcheZZZ%2F%20%290%2BH%2C0%200%20G%24%2FH%29%20%2FZZZKQOSMMMPSJSNPZZZ%5D777%5Ecl_%5Dny%5B%5D%5D_mmZZZZZZKQOSMMMQKJMPLZZZ%5D777_rn_lh%5BfyfcheZZZ%2F%20%290%2BH%2C0%200%20G%24%2FH%29%20%2FZZZKQOSNKONOOLLQZZZ%5D",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "tc_cj_v2_cmp",
    "value": "",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "tc_cj_v2_med",
    "value": "",
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "TC_PRIVACY",
    "value": "0%40033%7C64%7C3288%402%2C3%2C4%405%401760081969009%2C1760081969009%2C1793777969009%40",
    "domain": ".tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "TC_PRIVACY_CENTER",
    "value": "2%2C3%2C4",
    "domain": ".tenup.fft.fr",
    "path": "/"
  },
  {
    "name": "TCPID",
    "value": 12510593927115708000,
    "domain": ".fft.fr",
    "path": "/"
  },
  {
    "name": "userStore",
    "value": "%7B%22isLogged%22%3Atrue%2C%22user%22%3A%7B%22id%22%3A7146157482%2C%22idPersonne%22%3A93815495%2C%22nom%22%3A%22VOSSIER%22%2C%22prenom%22%3A%22LOIC%22%2C%22civilite%22%3A%22M%22%2C%22classement%22%3A%2230%2F2%22%2C%22pratiquePrincipale%22%3A%22PADEL%22%2C%22pratiqueSecondaire%22%3A%5B%22TENNIS%22%5D%2C%22licencie%22%3Atrue%2C%22licencieMillesimePrecedent%22%3Atrue%2C%22licencieMillesimeSuivant%22%3Afalse%2C%22licenceAttenteValidation%22%3Afalse%2C%22adherent%22%3Afalse%2C%22codeTypeLicence%22%3A%22CLU%22%2C%22groupes%22%3A%5B%22Licence%20Club%22%2C%22Juge%20arbitre%22%2C%22Comp%C3%A9titeur%22%2C%22Licenci%C3%A9%22%5D%2C%22clubs%22%3A%5B%7B%22code%22%3A%2260340270%22%2C%22nom%22%3A%22TC%20BAILLARGUES%22%7D%5D%2C%22codeClubActif%22%3A%2260340270%22%2C%22nbPaiementsEnAttente%22%3A0%2C%22completionConnexionRequise%22%3Afalse%2C%22completionDonneesRequise%22%3Afalse%2C%22completionCGARequise%22%3Afalse%2C%22completionHonorabilite%22%3Afalse%2C%22millesimeSuivant%22%3Atrue%2C%22dirigeant%22%3Afalse%2C%22president%22%3Afalse%7D%7D",
    "domain": "tenup.fft.fr",
    "path": "/"
  }
];

app.get("/", (req, res) => {
  res.send("✅ Backend connecté TenUp OK");
});

// ✅ scraping automatique connecté
app.get("/classement", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();

    // ✅ injecter cookies (connexion automatique)
    await page.setCookie(...COOKIES);

    await page.goto(
      "https://tenup.fft.fr/classement/7146157482/padel",
      { waitUntil: "networkidle2" }
    );

    await page.waitForSelector(".table-ranking");

    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        ".table-ranking tbody tr"
      );

      const result = [];

      rows.forEach((row) => {
        const cols = row.querySelectorAll("td");

        if (cols.length >= 4) {
          result.push({
            saison: cols[0].innerText,
            classement: cols[1].innerText,
            date: cols[2].innerText,
            progression: cols[3].innerText,
          });
        }
      });

      return result;
    });

    await browser.close();

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



app.listen(3000, () => {
  console.log("✅ Backend prêt");
});
