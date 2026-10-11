# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private reporting flow instead: go to the **Security** tab of this
repository and choose **Report a vulnerability**. If that is unavailable, contact
the maintainer directly at **abdurrahmanucak00@gmail.com**.

Please include:

- a description of the issue and its impact,
- steps to reproduce it,
- the affected version (see `package.json`),
- any proof-of-concept you are comfortable sharing.

You can expect an acknowledgement within a few days. Please allow reasonable time
for a fix before public disclosure.

## Scope

This is a desktop application that stores third-party API credentials locally, so
the following are considered in scope:

- extraction or disclosure of stored API keys,
- bypasses of the encryption used for locally stored credentials,
- leakage of credentials through logs, error messages, or network requests,
- injection flaws in the renderer (for example through untrusted article content),
- insecure Supabase access — for example a policy that lets one user read another
  user's rows.

## Known limitations

These are documented rather than hidden, and are not considered vulnerabilities on
their own:

- **Shared default encryption secret.** If `ENCRYPTION_KEY` is not set, credentials
  are encrypted with a fixed, publicly known key. This protects against casual
  inspection of local storage only. It is not a substitute for the operating
  system keychain. Set `ENCRYPTION_KEY` to a long random value for any deployment
  beyond personal use.
- **No sign-in UI yet.** Supabase sync requires an authenticated user. The row-level
  security policies in `supabase-schema.sql` are the actual access control; the
  `anon` key is a public client credential by design and is not treated as a secret.
- **Legacy key migration.** Credentials written by older versions using AES-256-CBC
  are not guaranteed to decrypt after the move to AES-256-GCM. Affected users should
  re-enter their API keys.

## Handling of secrets

- API keys are stored with AES-256-GCM and are never written to logs.
- Keys are only ever sent to their own provider endpoints.
- `.env` is gitignored; only `.env.example` with placeholder values is committed.
- Never commit a Supabase `service_role` key. It bypasses row-level security entirely.
