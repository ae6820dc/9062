# Munkahelyi üzenőfal

Program ID: `A4F29C7E16B803D5`

Felület: https://ae6820dc.github.io/9062/message/board/work/

API: https://message-board-work.ae6820dc-message.workers.dev

## Éles háttér

Cloudflare Worker: `message-board-work`. Tartós D1 adatbázis: `message-board-work`, EU joghatóság. Az ingyenes Workers és D1 keretét használja; fizetős előfizetést nem állítottunk be. Kerettúllépéskor hibát jelezhet, az adatok megmaradnak. A régi Python/Render fájlok archív alternatívaként megmaradtak, jelenleg nem szolgálják ki az üzenőfalat.

## Működés

Közös jelszó, szabadon választott név (maximum 40 karakter). A név nem ellenőrzött személyazonosság. Az üzenet legfeljebb 4000 karakter, sima szövegként jelenik meg. A böngésző tíz másodpercenként frissít, amíg a lap látható; a régebbi üzenetek ötvenesével tölthetők vissza. A küldés ismétlése azonos nonce mellett nem dupláz.

Az üzenetek és munkamenetek a D1-ben vannak, nem a GitHubon. A belépés 12 órára szól, a token a sessionStorage `A13D806FB92E4C75` kulcsában van. A szerver a token SHA-256 kivonatát tárolja. A jelszó kivonata sózott, 100000 iterációs PBKDF2-SHA256, külön titkos pepperrel végzett előzetes HMAC után. A `PASSWORD_PEPPER` titkot újratelepítéskor meg kell őrizni.

## Első beállítás

A tulajdonos privát linket kap a `#setup=` töredékben levő egyszeri tokennel, amit a felület eltávolít a címsorból. A jelszó 8–128 karakter. Érvényes `SETUP_TOKEN` szükséges; meglévő jelszót a beállítás nem írhat felül. A normál link osztható meg a kollégákkal. A beállító link csak a tulajdonosnak való.

## Üzemeltetés

`worker.mjs`: API; `schema.sql`: idempotens adatbázisséma; `config.js`: nyilvános API-cím. Telepítés a Cloudflare API-n át. Bindings: D1 `DB`, szöveges `ALLOWED_ORIGIN=https://ae6820dc.github.io`, titkos `SETUP_TOKEN`, `PASSWORD_PEPPER`. Titkok soha ne kerüljenek a repositoryba; újratelepítéskor meg kell őrizni őket. Kompatibilitási dátum: 2026-11-06. Naplózás és traces mintavételezve bekapcsolva; az alkalmazás nem naplóz kéréstörzset, jelszót vagy tokent.

A CORS csak a GitHub Pages eredetet engedi. A jelszóellenőrzés szerveroldali. Belépési és beállítási kísérletek IP-címenként, küldések munkamenetenként korlátozottak.

Ellenőrzés Node 24+ alatt: `node test_worker.mjs`. Memóriabeli SQLite adapterrel ellenőrzi az API logikáját; nem helyettesíti a Cloudflare futtatókörnyezeti ellenőrzést. Mentés a D1 export funkciójával készíthető. Családi és baráti falhoz külön adatbázis és külön titkok szükségesek.

