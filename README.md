# Formular

Statische HTML-, CSS- und JavaScript-Dateien für ein Telegram-Formular. Keine Installation und kein eigener Webserver erforderlich.

## GitHub Pages

1. `index.html`, `style.css`, `app.js`, `context.js`, `schema.js` und `.nojekyll` gemeinsam in ein Repository hochladen. Vorhandene Dateien dabei ersetzen.
2. Unter **Settings → Pages** die Veröffentlichung aus dem Branch und Ordner mit `index.html` aktivieren.
3. Die veröffentlichte HTTPS-Adresse in der Anwendung eintragen, die den Telegram-Bot betreibt.
4. Im privaten Bot-Chat ein Dokument und eine Person auswählen. Die Übersicht enthält **PDF generieren** und **Bearbeiten**. Unter **Bearbeiten → Formular öffnen** stehen die aktuellen Angaben bereits in den Eingabefeldern.
5. Nach **Änderungen übernehmen** sendet der Bot eine neue Übersicht. Dort kann das PDF erstellt werden.

Ohne aktive Anfrage zeigt die Seite ausschließlich leere Felder. Die Dateien enthalten keine Zugangsdaten, Kontaktdaten, Kennungen oder Kontoverbindungen. Keine weiteren Projektordner hochladen.

## Übergabe

Ein `web_app`-Button einer Telegram-Antworttastatur öffnet die Seite. Der Bot übergibt Dokumentart, aktuelle Werte und eine Anfragekennung zur Laufzeit im URL-Fragment `#form=…` als Base64URL-kodiertes UTF-8-JSON. `schema.js` enthält ausschließlich allgemeine Feldbeschreibungen für Mietvertrag, Wohnungsgeberbestätigung, WLAN-Vereinbarung, Klingelschilder und Betriebskostenabrechnung. Die aktuellen Werte werden weder in diese Dateien noch in das Repository geschrieben. Das Fragment wird nicht an den Hosting-Server gesendet. `context.js` liest es vor dem Telegram-SDK ein und entfernt es aus der sichtbaren Adresse. Der persönliche Formularlink selbst enthält die Werte unverschlüsselt und darf nicht öffentlich geteilt werden.

Die Seite verwendet `Telegram.WebApp.sendData` und übermittelt nur geänderte Formularfelder sowie eine kurzlebige Anfragekennung. Namenschilder werden als vollständige Liste zurückgegeben. Pro Nachricht sind höchstens 4096 UTF-8-Bytes möglich. Der Bot muss den Absender, die Berechtigung, die Anfragekennung, den aktuellen Bearbeitungsstand und sämtliche Werte prüfen. Browserdaten gelten niemals als Nachweis einer Berechtigung.

Die Seite benötigt keine Bot-Zugangsdaten, keinen direkten Zugriff auf die Anwendung und keine externe Datenbank. Der Formularcode enthält keine Analyseprogramme und schreibt selbst keine Cookies oder lokalen Datenspeicher. Die einzige externe JavaScript-Datei ist das offizielle Telegram-SDK. Die PDF-Erstellung und die Freigabe zum Drucken erfolgen im Bot.

Für eine Bildanlage zur Betriebskostenabrechnung wird das Bild als Foto oder Bilddatei im privaten Bot-Chat gesendet. Der Bot fügt es dem PDF auf Seite 2 hinzu. Eine bestehende Bildanlage lässt sich im Formular entfernen. Bilder werden wegen der Größenbegrenzung nicht über `sendData` übertragen.

Eine bestehende Anfrage kann nur einmal verwendet werden. Für weitere Änderungen im Chat ein neues Formular öffnen. Telegram-Webformulare über diese Tastatur sind für private Chats vorgesehen; in Gruppen bleibt die Bearbeitung über die Bot-Schaltflächen verfügbar.

Dokumentation: [Telegram Mini Apps](https://core.telegram.org/bots/webapps#keyboard-button-mini-apps).
