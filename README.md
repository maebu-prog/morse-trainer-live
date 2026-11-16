# Morse Trainer

Lern-App für Morsecode (ITU) – hören, selbst geben und auf dem Handy fühlen. Koch-Methode: erst zwei Zeichen (E und T), bei mindestens 90 % über die letzten Antworten kommt das nächste dazu.

Statische Website, kein Login. Fortschritt liegt in `localStorage` (`morse-trainer-v1`).

Live: https://maebu-prog.github.io/morse-trainer-live/

## Lokal

```bash
python3 -m http.server 8080
```

Tests:

```bash
node tools/test-morse.mjs
```

## Android

Im Chrome-Menü **Zum Startbildschirm hinzufügen**. Danach läuft die App auch offline (PWA).

## Hinweise

Merkwörter sind etablierte deutsche Eselsbrücken (Rhythmus-/O-Silbenmethode), keine eigenen Erfindungen. Für Tempo-Training zählt das Klangbild, nicht das Wort.
