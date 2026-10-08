import bcrypt from 'bcrypt';

import User from '../models/user.js';
import { signToken } from '../middlewares/authenticate.js';

export async function register(req, res, next) {
  try {
    const user = await User.create(req.body);

    res.status(201).json({
      token: signToken(user.id),
      user: user.toPublic(),
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'Email already taken' });
      return;
    }

    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    const passwordMatches = user && (await bcrypt.compare(req.body.password, user.password));

    if (!passwordMatches) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    res.json({
      token: signToken(user.id),
      user: user.toPublic(),
    });
  } catch (error) {
    next(error);
  }
}
