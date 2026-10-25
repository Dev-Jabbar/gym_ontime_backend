# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private reporting instead: the **Security** tab of this repository, **Report a vulnerability**.

Include what you found, how to reproduce it and the impact you expect. Please do not access other people's data, run load tests against the hosted demo or use real payment details.

This is a personal project, so there is no formal response-time guarantee.

## What is in place

- Passwords are hashed with bcrypt before they are stored.
- The login token is a JWT in an **HTTP-only cookie**, so browser scripts cannot read it. Routes are protected with the `protect(roles?)` middleware.
- Paystack webhooks are verified by signature over the raw request body, and every payment is re-verified with Paystack before a seat is confirmed.
- Request bodies are validated with Zod.
- Image uploads are signed server-side, so the Cloudinary secret never reaches the browser.
- Secrets come from environment variables only; `.env` is git-ignored.

## Known gaps

See [Known Limitations](./README.md#known-limitations) in the README. The notable ones: no rate limiting, no `helmet`, public member and trainer lists, and a seed script with a fixed admin password. The NestJS rebuild addresses the first three.

## For operators

- Generate a strong `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- If a secret is exposed (screenshot, paste, commit), treat it as compromised: rotate it at the provider and redeploy.
- Change the password of any account created by the seed script before exposing the API publicly.
