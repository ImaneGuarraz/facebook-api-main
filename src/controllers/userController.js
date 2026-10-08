export function getMe(req, res) {
  res.json(req.user.toPublic());
}

export async function updateMe(req, res, next) {
  try {
    Object.assign(req.user, req.body);
    await req.user.save();
    res.json(req.user.toPublic());
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'Email already taken' });
      return;
    }

    next(error);
  }
}
