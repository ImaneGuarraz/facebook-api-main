import jwt from 'jsonwebtoken';

import User from '../models/user.js';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid token' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      res.status(401).json({ message: 'Missing or invalid token' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Missing or invalid token' });
      return;
    }

    next(error);
  }
}
