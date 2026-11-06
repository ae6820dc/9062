# Munkahelyi üzenőfal

Program ID: `A4F29C7E16B803D5`

GitHub Pages felület: https://ae6820dc.github.io/9062/message/board/work/

**Állapot: a kód elkészült; a Render háttérszolgáltatás még nincs elindítva.**

## Működés

Közös jelszóval védett munkahelyi fal. A belépő választ egy megjelenítési nevet; a név nem ellenőrzött személyazonosság. A szerver ellenőrzi a jelszót, az üzenetek és a munkamenetek nem kerülnek a GitHubra. A jelszó scrypt kivonatként kerül az adatbázisba. A belépés 12 órára szól, a munkamenet tokenje a böngésző adott lapjának sessionStorage tárolójában van. Tárolókulcs: `A13D806FB92E4C75`.

Az új üzenetek négy másodpercenként jelennek meg, amíg a lap látható. A korábbi üzenetek ötvenesével visszatölthetők. Küldés gomb vagy Ctrl+Enter. A hibás hálózati kérés megismétlése nem hozza létre kétszer ugyanazt az üzenetet. A szerver korlátozza a belépési kísérleteket és az üzenetküldési gyakoriságot. A felület sima szövegként jeleníti meg az üzeneteket, HTML nem futtatható bennük.

## Render telepítés

A `render.yaml` kizárólag ehhez a falhoz készít egy frankfurti Python webszolgáltatást, egy példánnyal és 1 GB tartós lemezzel. Nem módosítja a meglévő Android szolgáltatást. A konfiguráció **fizetős** (`starter` webszolgáltatás + 1 GB lemez); létrehozás csak a költség jóváhagyása után.

A Blueprint fájl helye a repositoryban: `message/board/work/render.yaml`.

A `DB_PATH` kizárólag a tartós lemezen lévő `/var/data/board.sqlite3` fájlra mutasson. Az ingyenes Render-példány ideiglenes fájlrendszerére telepített SQLite adatbázis elveszne újraindításkor, ezért az nem megfelelő éles tárolásra.

Telepítés után a `config.js` fájlban a `window.BOARD_API` értéke a tényleges Render URL legyen. Amíg nincs megadva, a GitHub-oldal előkészítés alatt állóként jelenik meg. Ugyanez a felület a Render gyökércíméről is elérhető.

Első beállítás: a Render által generált `SETUP_TOKEN` titkos környezeti változó értékét az üzemeltető egyszeri beállító linkben adja át a tulajdonosnak: `https://<render-host>/#setup=<URL-kódolt-token>`. A token a cím töredékében van, a felület rögtön eltávolítja a címsorból. A tulajdonos itt adja meg a közös jelszót (8–128 karakter). A beállítás csak egyszer végezhető el, az adatbázis létező jelszavát nem írja felül. A beállítás után a token el is távolítható a Render környezeti változói közül. Jelszót vagy beállítási tokent soha ne írjunk a repositoryba.

A szolgáltatás egy példánnyal fut, mivel a lemez nem megosztott. Telepítéskor rövid kiesés lehetséges. Családi vagy baráti falhoz külön adatbázisfájl, jelszó és felület szükséges.

## Mentés és visszaállítás

Az SQLite fájlról az SQLite backup API-val vagy `sqlite3 ... '.backup ...'` paranccsal készíts konzisztens mentést, és azt töltsd le biztonságos helyre. Az élő WAL adatbázisfájlt ne másold önmagában, és adatbázis-visszaállításra ne hagyatkozz pusztán lemezpillanatképre. A tartós lemez megőrzi az adatokat újratelepítéskor, de nem helyettesíti a külön biztonsági mentést.

## Helyi ellenőrzés

Python 3.11 vagy újabb szükséges. `pip install -r requirements.txt`, majd `python -m unittest -v test_app.py`.

Helyi próba: a `SETUP_TOKEN` és a `DB_PATH` környezeti változók megadása után `gunicorn app:app --bind 127.0.0.1:8000 --workers 1 --threads 4`.
