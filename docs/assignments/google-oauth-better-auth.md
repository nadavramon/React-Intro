# Assignment write-up — Google OAuth via better-auth

Q&A answers for the Google OAuth / better-auth assignment (see the matching spec/plan in `../superpowers/`). Moved verbatim from the README on 2026-07-10.

### Walk through the OAuth flow: redirect → callback → token exchange

_Redirect:_ the SPA's "Sign in with Google" button sends the browser to Google's consent page with our `client_id`, requested scopes, `redirect_uri`, and a `state` value (CSRF protection, generated and remembered by better-auth). _Callback:_ after consent, Google sends the browser to `/api/auth/callback/google?code=…&state=…` — note the browser only ever carries a short-lived, one-time **code**, never tokens. _Token exchange:_ better-auth (server-side) POSTs `code + client_id + client_secret` directly to Google; Google returns ID/access tokens; better-auth verifies the ID token, find-or-creates the user, opens a session, and sets the cookie. The secret never touches the browser; tokens never ride in URLs.

### Where does the Client Secret live, and why not in code/git?

In `apps/server/.env` (gitignored — see `apps/server/.env.example`); prod gets it from deploy-time env injection. Git history is permanent and this repo's history is public — a secret committed once is compromised forever (we've lived this). Anything in the client bundle is public too, so it can never be a `VITE_*` var.

### What does better-auth replace?

Everything the old hand-rolled `modules/auth/` + refresh-token schema + half of the user service did: password hashing, token/session issuance _and storage_, expiry/rotation, the entire OAuth dance (state/CSRF, code exchange, ID-token verification, account linking), cookie handling, and the client SDK. We keep exactly one job: asking "who is this?" via `getSession` in one middleware. Fewer moving parts we can get subtly wrong (our old refresh flow had no rotation, and tokens sat in localStorage readable by any XSS).

### Identity vs authorization

Google only answers _"who is this?"_ — authentication (a verified email/name/avatar). What that person may _do here_ — which tasks they see, whether `role: 'admin'` means anything — is authorization, and it's 100% our app's decision; Google has no say. Concretely: Google identifies you, then _our_ DB row (`user.role`, task `userId` scoping) decides what you're allowed to touch. The `account` collection is the hinge where an external identity is bound to a local user with local permissions.
