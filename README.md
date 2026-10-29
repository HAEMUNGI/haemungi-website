# HAEMUNGI — 헤뭉이의 작은 세계

Official public-facing website for the HAEMUNGI character by 일현 조성훈.

Website: https://haemungi.pages.dev/

## Hosting and independence

- Production hosting: the owner's **Cloudflare Pages** project `haemungi`.
- Source control: a dedicated, public HAEMUNGI GitHub repository.
- No OpenAI/ChatGPT hosting or paid AI API is required for the published site.
- Static site files are in [`dist/`](dist/); `index.html` is the entrypoint.
- The site supports Korean, English, Japanese, and Simplified Chinese without third-party translation calls.
- Goods are **concept previews only**, not available for sale.

## Verification

Run the local quality checks before publishing:

```sh
node verify-haemungi.mjs
node verify-i18n.mjs
node verify-analytics.mjs
```

These checks inspect the static source and database migration definitions. They do not prove that a Supabase migration has been applied, that live database writes work, or that mobile interactions are free of issues.

## Automated deployment

The GitHub Actions workflow `.github/workflows/cloudflare-pages.yml` publishes **this existing Pages project** with `wrangler`, preserving the `haemungi.pages.dev` address.

The repository owner must add two GitHub Actions repository secrets:

- `CLOUDFLARE_ACCOUNT_ID` — the owner Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN` — a scoped token granting Cloudflare Pages edit access to the relevant account.

Do not commit these credentials to source control, including files under `dist/`. Use a scoped, revocable token and GitHub Secrets only.

After secrets are configured, pushes to `main` and manual workflow dispatches deploy `dist/` to `haemungi`.

## Ownership

Original character, illustrations, and website content © 2026 HAEMUNGI · 일현 조성훈. Public source availability does not grant permission to reuse or redistribute character artwork or other copyrighted content. No open-source license is implied.
