# Open House Card (prototype)

Students scan a poster, make a personal card on their phone and save it. They can then choose to send their details for follow-up.

**Use made-up details only until the data protection officer approves real collection.**

## Run it

Requires Node.js 24 or later. There's nothing to install.

```bash
npm run seed
npm start
```

- Card maker: http://localhost:3000/
- Printable poster: http://localhost:3000/poster.html
- Staff list: http://localhost:3000/admin.html (the token is printed when the server starts)

`npm test` runs the server tests.

## Where data goes

- The photo and card stay in the browser. They are never uploaded.
- Only the optional follow-up form sends data. It's stored in `data/test-leads.sqlite`.
- To clear the test data, stop the server and delete the `data` folder.

## Before the event

1. Replace the placeholders in `public/config.js`, including the logo, colors, event date and programs.
2. Get the data protection officer's decision on guardian consent, retention and storage location, then update the form and wording.
3. Have the Thai wording in `public/i18n.js` reviewed.
4. Move the database to the approved system and deploy over HTTPS. This local server and its SQLite file are for testing only.
5. Set `testMode: false` in `public/config.js`.
6. Test on real iPhone and Android phones, including scanning the poster with LINE and scanning a card's QR code from another phone.
7. Print the poster from the final website address.
