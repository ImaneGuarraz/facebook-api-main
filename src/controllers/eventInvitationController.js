import Event from '../models/event.js';
import EventInvitation from '../models/eventInvitation.js';
import { objectIdPattern, rejectInvalidId } from './groupAccess.js';

export async function acceptEventInvitation(req, res, next) {
  try {
    if (!objectIdPattern.test(req.params.id)) {
      rejectInvalidId(res);
      return;
    }

    const invitation = await EventInvitation.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
    });

    if (!invitation) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    const event = await Event.findById(invitation.event);

    if (!event) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    if (!event.isParticipant(req.user._id)) {
      event.participants.push(req.user._id);
      await event.save();
    }

    invitation.status = 'accepted';
    await invitation.save();
    await event.populate('createdBy organizers participants');
    res.json(event.toProfile());
  } catch (error) {
    next(error);
  }
}

export async function declineEventInvitation(req, res, next) {
  try {
    if (!objectIdPattern.test(req.params.id)) {
      rejectInvalidId(res);
      return;
    }

    const invitation = await EventInvitation.findOne({
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
