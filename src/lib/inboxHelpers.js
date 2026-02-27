import prisma from "./prisma.js";

const KINDS = ["link", "note", "file", "audio", "video"];

const models = {
  link: prisma.link,
  note: prisma.note,
  file: prisma.file,
  audio: prisma.audio,
  video: prisma.video,
};

export function getModel(kind) {
  const model = models[kind];
  if (!model) return null;
  return model;
}

export function isValidKind(kind) {
  return KINDS.includes(kind);
}

/**
 * Find one record by kind and id. Returns null if not found.
 */
export async function findOne(kind, id) {
  const model = getModel(kind);
  if (!model) return null;
  return model.findUnique({ where: { id } });
}

/**
 * Update one record. data should only contain allowed fields per kind.
 */
export async function updateOne(kind, id, data) {
  const model = getModel(kind);
  if (!model) return null;
  return model.update({ where: { id }, data });
}

/**
 * Delete one record. Returns the deleted record or null.
 */
export async function deleteOne(kind, id) {
  const model = getModel(kind);
  if (!model) return null;
  return model.delete({ where: { id } });
}

/**
 * Build update payload from body, only including allowed fields per kind.
 */
export function buildUpdateData(kind, body) {
  const base = {};
  if (body.topic !== undefined) base.topic = body.topic === "" ? null : body.topic;
  if (body.inboxStatus !== undefined) base.inboxStatus = body.inboxStatus;

  switch (kind) {
    case "link":
      if (body.title !== undefined) base.title = body.title === "" ? null : body.title;
      if (body.url !== undefined) base.url = body.url;
      break;
    case "note":
      if (body.content !== undefined) base.content = body.content;
      if (body.type !== undefined) base.type = body.type;
      break;
    case "file":
    case "video":
      if (body.filename !== undefined) base.filename = body.filename;
      if (body.type !== undefined) base.type = body.type;
      break;
    case "audio":
      if (body.type !== undefined) base.type = body.type;
      if (body.transcription !== undefined) base.transcription = body.transcription;
      if (body.duration !== undefined) base.duration = body.duration == null ? null : parseInt(body.duration, 10);
      break;
    default:
      break;
  }

  return base;
}
