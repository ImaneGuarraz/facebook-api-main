import Event from '../models/event.js';
import Group from '../models/group.js';
import { objectIdPattern, rejectInvalidId } from './groupAccess.js';

function sameId(left, right) {
  return String(left?._id ?? left) === String(right?._id ?? right);
}

export async function eventAccess(event, userId) {
  const isCreator = sameId(event.createdBy, userId);
  const isOrganizer = event.isOrganizer(userId);
  const isParticipant = event.isParticipant(userId);

  let groupRole = null;

  if (event.group) {
    const group = await Group.findById(event.group).select('members');
    groupRole = group ? group.memberRole(userId) : null;
  }

  const isGroupAdmin = groupRole === 'admin' || groupRole === 'superadmin';
  const visible =
    event.visibility === 'public' || isCreator || isOrganizer || isParticipant || isGroupAdmin;

  return { isCreator, isOrganizer, isParticipant, isGroupAdmin, visible };
}

export function canAdminister(access) {
  return access.isCreator || access.isGroupAdmin;
}

export function canInvite(access) {
  return access.isCreator || access.isOrganizer || access.isGroupAdmin;
}

export async function loadEvent(req, res, { id = req.params.id, populate = true } = {}) {
  if (!objectIdPattern.test(id)) {
    rejectInvalidId(res, id === req.params.id ? 'id' : 'eventId');
    return null;
  }

  const query = Event.findById(id);
  const event = await (populate
    ? query.populate('createdBy organizers participants')
    : query);

  if (!event) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  const access = await eventAccess(event, req.user._id);

  if (!access.visible) {
    res.status(404).json({ message: 'Resource not found' });
    return null;
  }

  return { event, ...access };
}
