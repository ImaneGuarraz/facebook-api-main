import Event from '../models/event.js';
import EventInvitation from '../models/eventInvitation.js';
import PollAnswer from '../models/pollAnswer.js';
import Group from '../models/group.js';
import User from '../models/user.js';
import { loadGroup, objectIdPattern, rejectInvalidId } from './groupAccess.js';
import { canAdminister, canInvite, loadEvent } from './eventAccess.js';
import { deletePollsForEvents } from './pollController.js';

function conflict(res, message) {
  res.status(409).json({ message });
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function rejectDateOrder(res) {
  res.status(400).json({
    message: 'Validation failed',
    details: [{ path: 'endDate', message: 'startDate must be before endDate' }],
  });
}

function rejectPublicInSecretGroup(res) {
  res.status(400).json({
    message: 'Validation failed',
    details: [{ path: 'visibility', message: 'A secret group cannot have a public event' }],
  });
}

function datesFit(event, body) {
  const start = body.startDate ? new Date(body.startDate) : event.startDate;
  const end = body.endDate ? new Date(body.endDate) : event.endDate;
  return start < end;
}

async function present(event) {
  await event.populate('createdBy organizers participants');
  return event.toProfile();
}

function toInvitation(invitation, user, invitedBy) {
  return {
    id: invitation.id,
    event: String(invitation.event),
    user: user.toPublic(),
    invitedBy: invitedBy.toPublic(),
    status: invitation.status,
  };
}

async function assertPublicAllowed(group, visibility, res) {
  if (group.visibility === 'secret' && visibility === 'public') {
    rejectPublicInSecretGroup(res);
    return false;
  }

  return true;
}

export async function createEvent(req, res, next) {
  try {
    const event = await Event.create({
      ...req.body,
      createdBy: req.user._id,
      organizers: [req.user._id],
      participants: [req.user._id],
    });

    res.status(201).json(await present(event));
  } catch (error) {
    next(error);
  }
}

export async function createGroupEvent(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    const allowed =
      loaded.role === 'admin' ||
      loaded.role === 'superadmin' ||
      (loaded.role === 'member' && loaded.group.membersCanCreateEvents);

    if (!allowed) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    if (!(await assertPublicAllowed(loaded.group, req.body.visibility, res))) {
      return;
    }

    const event = await Event.create({
      ...req.body,
      group: loaded.group._id,
      createdBy: req.user._id,
      organizers: [req.user._id],
      participants: [req.user._id],
    });

    res.status(201).json(await present(event));
  } catch (error) {
    next(error);
  }
}

export async function listEvents(req, res, next) {
  try {
    const userId = req.user._id;
    const memberships = await Group.find({ 'members.user': userId }).select('members');
    const adminGroupIds = memberships
      .filter((group) => {
        const role = group.memberRole(userId);
        return role === 'admin' || role === 'superadmin';
      })
      .map((group) => group._id);
    const visible = [
      { visibility: 'public' },
      { organizers: userId },
      { participants: userId },
      { createdBy: userId },
      ...adminGroupIds.map((groupId) => ({ group: groupId })),
    ];

    const events = await Event.find({ $or: visible })
      .sort({ startDate: 1 })
      .populate('createdBy organizers participants');

    res.json(events.map((event) => event.toProfile()));
  } catch (error) {
    next(error);
  }
}

