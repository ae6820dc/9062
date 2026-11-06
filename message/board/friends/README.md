# Baráti üzenőfal

Program ID: `D85A9316F24C07BE`

Felület: https://ae6820dc.github.io/9062/message/board/friends/

API: https://message-board-friends.ae6820dc-message.workers.dev

## Éles háttér

Cloudflare Worker: `message-board-friends`. Tartós D1 adatbázis: `message-board-friends`, EU joghatóság. Az ingyenes Workers és D1 keretét használja; fizetős előfizetést nem állítottunk be. Kerettúllépéskor hibát jelezhet, az adatok megmaradnak. 

## Működés

Közös jelszó, szabadon választott név (maximum 40 karakter). A név nem ellenőrzött személyazonosság. Az üzenet legfeljebb 4000 karakter, sima szövegként jelenik meg. A böngésző tíz másodpercenként frissít, amíg a lap látható; a régebbi üzenetek ötvenesével tölthetők vissza. A küldés ismétlése azonos nonce mellett nem dupláz.

Az üzenetek és munkamenetek a D1-ben vannak, nem a GitHubon. A belépés 12 órára szól, a token a sessionStorage `7E2BD608C39A45F1` kulcsában van. A szerver a token SHA-256 kivonatát tárolja. A jelszó kivonata sózott, 100000 iterációs PBKDF2-SHA256, külön titkos pepperrel végzett előzetes HMAC után. A `PASSWORD_PEPPER` titkot újratelepítéskor meg kell őrizni.

## Első beállítás

A tulajdonos privát linket kap a `#setup=` töredékben levő egyszeri tokennel, amit a felület eltávolít a címsorból. A jelszó 8–128 karakter. Érvényes `SETUP_TOKEN` szükséges; meglévő jelszót a beállítás nem írhat felül. A normál link osztható meg a haverokkal. A beállító link csak a tulajdonosnak való.

## Üzemeltetés

`worker.mjs`: API; `schema.sql`: idempotens adatbázisséma; `config.js`: nyilvános API-cím. Telepítés a Cloudflare API-n át. Bindings: D1 `DB`, szöveges `ALLOWED_ORIGIN=https://ae6820dc.github.io`, titkos `SETUP_TOKEN`, `PASSWORD_PEPPER`. Titkok soha ne kerüljenek a repositoryba; újratelepítéskor meg kell őrizni őket. Kompatibilitási dátum: 2026-11-06. Naplózás és traces mintavételezve bekapcsolva; az alkalmazás nem naplóz kéréstörzset, jelszót vagy tokent.

A CORS csak a GitHub Pages eredetet engedi. A jelszóellenőrzés szerveroldali. Belépési és beállítási kísérletek IP-címenként, küldések munkamenetenként korlátozottak.

Ellenőrzés Node 24+ alatt: `node test_worker.mjs`. Memóriabeli SQLite adapterrel ellenőrzi az API logikáját; nem helyettesíti a Cloudflare futtatókörnyezeti ellenőrzést. Mentés a D1 export funkciójával készíthető. Családi és baráti falhoz külön adatbázis és külön titkok szükségesek.

## Automatikus helyfelszabadítás

A retention.mjs üzenetküldés előtt a D1 meta.size_after élő tárhelyméretét ellenőrzi. 450 000 000 bájt felett, a Free 500 MB határa előtt a legkisebb azonosítójú, legrégebbi üzeneteket törli százas csoportokban. Kisebb tárhelyhasználatnál sem életkor, sem darabszám alapján nem töröl. A D1 automatikus helyvisszanyerését éles, elkülönített próbatáblával ellenőriztük. Kérésenként legfeljebb 1000 üzenetet töröl; ha további takarítás szükséges, a küldés újrapróbálható. Nem töröl másik falról, és nem fizet elő nagyobb tárhelyre. A napi olvasási/írási kvóta kimerülését a törlés nem oldja meg. Teszt: node test_retention.mjs.

## Böngészős értesítések

Belépés után az Értesítések bekapcsolása gomb kér engedélyt. Azonos böngészőben falanként külön PushSubscription és service worker scope működik. Külön VAPID kulcspár tartozik minden falhoz; a privát JWK titkos VAPID_PRIVATE_KEY binding, a nyilvános kulcs VAPID_PUBLIC_KEY, a kapcsolat VAPID_SUBJECT. Nincs üzenettartalom vagy név a push szolgáltatónak küldött, törzs nélküli Web Push kérésben. Az értesítés általános szöveget jelenít meg; koppintással a megfelelő fal nyílik meg.

Csak mások aktív, 12 órás belépései kapnak értesítést. Kilépéskor a szerver törli az adott munkamenet feliratkozását. A gombbal eszközönként ki is kapcsolható. A böngésző és az Android értesítési/energiatakarékossági beállításai befolyásolhatják a kézbesítést. Újra belépéskor a korábban engedélyezett feliratkozás helyreáll.
