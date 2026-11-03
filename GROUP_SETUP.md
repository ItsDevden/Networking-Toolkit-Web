# Enable live classroom groups

The front-end Groups controls are present immediately. A shared website cannot synchronize between computers without a server. Set up a free Supabase project once:

1. Create a Supabase project at https://supabase.com/dashboard.
2. Run GROUP_SETUP.sql, then GROUP_ADMIN_SETUP.sql, in its SQL Editor.
3. Find your Project URL and publishable/anon API key under Project Settings > API.
4. Edit group-config.js, setting `url` and `anonKey`. Do not use the secret/service-role key.
5. Upload the website files to GitHub Pages. Open the same hosted URL on each classroom computer.

Codes are 12 characters, hidden until clicking the eye. Anyone with the code can access or change the group's shared configuration. The group list only shows the codes this browser has joined, and Supabase table reads are blocked unless a valid code is supplied via an RPC function.

Important limitations: Synchronization uses 1.8-second polling and optimistic revision checks, not conflict-free collaborative text editing. If two people make overlapping changes, the second update is stopped and users must reconnect; no silent overwrite occurs. This is a classroom prototype and is NOT ready for smooth concurrent Notes typing or 30 actively editing users. Live session status is shown by the green dot only while communicating with the backend. Browser closing remembers membership, and reconnect is manual. Leaving forgets membership locally; remote groups are not automatically deleted. Ordinary group members do not need accounts. Admin actions require a backend-verified account.

Solo files remain separate through an automatic local backup when joining and restoration on disconnect. Avoid simultaneous windows in the same browser profile, and back up important local projects through Templates before experimenting.

## Admin login on the existing website

For the DevDen admin account, sign in on the website using username `DevDen` (case-insensitive) and the password for the Supabase Authentication user `devden.it@gmail.com`. The username is mapped to that email by `admin.js`. The mapping is public client-side configuration, not a secret. Make sure the user has been created and confirmed in Supabase Authentication > Users. Copy the user UUID, then in SQL Editor run:

```sql
insert into public.devden_admins(user_id) values ('YOUR_ADMIN_USER_UUID');
```

On the website, click the big **DevDen** wordmark in the header to open **Admin Login**. After login, an **Admin Panel** button appears above Groups. Admin functions are checked by the database for the registered UUID. Do not publish an admin password or Supabase service-role/secret key in any website file. Only the anon/publishable key belongs in group-config.js.

The panel displays group activity (recent edits and member sync timestamps), permits permanent group deletion, and allows kicking member identities. Group members are identified by a locally stored UUID, not verified accounts: clearing browser storage or changing browsers can create a new identity, so kicking is not a permanent ban. **This is deliberate classroom-level control, not strong identity protection.**

Apply these SQL updates *before* deploying the updated group.js. Old clients using the previous unauthenticated RPC read/update functions will no longer work after this change. Existing saved group documents are not deleted. Current group members get registered when they next connect.

### Production admin login
The production website has no demo login. Set up your own backend-approved admin account before testing the panel.

## Before making the site public

- Configure `group-config.js` with your own Supabase **project URL** and **publishable/anon key**. An empty configuration can show the UI but **cannot create or join live groups**.
- Perform a two-browser test: create a group on browser A, join with the code on B, modify a Checklist entry, confirm it reaches A, then try Notes and topology.
- Test the admin account (real username/password, not demo), then delete a disposable test group and kick a test member.
- **Save to Solo** copies the current Group project into Templates. **Share Solo** imports a previously saved full Solo project into the Group after confirmation. Both keep independent copies.
- Group editing is revision-based polling, not a CRDT. Simultaneous writes to the same group can conflict. On conflict, this build saves an **Unsynced conflict copy** in Templates before asking you to reconnect. It does not intelligently merge overlapping edits.
- This is a lightweight classroom tool, not high-security identity management. Membership IDs are browser-held and join codes act as access credentials.