export async function getEvent(req, res, next) {
  try {
    const loaded = await loadEvent(req, res);

    if (!loaded) {
      return;
    }

    res.json(loaded.event.toProfile());
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const loaded = await loadEvent(req, res);

    if (!loaded) {
      return;
    }

    if (!canAdminister(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    if (!datesFit(loaded.event, req.body)) {
      rejectDateOrder(res);
      return;
    }

    if (req.body.visibility === 'public' && loaded.event.group) {
      const group = await Group.findById(loaded.event.group).select('visibility');

      if (group && !(await assertPublicAllowed(group, req.body.visibility, res))) {
        return;
      }
    }

    Object.assign(loaded.event, req.body);
    await loaded.event.save();
    res.json(await present(loaded.event));
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!canAdminister(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    await EventInvitation.deleteMany({ event: loaded.event._id });
    await deletePollsForEvents([loaded.event._id]);
    await loaded.event.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function addOrganizer(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!canAdminister(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const user = await User.findById(req.body.userId);

    if (!user) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (loaded.event.isOrganizer(user._id)) {
      conflict(res, 'Already an organizer');
      return;
    }

    loaded.event.organizers.push(user._id);
    await loaded.event.save();
    res.status(201).json(await present(loaded.event));
  } catch (error) {
    next(error);
  }
}

export async function removeOrganizer(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!canAdminister(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    if (!objectIdPattern.test(req.params.userId)) {
      rejectInvalidId(res, 'userId');
      return;
    }

    if (!loaded.event.isOrganizer(req.params.userId)) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (loaded.event.organizers.length === 1) {
      conflict(res, 'An event must keep an organizer');
      return;
    }

    loaded.event.organizers.pull(req.params.userId);
    await loaded.event.save();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function joinEvent(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (loaded.event.isParticipant(req.user._id)) {
      conflict(res, 'Already a participant');
      return;
    }

    if (loaded.event.visibility !== 'public') {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    loaded.event.participants.push(req.user._id);
    await loaded.event.save();
    await EventInvitation.updateMany(
      { event: loaded.event._id, user: req.user._id, status: 'pending' },
      { status: 'accepted' },
    );
    res.status(201).json(await present(loaded.event));
  } catch (error) {
    next(error);
  }
}

export async function removeParticipant(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!objectIdPattern.test(req.params.userId)) {
      rejectInvalidId(res, 'userId');
      return;
    }

    const removesSelf = String(req.user._id) === req.params.userId;

    if (!removesSelf && !canInvite(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    if (!loaded.event.isParticipant(req.params.userId)) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    loaded.event.participants.pull(req.params.userId);
    await loaded.event.save();
    await PollAnswer.deleteMany({ event: loaded.event._id, user: req.params.userId });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function createEventInvitation(req, res, next) {
  try {
    const loaded = await loadEvent(req, res, { populate: false });

    if (!loaded) {
      return;
    }

    if (!canInvite(loaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const user = await User.findById(req.body.userId);

    if (!user) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (loaded.event.isParticipant(user._id)) {
      conflict(res, 'Already a participant');
      return;
    }

    const pending = await EventInvitation.exists({
      event: loaded.event._id,
      user: user._id,
      status: 'pending',
    });

    if (pending) {
      conflict(res, 'Invitation already pending');
      return;
    }

    const invitation = await EventInvitation.create({
      event: loaded.event._id,
      user: user._id,
      invitedBy: req.user._id,
    });

    res.status(201).json(toInvitation(invitation, user, req.user));
  } catch (error) {
    if (isDuplicateKey(error)) {
      conflict(res, 'Invitation already pending');
      return;
    }

    next(error);
  }
}

export async function inviteGroupMembers(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    const eventLoaded = await loadEvent(req, res, { id: req.params.eventId, populate: false });

    if (!eventLoaded) {
      return;
    }

    const belongsToGroup = eventLoaded.event.group?.equals(loaded.group._id);

    if (!belongsToGroup) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (!canInvite(eventLoaded)) {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const memberIds = loaded.group.members.map((member) => member.user);
    const pending = await EventInvitation.find({
      event: eventLoaded.event._id,
      status: 'pending',
    }).select('user');
    const pendingIds = new Set(pending.map((invitation) => String(invitation.user)));
    const targets = memberIds.filter(
      (userId) => !eventLoaded.event.isParticipant(userId) && !pendingIds.has(String(userId)),
    );
    const invitations = [];

    for (const userId of targets) {
      try {
        invitations.push(
          await EventInvitation.create({
            event: eventLoaded.event._id,
            user: userId,
            invitedBy: req.user._id,
          }),
        );
      } catch (error) {
        if (!isDuplicateKey(error)) {
          throw error;
        }
      }
    }

    const users = await Promise.all(
      invitations.map((invitation) => User.findById(invitation.user)),
    );
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    res.status(201).json(
      invitations.map((invitation) =>
        toInvitation(invitation, usersById.get(String(invitation.user)), req.user),
      ),
    );
  } catch (error) {
    next(error);
  }
}
