import { buildApp } from './app.js';
import { config } from './config/env.js';

async function start() {
  const app = await buildApp();
  const port = process.env.PORT || config.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0'; // 0.0.0.0 is required for cloud hosting

  try {
    await app.listen({ port: Number(port), host });
    console.log(`Server running at http://${host}:${port}`);
    console.log(`Database: ${config.USE_DYNAMODB ? 'AWS DynamoDB' : 'In-Memory'}`);
    console.log(`Media Storage: ${config.USE_R2 ? 'Cloudflare R2' : 'Local Disk'}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
