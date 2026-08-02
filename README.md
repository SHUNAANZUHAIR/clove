# cloveHR


A compact HR/payroll tracker for construction teams, built with Next.js API routes and PostgreSQL.


## Local Setup


1. Install dependencies:


   ```sh
   npm install
   ```


2. Create a PostgreSQL database and run:


   ```sh
   psql -f database.sql
   ```


3. Copy `.env.example` to `.env.local` and update `DATABASE_URL`.
   Use `DATABASE_URL_UNPOOLED` locally when your database provider gives you both pooled and direct URLs.


4. Start the app:


   ```sh
   npm run dev
   ```


## Deployment


Set `DATABASE_URL` in Vercel project environment variables before using the API-backed employee, salary, and site features in production. For concurrent users, use your provider's pooled connection URL for `DATABASE_URL` and keep `PG_POOL_MAX` small, for example `5`, so multiple Vercel runtime instances do not exhaust the database connection limit.

## ChatGPT and workflow access

The app exposes a read-only, site-scoped API intended for ChatGPT Actions and
automation tools. Set `CLOVEHR_WORKFLOW_API_KEY` to a long random value in
Vercel. Set `CLOVEHR_WORKFLOW_SITE_ID` to `-1` for all sites or to one positive
site id to restrict access.

After deployment, import this URL as the Action's OpenAPI schema:

`https://<your-clovehr-domain>/api/clovehr/openapi`

Choose API-key authentication, Bearer type, and enter the same
`CLOVEHR_WORKFLOW_API_KEY`. The integration intentionally excludes salaries,
photos, birth dates, addresses, and other sensitive employment-agreement data.
