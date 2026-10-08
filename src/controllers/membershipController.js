import GroupInvitation from '../models/groupInvitation.js';
import JoinRequest from '../models/joinRequest.js';
import User from '../models/user.js';
import { loadGroup, objectIdPattern, rejectInvalidId } from './groupAccess.js';

function conflict(res, message) {
  res.status(409).json({ message });
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function isMemberConflict(error) {
  return error?.name === 'ValidationError' && Boolean(error.errors?.members);
}

function managesRequests(role) {
  return role === 'admin' || role === 'superadmin';
}

function superadminCount(group) {
  return group.members.filter((member) => member.role === 'superadmin').length;
}

function toJoinRequest(request, user) {
  return {
    id: request.id,
    group: String(request.group),
    user: user.toPublic(),
    createdAt: request.createdAt,
  };
}

async function addMember(group, userId) {
  group.members.push({ user: userId, role: 'member' });
  await group.save();
  await JoinRequest.deleteOne({ group: group._id, user: userId });
  await GroupInvitation.updateMany(
    { group: group._id, user: userId, status: 'pending' },
    { status: 'accepted' },
  );
  await group.populate('members.user');
}

export async function joinGroup(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    const { group } = loaded;

    if (group.memberRole(req.user._id)) {
      conflict(res, 'Already a member');
      return;
    }

    if (group.visibility === 'public') {
      await addMember(group, req.user._id);
      res.status(201).json(group.toProfile({ role: 'member', includeMembers: true }));
      return;
    }

    if (group.visibility === 'secret') {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    const pendingInvitation = await GroupInvitation.exists({
      group: group._id,
      user: req.user._id,
      status: 'pending',
    });

    if (pendingInvitation) {
      conflict(res, 'Invitation already pending');
      return;
    }

    const request = await JoinRequest.create({
      group: group._id,
      user: req.user._id,
    });

    res.status(201).json(toJoinRequest(request, req.user));
  } catch (error) {
    if (isMemberConflict(error)) {
      conflict(res, 'Already a member');
      return;
    }

    if (isDuplicateKey(error)) {
      conflict(res, 'Request already pending');
      return;
    }

    next(error);
  }
}

export async function listJoinRequests(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    if (!managesRequests(loaded.role)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const requests = await JoinRequest.find({ group: loaded.group._id })
      .sort({ createdAt: 1 })
      .populate('user');

    res.json(
      requests
        .filter((request) => request.user)
        .map((request) => toJoinRequest(request, request.user)),
    );
  } catch (error) {
    next(error);
  }
}

async function loadPendingRequest(req, res) {
  const loaded = await loadGroup(req, res, { populateMembers: false });

  if (!loaded) {
    return null;
  }

  if (!managesRequests(loaded.role)) {
    res.status(403).json({ message: 'Insufficient role' });
    return null;
  }

  if (!objectIdPattern.test(req.params.userId)) {
    rejectInvalidId(res, 'userId');
    return null;
  }

  const request = await JoinRequest.findOne({
    group: loaded.group._id,
    user: req.params.userId,
  }).populate('user');

  if (!request) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  return { group: loaded.group, role: loaded.role, request };
}

export async function acceptJoinRequest(req, res, next) {
  try {
    const loaded = await loadPendingRequest(req, res);

    if (!loaded) {
      return;
    }

    if (loaded.group.memberRole(loaded.request.user._id)) {
      await loaded.request.deleteOne();
      conflict(res, 'Already a member');
      return;
    }

    await addMember(loaded.group, loaded.request.user._id);
    res.json(loaded.group.toProfile({ role: loaded.role, includeMembers: true }));
  } catch (error) {
    if (isMemberConflict(error)) {
      conflict(res, 'Already a member');
      return;
    }

    next(error);
  }
}

export async function rejectJoinRequest(req, res, next) {
  try {
    const loaded = await loadPendingRequest(req, res);

    if (!loaded) {
      return;
    }

    await loaded.request.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function createInvitation(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    if (!managesRequests(loaded.role)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const { userId } = req.body;

    if (loaded.group.memberRole(userId)) {
      conflict(res, 'Already a member');
      return;
    }

    const pendingInvitation = await GroupInvitation.exists({
      group: loaded.group._id,
      user: userId,
      status: 'pending',
    });

    if (pendingInvitation) {
      conflict(res, 'Invitation already pending');
      return;
    }

    const pendingRequest = await JoinRequest.exists({
      group: loaded.group._id,
      user: userId,
    });

    if (pendingRequest) {
      conflict(res, 'Request already pending');
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    const invitation = await GroupInvitation.create({
      group: loaded.group._id,
      user: user._id,
      invitedBy: req.user._id,
    });

    res.status(201).json({
      id: invitation.id,
      group: loaded.group.id,
      user: user.toPublic(),
      invitedBy: req.user.toPublic(),
      status: invitation.status,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      conflict(res, 'Invitation already pending');
      return;
    }

    next(error);
  }
}

function findMember(group, userId) {
  return group.members.find((member) => member.user.equals(userId));
}

async function loadMember(req, res) {
  const loaded = await loadGroup(req, res, { populateMembers: false });

  if (!loaded) {
    return null;
  }

  if (loaded.role !== 'superadmin') {
    res.status(403).json({ message: 'Insufficient role' });
    return null;
  }

  if (!objectIdPattern.test(req.params.userId)) {
    rejectInvalidId(res, 'userId');
    return null;
  }

  const member = findMember(loaded.group, req.params.userId);

  if (!member) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  return { group: loaded.group, member };
}

export async function updateMember(req, res, next) {
  try {
    const loaded = await loadMember(req, res);

    if (!loaded) {
      return;
    }

    const demotesLastSuperadmin =
      loaded.member.role === 'superadmin' &&
      req.body.role !== 'superadmin' &&
      superadminCount(loaded.group) === 1;

    if (demotesLastSuperadmin) {
      conflict(res, 'A group must keep a superadmin');
      return;
    }

    loaded.member.role = req.body.role;
    await loaded.group.save();
    await loaded.group.populate('members.user');
    res.json(
      loaded.group.toProfile({
        role: loaded.group.memberRole(req.user._id),
        includeMembers: true,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    const loaded = await loadMember(req, res);

    if (!loaded) {
      return;
    }

    const removesLastSuperadmin =
      loaded.member.role === 'superadmin' && superadminCount(loaded.group) === 1;

    if (removesLastSuperadmin) {
      conflict(res, 'A group must keep a superadmin');
      return;
    }

    const userId = loaded.member.user;
    const index = loaded.group.members.indexOf(loaded.member);
    loaded.group.members.splice(index, 1);
    await loaded.group.save();
    await JoinRequest.deleteOne({ group: loaded.group._id, user: userId });
    await GroupInvitation.deleteMany({ group: loaded.group._id, user: userId, status: 'pending' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
