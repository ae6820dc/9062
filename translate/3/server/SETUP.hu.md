# Google Translate bekapcsolása a 3-as változathoz

A program elkészült, de a Google-kapcsolat jelenleg **nincs bekapcsolva**. A GitHub Pages a felületet szolgálja ki; a Google-fordításhoz külön, saját Google Cloud-projekt kell. A kézi szótár, az import/export és az offline keresés ettől függetlenül működik.

## 1. Saját Google Cloud-projekt

Nyisd meg a [Google Cloud Console-t](https://console.cloud.google.com/), hozz létre egy külön projektet, és kapcsold hozzá a számlázást. A szolgáltatások használata költséget okozhat; a Google-fordítás karakterdíja mellett a Cloud Run, a build és a Firestore is külön szolgáltatás. Ne indítsd el a telepítést, amíg ezt nem szeretnéd vállalni. A telepítési lépéseket a Codex nem futtatta le, fizetős Google-hívás nem történt.

Jegyezd fel a projekt **azonosítóját**, nem csak a megjelenített nevét. Hozz létre költségfigyelést, és állíts be fordítási kvótát is. A költségfigyelés értesít, önmagában nem állítja le a költést. [Google beállítási útmutató](https://docs.cloud.google.com/translate/docs/setup), [árak](https://cloud.google.com/products/translate/pricing).

## 2. Google-bejelentkezés

A Google Auth Platform felületén állítsd be a beleegyezési képernyőt, majd hozz létre egy **Web application** típusú OAuth-klienst. Engedélyezett JavaScript-origin:

```text
https://ae6820dc.github.io
```

Az origin után nem kell `/9062/translate/3/` útvonal. Tesztelési állapotban add hozzá a saját Google-fiókodat a tesztfelhasználókhoz. Jegyezd fel a `…apps.googleusercontent.com` végű **Client ID-t**. Client secret vagy API-kulcs nem kerül a böngészőbe vagy a GitHub-repóba. [Google Identity beállítás](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## 3. Háttérszolgáltatás telepítése

Nyisd meg a Google Cloud Console **Cloud Shell** ablakát. Az alábbi parancsok csak a saját projektedben futtatva telepítenek. A nagybetűs példák helyére a saját adataid kerüljenek. Az egyszerű engedélyezéshez saját Gmail-címet használj; más e-mail-szolgáltatónál a szerver stabil Google `sub`-azonosító engedélyezését támogatja.

```bash
PROJECT_ID='IDE-A-SAJAT-PROJEKT-AZONOSITO'
CLIENT_ID='IDE-A-WEB-CLIENT-ID.apps.googleusercontent.com'
OWNER_EMAIL='IDE-A-SAJAT-GMAIL-CIM@gmail.com'
REGION='europe-west1'

gcloud config set project "$PROJECT_ID"
gcloud services enable translate.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com
gcloud iam service-accounts create translate3 --display-name='Unicode Translate 3'
SERVICE_ACCOUNT="translate3@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SERVICE_ACCOUNT}" --role=roles/cloudtranslate.user
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SERVICE_ACCOUNT}" --role=roles/datastore.user
```

A Firestore adatbázis a napi keretet tartja nyilván. Új, erre kijelölt projektben:

```bash
gcloud firestore databases create --database='(default)' --location=eur3 --type=firestore-native
```

Ha már létezik `(default)` adatbázis, azt használd, ne töröld és ne hozd létre újra. A telepítéshez a saját felhasználódnak a Google által kért Cloud Run/Cloud Build/Artifact Registry telepítési jogosultságokkal is rendelkeznie kell; a futó szolgáltatás fenti két szerepköre ettől különbözik.

```bash
git clone https://github.com/ae6820dc/9062.git
cd 9062/translate/3/server
gcloud run deploy unicode-translate-3 \
  --source . \
  --region "$REGION" \
  --service-account "$SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --max-instances 2 \
  --concurrency 4 \
  --timeout 60 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLIENT_ID=${CLIENT_ID},ALLOWED_GOOGLE_EMAILS=${OWNER_EMAIL},ALLOWED_ORIGINS=https://ae6820dc.github.io,DAILY_CHARACTER_LIMIT=10000"
```

A `--allow-unauthenticated` a Cloud Run külső elérhetőségét teszi lehetővé. Az alkalmazás maga minden fordítás előtt ellenőrzi a Google-bejelentkezést és az engedélyezett fiókot; bejelentkezés nélkül nem továbbít fizetős kérést. Üres fiókengedélyezéssel el sem indul.

A szolgáltatás külön API-kulcs helyett a hozzá rendelt szolgáltatásfiókot használja. Készítsd fel a projektet a [Cloud Run forrásból telepítés](https://docs.cloud.google.com/run/docs/deploying-source-code) által kért build-jogosultságokra is. A Docker-képfájl telepítési forrását a `server/Dockerfile` rögzíti; a függőségeket a `pnpm-lock.yaml` rögzíti.

## 4. A felület összekapcsolása

A sikeres telepítés kiír egy `https://…run.app` szolgáltatáscímet. A repó `translate/3/google-config.json` fájljában töltsd ki:

```json
{
  "serviceUrl": "https://A-SAJAT-SZOLGALTATAS.run.app",
  "clientId": "A-SAJAT-WEB-CLIENT-ID.apps.googleusercontent.com"
}
```

Ez a két érték nyilvános beállítás, nem titkos kulcs. Commit és push után a Pages frissíti a felületet. A **3-as változatot** nyisd meg, válaszd az **Add expression**, majd **Fill translations with Google Translate** lehetőséget. Jelentkezz be az engedélyezett Google-fiókkal, írj be egy kifejezést, jelöld a kívánt üres nyelveket, és kattints a **Translate with Google** gombra. Először egy rövid kifejezéssel és egy célnyelvvel próbáld ki. A javaslatokat nézd át, majd külön mentsd el.

Ha ezt a két nyilvános értéket később megadod a Codexnek, a felületi összekapcsolást be tudja fejezni. Jelszót, client secretet, hozzáférési tokent és szolgáltatásfiók-kulcsot ne másolj a beszélgetésbe vagy a repóba.

## Működési korlátok és hibák

- Csak a gombra kattintáskor kért forrásszöveg és a választott nyelvek jutnak el a szolgáltatáshoz és a Google-hez. A teljes személyes szótár nem kerül feltöltésre. A Google-bejelentkezés nem szinkronizálja a szótárad.
- Alapértelmezésben naponta összesen 10 000 forráskarakter × célnyelv engedélyezett, UTC-nap szerint, az összes engedélyezett felhasználóra és összes Cloud Run-példányra együtt. Firestore-tranzakció foglalja le a keretet a Google-hívás előtt. Sikertelen és megszakított próbák is foglalhatnak keretet; ez szándékosan konzervatív. A Firestore-hiba letiltja a fizetős kérést.
- További korlát: legfeljebb 10 kérés/perc/felhasználó/szerverpéldány, 4 aktív kérés/példány, 4 096 karakteres forrásszöveg, legfeljebb 8 célnyelv. A Google-kérés nem ismétlődik automatikusan hiba esetén.
- A napi korlát nem a teljes Google Cloud-számla felső határa: más projekthasználat, tárhely, tárhelyműveletek, build és hoszting is költséget okozhat. A Google Cloud saját kvótáit és költségfigyelését is állítsd be.
- **401:** jelentkezz be újra. **403:** ellenőrizd az engedélyezett fiókot, a Client ID-t és az origint. **429:** perc- vagy napi keret elfogyott. **503:** ellenőrizd a szolgáltatásfiók jogosultságait, a számlázást, az API-kat és a Firestore-t.
- A mostani automatikus tesztek ellenőrzött válaszokkal vizsgálják a felületet és a hibakezelést. Valódi Google-bejelentkezés, fizetős fordítás, Cloud Run-telepítés és tényleges Firestore-működés a saját projekt bekapcsolása után ellenőrizhető.

## Leállítás

Azonnali felületi kikapcsoláshoz állítsd üresre a `google-config.json` két értékét, és töltsd fel a változást. A háttérköltségek teljes megszüntetéséhez a saját Google Cloud-projektedben külön kezeld a Cloud Run-szolgáltatást, a build-képeket és a Firestore-t. A kézi és offline szótár ettől továbbra is használható.
