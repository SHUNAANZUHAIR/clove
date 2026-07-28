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
