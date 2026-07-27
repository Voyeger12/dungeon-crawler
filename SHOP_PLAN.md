# Runedeep – Thinktank-Beschluss für Lydias Shop

Stand: 23. Juli 2026
Status: freigegebene Planungsgrundlage, noch nicht implementiert

## Gemeinsame Leitidee

Lydia ist keine beliebige Menühändlerin, sondern **„Lydia, Hüterin der letzten Esse“**: eine ehemalige Ausrüsterin der zerbrochenen Krone. Sie birgt und repariert Ausrüstung gescheiterter Runenträger und versorgt den Spieler vor dem tieferen Abstieg.

Sie erscheint garantiert einmal pro Run in einem sicheren Händler- und Rastraum vor dem Boss. Die Begegnung ist freiwillig: Erst die Interaktion mit `E` öffnet den Shop und pausiert die Spielwelt vollständig.

Gold, gekaufte Ausrüstung, Vorräte und Shopbestand gelten nur für den aktuellen Run. Dauerhaft freigeschaltet werden später lediglich neue Itemtypen, Lydia-Dialoge, Lore und kosmetische Inhalte – keine pauschalen permanenten Charakterwerte.

## Technische Voraussetzung

Vor der Shop-Oberfläche wird eine zentrale, deterministische Werteberechnung benötigt:

```text
Basiswerte
  → Runensegen
  → Ausrüstung
  → Relikte
  → temporäre Effekte
  = effektive Charakterwerte
```

Waffen- und Rüstungswechsel dürfen niemals Werte direkt wiederholt addieren oder multiplizieren. Ein reiner `calculatePlayerStats()`-Dienst berechnet immer den vollständigen Endzustand neu. Damit bleiben Vorschau, Charakterbogen und tatsächliches Gameplay identisch.

Benötigte Ausrüstungsplätze:

- `mainHand`
- `body`
- `back`

Spätere Plätze:

- `offHand`
- `head`
- `belt`

Itemdefinitionen enthalten ausschließlich Daten: ID, Name, Kategorie, Platz, Preis, Seltenheit, Modifikatoren, Beschreibung und Asset-IDs. Kaufregeln oder Effekte werden nicht als frei ausführbare Funktionen im Katalog gespeichert.

## MVP: erster spielbarer Lydia-Shop

Der erste Vertical Slice enthält:

- einen garantierten sicheren Lydia-Raum
- einen sichtbaren Lydia-NPC mit Interaktionshinweis
- fünf Angebote, die beim erneuten Öffnen unverändert bleiben
- Kaufen und sofortiges Ausrüsten
- exakte Vorher-/Nachher-Werte
- vollständig pausierte Spielwelt
- Maus- und Tastaturbedienung mit sichtbarem Fokus
- keine Verkäufe, Rückkäufe, Shop-Rerolls, Relikte oder komplexe Inventarverwaltung

### Erstes Sortiment

1. eine garantierte Waffe
2. eine garantierte Rüstung
3. ein Heiltrank für 25 Gold
4. ein Wundverband für 20 Gold, der sofort 30 LP heilt
5. eine zweite, noch nicht angebotene Waffen- oder Rüstungsoption

Vorgeschlagene erste Ausrüstung:

| Gegenstand | Preis | Wirkung |
|---|---:|---|
| Grabeneisen-Langschwert | 80 | ×1,12 Schaden, ×1,04 Angriffsintervall, +8 Reichweite |
| Aschenfang | 120 | ×0,92 Schaden, ×0,82 Angriffsintervall, +5 Prozentpunkte Krit-Chance, −6 Reichweite |
| Geflicktes Wolfsleder | 65 | +2 Rüstung, +5 % Bewegungstempo |
| Rußiges Kettenhemd | 95 | +4 Rüstung, −5 % Bewegungstempo |

Der gesamte Warenwert liegt bewusst über dem durchschnittlich verfügbaren Gold. Der Shop soll eine Entscheidung zwischen Ausrüstung, Heilung und Level-up-Rerolls erzeugen, keinen vollständigen Einkauf.

Die Endwertung basiert weiterhin auf gefundenem Gold und nicht auf Restgold. Kaufen verschlechtert dadurch nicht den Score.

## Backpack

Der sichtbare Backpack bleibt ein fest eingeplanter Ausbau, folgt aber direkt nach dem stabilen Kernshop. Vorher müssen der Platz `back`, ein nachvollziehbares Trankmaximum und das Verhalten bei vollen Slots definiert sein.

Erster Vorschlag:

- **Lydias kleiner Feldrucksack**
- ungefähr 95 Gold
- erhöht das Trankmaximum um 2
- enthält beim Kauf einen Heiltrank
- ist am Rücken und durch vordere Gurte sichtbar

Die Darstellung verwendet modulare Ebenen statt vollständiger Figurenatlanten für jede Kombination:

