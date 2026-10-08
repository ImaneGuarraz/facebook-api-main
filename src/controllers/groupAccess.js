import Group from '../models/group.js';

export const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export function rejectInvalidId(res, path = 'id') {
  res.status(400).json({
    message: 'Validation failed',
    details: [{ path, message: 'Invalid id' }],
  });
}

export function contentVisible(group, role) {
  return group.visibility === 'public' || role !== null;
}

export async function loadGroup(req, res, { populateMembers }) {
  if (!objectIdPattern.test(req.params.id)) {
    rejectInvalidId(res);
    return null;
  }

  const query = Group.findById(req.params.id);
  const group = await (populateMembers ? query.populate('members.user') : query);

  if (!group) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  const role = group.memberRole(req.user._id);

  if (group.visibility === 'secret' && role === null) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  return { group, role };
}
