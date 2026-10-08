import Group from '../models/group.js';
import GroupInvitation from '../models/groupInvitation.js';
import JoinRequest from '../models/joinRequest.js';
import { objectIdPattern, rejectInvalidId } from './groupAccess.js';

function isMemberConflict(error) {
  return error?.name === 'ValidationError' && Boolean(error.errors?.members);
}

export async function acceptGroupInvitation(req, res, next) {
  try {
    if (!objectIdPattern.test(req.params.id)) {
      rejectInvalidId(res);
      return;
    }

    const invitation = await GroupInvitation.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
    });

    if (!invitation) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    const group = await Group.findById(invitation.group);

    if (!group) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (!group.memberRole(req.user._id)) {
      group.members.push({ user: req.user._id, role: 'member' });
      await group.save();
    }

    invitation.status = 'accepted';
    await invitation.save();
    await JoinRequest.deleteOne({ group: group._id, user: req.user._id });
    await group.populate('members.user');
    res.json(group.toProfile({ role: group.memberRole(req.user._id), includeMembers: true }));
  } catch (error) {
    if (isMemberConflict(error)) {
      res.status(409).json({ message: 'Already a member' });
      return;
    }

    next(error);
  }
}

export async function declineGroupInvitation(req, res, next) {
  try {
    if (!objectIdPattern.test(req.params.id)) {
      rejectInvalidId(res);
      return;
    }

    const invitation = await GroupInvitation.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
    });

    if (!invitation) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    invitation.status = 'declined';
    await invitation.save();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
