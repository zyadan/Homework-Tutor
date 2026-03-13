# license_gene_service

A standalone license code generation and activation service.

## Structure

- `app.js`: Express app entry
- `config.js`: environment variables and table config
- `routes/license.js`: HTTP routes
- `services/licenseService.js`: business logic
- `services/repository.js`: mock persistence and Tablestore access
- `utils/logger.js`: logger

## Run locally

```bash
cd /home/zyadan/Homework-Tutor/generatecode/license_gene_service
npm install
DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
