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
- Only the optional follow-up form sends data, to the Supabase project `open-house-card` (Singapore region).
- The database setup is in `supabase/migrations`. Entries sit in a private table that the public key cannot read. The site can only add entries, and staff actions need the staff token.
- The staff token is in `data/staff-token.txt` on the computer that set it up. It isn't in GitHub. To change it, follow the note at the end of the migration file.
- To use the local test database instead, set `supabase: null` in `public/config.js`. Local entries go to `data/test-leads.sqlite`.

## Hosting

The site is static and deploys to Vercel from the `main` branch. `vercel.json` serves the `public` folder with security headers. The local server isn't used online.

If you change the programs or the consent wording version in `public/config.js`, update `private.programs` or `private.settings` in Supabase to match, or new entries will be refused.

## Before the event

1. Replace the placeholders in `public/config.js`, including the logo, colors, event date and programs.
2. Get the data protection officer's decision on guardian consent, retention and storage location, then update the form and wording.
3. Have the Thai wording in `public/i18n.js` reviewed.
4. Confirm with the data protection officer that Supabase in Singapore is acceptable, or move the entries to the approved system.
5. Set `testMode: false` in `public/config.js`.
6. Test on real iPhone and Android phones, including scanning the poster with LINE and scanning a card's QR code from another phone.
7. Print the poster from the final website address.