1. hinterer Backpack- oder Scheiden-Layer
2. Körper
3. Rüstung und Gurte
4. Arme und Hauptwaffe
5. vordere Ausrüstungsteile
6. Effekte

Shopvorschau und Weltfigur müssen denselben Ausrüstungsrenderer verwenden. Hitboxen ändern sich durch sichtbare Ausrüstung nicht.

## Shop-Oberfläche

Der Shop wirkt wie eine Werkbank aus dunkler Eiche, abgenutztem Leder, geschwärztem Eisen und stumpfem Messing – nicht wie eine moderne Produktseite.

Aufbau:

- Kopfzeile: „Lydias letzte Esse“, Lydia-Zeile und aktuelles Gold
- links: Kategorien mit Symbol und Text
- Mitte: maximal fünf große Warenplaketten
- rechts: Gegenstandsvorschau, Charakter-Paperdoll und Wertevergleich
- eindeutige Aktion: `Kaufen` oder `Kaufen & ausrüsten`

Vergleiche verwenden Text, Zahlen und Symbole statt nur Farbe:

```text
Schaden 24 → 29 (+5)
Tempo 205 → 195 (−10)
```

Bei zu wenig Gold bleibt das Angebot sichtbar, wird aber verständlich deaktiviert. Verkaufte Ware bleibt mit einem sichtbaren „Verkauft“-Stempel bestehen.

## Sicherer Zustandsfluss

```text
running
  → E in Lydias Reichweite
  → shop / browsing
  → Angebot auswählen
  → Kauf bestätigen
  → Transaktionssperre
  → Gold exakt einmal abziehen
  → Item exakt einmal vergeben und ausrüsten
  → Werte neu berechnen
  → browsing
  → Escape
  → running
```

Öffnen und Schließen neutralisieren die Eingaben. Weder `E`, ein Doppelklick noch eine gehaltene Bestätigung darf einen unbeabsichtigten Kauf oder Angriff auslösen.

Controller-Unterstützung wird über eine allgemeine Menü-Aktionsschicht ergänzt und nicht als Shop-Sonderlösung gebaut.

## Spätere Ausbaustufen

### Phase 2 – Sortiment und Backpack

- sichtbarer Backpack und Utility-Platz
- mehrere Waffen- und Rüstungsvarianten
- kontrolliert zufälliger, deterministischer Bestand
- Seltenheiten und ebenenabhängige Angebote
- Restock: 40 Gold, danach 70, 100 und jeweils weitere +30

### Phase 3 – Lydia-Fortschritt

- Vertrauen durch ersten Kauf eines Runs, Boss-Siege und Storyfunde
- neue Itemtypen, Startoptionen, Kosmetik und Dialoge
- Lydia im späteren Hub
- keine permanenten direkten Statboni

### Phase 4 – erweiterter Handel

- Verkaufen oder Inzahlungnahme
- Favorisieren oder Sperren eines Angebots
- seltene Kuriositäten
- neue Waffenfamilien mit eigenen Animationen und Timings
- Schmieden, Sockeln oder Aufwerten erst nach stabiler Grundökonomie

## Risiken vor der Umsetzung

1. Beschworene Gegner dürfen kein unbegrenzt farmbares Gold erzeugen.
2. Der Goldbonus des Goldenen Schädels muss mit dem Shop neu simuliert werden.
3. Ausrüstungswechsel dürfen keine kumulative Wertedrift verursachen.
4. Bestand, Gold und Kaufstatus müssen eine atomare Transaktion bilden.
5. Lydia darf keinen Ausgang blockieren und ist im MVP nicht kollidierend.
6. Waffen-, Rüstungs- und Backpack-Layer benötigen identische Frameanker.
7. Shop und Level-up dürfen niemals gleichzeitig geöffnet sein.
8. Der Shop muss bei 720p bis 1440p und 90–125 % UI-Skalierung lesbar bleiben.

## QA und Abnahme

Vor dem finalen Balancing werden mindestens 10.000 deterministische Goldsimulationen mit und ohne Rerolls sowie mit dem Goldenen Schädel durchgeführt.

Der MVP gilt als fertig, wenn:

- Lydia in jedem Run garantiert erreichbar ist.
- der Shop nur in einer sicheren Situation geöffnet werden kann.
- die Spielwelt während des Shops vollständig pausiert.
- Angebote, Preis, Gold und echte Endwerte klar dargestellt werden.
- Gold und Item pro Kauf jeweils exakt einmal verändert werden.
- Doppelklicks und gehaltene Eingaben keine Mehrfachkäufe auslösen.
- unzureichendes Gold keinen Spielzustand verändert.
- Ausrüstungswechsel keine Werte aufschaukeln.
- Bestand und verkaufte Ware beim erneuten Öffnen erhalten bleiben.
- der neue Run ohne Gegenstände und Käufe des vorherigen Runs startet.
- Shop, Charaktervorschau und Weltfigur dieselbe sichtbare Ausrüstung zeigen.
- alte Profilspielstände weiterhin sicher geladen werden.
