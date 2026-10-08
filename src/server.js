import 'dotenv/config';

import app from './app.js';
import connectDb from './config/db.js';

const port = Number(process.env.PORT) || 3000;
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is missing');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing');
  process.exit(1);
}

connectDb(uri)
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed');
    console.error(error);
    process.exit(1);
  });
