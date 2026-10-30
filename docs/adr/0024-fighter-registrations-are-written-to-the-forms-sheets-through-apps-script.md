---
status: accepted
---

# Fighter registrations are written to the forms' own sheets, through an Apps Script

Fighters used to register through three Google Forms — MMA, CageBox and Cage Grappling — each
writing a row to its own response sheet and putting the fighter's photo and highlights in
Drive. The forms moved onto the site as `/fighter-registration`. The sheets did not move,
because they are where TFC's matchmakers read registrations, and every registration so far is
already in them.

So the site writes to those sheets rather than to Postgres, and uploads to Drive rather than to
object storage. [[adr-0009]] stands: nothing new was provisioned, and the uploads live in the same Drive the
forms' uploads always did.

**The writing is done by an Apps Script, not by this server holding Google credentials.** The
sheets are reached through a personal Gmail account, datatsurtsumia5@gmail.com, and on a
personal account the usual server-to-Google route does not work: a service account has no Drive
storage of its own outside a paid Workspace shared drive, so it cannot upload a file into a
personal Drive at all. The other route, an OAuth client holding that account's refresh token,
means a Google Cloud project, an unverified-app consent screen, and a token that expires every
seven days unless the app is published. An Apps Script deployed as a web app runs as the account
that deployed it and uses its storage, and the only things this server holds are its URL and a
shared secret.

**Files go from the browser straight to Drive.** A highlight reel can be a gigabyte, and a
Vercel Function stops reading a request at 4.5 MB. The server asks the script to open a
resumable Drive upload, hands its URL to the browser, and the browser sends the file there; the
registration then names the files by the ids Drive gave them, and the script refuses any id that
is not in the folder it uploads to.

## Consequences

- There are no test sheets. A registration made from a laptop or a preview deploy is a real row
  on a real sheet, and is deleted by hand.
- A fighter who uploads and then abandons the form leaves files no row links to. They are left
  where they are; a clean-up is a later decision, not a gap.
- The Google Forms asked a fighter to sign in to Google before uploading, which was also the
  only thing keeping automated submissions out. The page has a honeypot field and nothing more.
  The uploads count against a free account's 15 GB, so if junk starts arriving, a challenge such
  as Cloudflare Turnstile is the next step.
- The script is code with a second home. `apps-script/fighter-registration/` is its source of
  truth, and changing it means pasting it into the Apps Script editor and deploying a new
  version of the existing deployment, as the README describes.
