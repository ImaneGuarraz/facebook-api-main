import Event from '../models/event.js';
import EventInvitation from '../models/eventInvitation.js';
import Group from '../models/group.js';
import { deletePollsForEvents } from './pollController.js';
import { contentVisible, loadGroup } from './groupAccess.js';

export async function createGroup(req, res, next) {
  try {
    const group = await Group.create({
      ...req.body,
      members: [{ user: req.user._id, role: 'superadmin' }],
    });

    await group.populate('members.user');
    res.status(201).json(group.toProfile({ role: 'superadmin', includeMembers: true }));
  } catch (error) {
    next(error);
  }
}

export async function listGroups(req, res, next) {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [
        { visibility: 'public' },
        { visibility: 'private' },
        { visibility: 'secret', 'members.user': userId },
      ],
    }).sort({ createdAt: -1 });

    res.json(groups.map((group) => group.toProfile({ role: group.memberRole(userId) })));
  } catch (error) {
    next(error);
  }
}

export async function getGroup(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: true });

    if (!loaded) {
      return;
    }

    const { group, role } = loaded;
    res.json(group.toProfile({ role, includeMembers: contentVisible(group, role) }));
  } catch (error) {
    next(error);
  }
}

export async function updateGroup(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: true });

    if (!loaded) {
      return;
    }

    if (loaded.role !== 'superadmin') {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    Object.assign(loaded.group, req.body);
    await loaded.group.save();
    res.json(loaded.group.toProfile({ role: 'superadmin', includeMembers: true }));
  } catch (error) {
    next(error);
  }
}

export async function deleteGroup(req, res, next) {
  try {
    const loaded = await loadGroup(req, res, { populateMembers: false });

    if (!loaded) {
      return;
    }

    if (loaded.role !== 'superadmin') {
      res.status(403).json({ message: 'Insufficient role' });
      return;
    }

    const events = await Event.find({ group: loaded.group._id }).select('_id');
    const eventIds = events.map((event) => event._id);

    if (eventIds.length > 0) {
      await EventInvitation.deleteMany({
        $or: eventIds.map((eventId) => ({ event: eventId })),
      });
      await deletePollsForEvents(eventIds);
    }
    await Event.deleteMany({ group: loaded.group._id });
    await loaded.group.deleteOne();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
