import mongoose from 'mongoose';

mongoose.set('sanitizeFilter', true);

function connectDb(uri) {
  return mongoose.connect(uri);
}

export default connectDb;
