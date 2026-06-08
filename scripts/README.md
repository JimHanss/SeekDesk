# Scripts

Project-level automation scripts live here. The current real-agent helpers cover
secret hygiene, Google OAuth readiness, remote env sync, browser OAuth
preparation, and remote DeepSeek/Postgres verification.

Useful commands:

- `npm run verify:secrets`
- `npm run verify:real-agent-env`
- `npm run configure:google-oauth`
- `npm run sync:remote-google-oauth -- --host jim-mac`
- `npm run prepare:remote-google-oauth`
- `npm run verify:remote-real-agent`

The Google OAuth helpers write only to ignored env files and avoid printing
secret values. `prepare:remote-google-oauth` also attempts to clean up the
temporary remote API process if OAuth readiness fails before the ready state.

To check whether a local or SSH remote checkout has the required real-agent env
variables without revealing values, and to print the Google OAuth redirect URI
and required scopes:

```bash
npm run verify:real-agent-env
npm run verify:real-agent-env -- --host jim-mac
```
