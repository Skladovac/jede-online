# Facebook – ověření a kontrola aplikace (pokemon.jede.online)

Aplikace: **pokemon.jede.online**, App ID `1085877207554190`
Tlačítko na webu je skryté (`FACEBOOK_BUTTON_HIDDEN=1` v `/opt/jede/pokemon.env`). Po schválení řádek smaž a nasaď znovu.

## 1. Ověření (Business verification) – dělá Tomáš
developers.facebook.com → aplikace → Zveřejnit → **Start Verification**
- Ověřit jde firmu, organizaci nebo fyzickou osobu (živnost). Elasra portfolio NEPOUŽÍVAT.
- Doklady: výpis z ŽR/OR (IČO, adresa), doménový e-mail nebo telefon na adresu firmy.
- Doména pro ověření: jede.online.

## 2. Kontrola aplikace (App Review) – texty do formuláře

**Platform:** Website — https://pokemon.jede.online

**email — How will your app use this permission?**
> pokemon.jede.online is a free community website for Pokémon card collectors in the Czech Republic and Slovakia. Users can sign in with Facebook instead of creating a password. We use the email address only to create and identify the user's account, to link it with an existing account registered with the same email, and to send account-related notifications (password reset, trade match notifications the user opted into). The email is never shown to other users and never shared with third parties.

**public_profile — How will your app use this permission?**
> We use the user's name only to pre-fill the greeting on the sign-up completion page ("Hi {first name}!"). The user then chooses a public nickname; the Facebook name and profile picture are not displayed on the site and not stored beyond the account's Facebook ID used for login.

**Step-by-step instructions for the reviewer:**
> 1. Open https://pokemon.jede.online/api/auth/facebook (the Facebook button is hidden on the public login page until this review is approved).
> 2. Log in with Facebook and grant access.
> 3. On the "Ještě pár údajů" (A few more details) page choose a nickname, birth year/month (adult), country and region, accept the terms and click "Dokončit registraci".
> 4. You are now logged in; your account page is https://pokemon.jede.online/ucet ("Můj účet") and shows "Linked sign-in: Facebook".
> 5. Data deletion instructions: https://pokemon.jede.online/smazani-dat

**Screencast (vyžadováno):** záznam obrazovky 1–2 min podle kroků 1–4 výše (Windows: Win+Alt+R v Xbox Game Bar, nebo Win+Shift+S → Záznam).

**Data handling otázky:**
- Data processors / third parties: **No** (data neposkytujeme třetím stranám).
- Responsible entity: provozovatel jede.online (dle ověření).
- Data requests from public authorities: nikdy nebyly; postupujeme dle zákona.
- Deletion: uživatel si účet smaže sám v /ucet, nebo e-mailem pokemon@jede.online.
