const { Storage } = require('@google-cloud/storage');

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyFile) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json');
  process.exit(1);
}

const storage = new Storage({ keyFilename: keyFile });

async function main() {
  try {
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    console.log(`${bucketName} exists:`, exists);
    if (exists) {
      const [meta] = await bucket.getMetadata();
      console.log('Bucket metadata: location=%s, storageClass=%s, timeCreated=%s',
        meta.location, meta.storageClass, meta.timeCreated);
      const [files] = await bucket.getFiles({ maxResults: 10 });
      console.log('Sample files (up to 10):', files.map(f => f.name));
    } else {
      console.log('Listing buckets visible to these credentials (first 50):');
      const [buckets] = await storage.getBuckets();
      console.log(buckets.map(b => b.name).slice(0, 50));
    }
  } catch (err) {
    console.error('Error checking bucket:', err.message || err);
    process.exit(1);
  }
}

main();