const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function main() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS=receiptify-44d6c-ee21dfaf7342.json');
    process.exit(1);
  }

  const storage = new Storage({ keyFilename: keyFile });
  const bucket = storage.bucket(bucketName);

  const corsPath = path.join(process.cwd(), 'cors.json');
  if (!fs.existsSync(corsPath)) {
    console.error('cors.json not found at repo root:', corsPath);
    process.exit(1);
  }

  const corsConfig = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
  await bucket.setCorsConfiguration(corsConfig);
  console.log('CORS applied to', bucketName);

  const [metadata] = await bucket.getMetadata();
  console.log('Current CORS:', metadata.cors);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});