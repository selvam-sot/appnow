import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.util';
import { AppError } from '../utils/appError.util';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import User from '../models/user.model';
import Vendor from '../models/vendor.model';

/**
 * Chat controllers shared by customer and vendor routes.
 *
 * Party resolution:
 *   - Customer routes: identified via `x-clerk-id` header (same as address book).
 *   - Vendor routes: identified via `req.vendorId` set by the vendor auth middleware.
 *
 * MVP scope: pull-based (no WebSocket yet). Client polls the thread list
 * every 30s and the open thread every 5s. Real-time can come later.
 */

const resolveCustomerId = async (req: Request): Promise<mongoose.Types.ObjectId> => {
  const clerkId =
    (req.headers['x-clerk-id'] as string | undefined) ||
    (req.query.clerkId as string | undefined) ||
    (req.body && req.body.clerkId);
  if (!clerkId) throw new AppError('Missing clerkId', 401);
  const user = await User.findOne({ clerkId }).select('_id role');
  if (!user) throw new AppError('User not found', 404);
  return user._id as mongoose.Types.ObjectId;
};

// ============================================================================
// Customer endpoints
// ============================================================================

/** GET /customer/conversations */
export const listCustomerConversations = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = await resolveCustomerId(req);
    const threads = await Conversation.find({ customerId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('vendorId', 'vendorName image email phone')
      .lean();

    res.status(200).json({ success: true, data: threads });
  },
);

/**
 * POST /customer/conversations
 * Body: { vendorId }
 * Idempotent — returns existing thread if one already exists.
 */
export const startCustomerConversation = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = await resolveCustomerId(req);
    const { vendorId } = req.body;
    if (!vendorId) throw new AppError('vendorId is required', 400);

    const vendor = await Vendor.findById(vendorId).select('_id');
    if (!vendor) throw new AppError('Vendor not found', 404);

    const existing = await Conversation.findOne({ customerId, vendorId });
    if (existing) {
      return res.status(200).json({ success: true, data: existing });
    }

    const created = await Conversation.create({
      customerId,
      vendorId,
      customerUnreadCount: 0,
      vendorUnreadCount: 0,
    });
    res.status(201).json({ success: true, data: created });
  },
);

/** GET /customer/conversations/:id/messages?page=1&limit=30 */
export const listCustomerMessages = asyncHandler(async (req: Request, res: Response) => {
  const customerId = await resolveCustomerId(req);
  const { id } = req.params;
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '30', 10), 100);

  const conv = await Conversation.findById(id);
  if (!conv) throw new AppError('Conversation not found', 404);
  if (String(conv.customerId) !== String(customerId)) {
    throw new AppError('Not authorized', 403);
  }

  const [messages] = await Promise.all([
    Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    // Mark unread messages sent by the vendor as read
    Message.updateMany(
      { conversationId: id, senderRole: 'vendor', readAt: null },
      { $set: { readAt: new Date() } },
    ),
  ]);

  if (conv.customerUnreadCount > 0) {
    conv.customerUnreadCount = 0;
    await conv.save();
  }

  res.status(200).json({ success: true, data: messages.reverse() });
});

/** POST /customer/conversations/:id/messages */
export const sendCustomerMessage = asyncHandler(async (req: Request, res: Response) => {
  const customerId = await resolveCustomerId(req);
  const { id } = req.params;
  const { content, attachmentUrls } = req.body;
  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  const conv = await Conversation.findById(id);
  if (!conv) throw new AppError('Conversation not found', 404);
  if (String(conv.customerId) !== String(customerId)) {
    throw new AppError('Not authorized', 403);
  }

  const message = await Message.create({
    conversationId: id,
    senderId: customerId,
    senderRole: 'customer',
    content: content.trim(),
    attachmentUrls,
  });

  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = content.trim().slice(0, 200);
  conv.lastMessageSenderRole = 'customer';
  conv.vendorUnreadCount = (conv.vendorUnreadCount || 0) + 1;
  await conv.save();

  res.status(201).json({ success: true, data: message });
});

// ============================================================================
// Vendor endpoints
// ============================================================================

const getVendorFromReq = async (req: Request) => {
  const vendorId = (req as any).vendorId;
  if (!vendorId) throw new AppError('Vendor session required', 401);
  return new mongoose.Types.ObjectId(vendorId);
};

/** GET /vendor/conversations */
export const listVendorConversations = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = await getVendorFromReq(req);
  const threads = await Conversation.find({ vendorId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('customerId', 'name email firstName lastName profileImage')
    .lean();

  res.status(200).json({ success: true, data: threads });
});

/** GET /vendor/conversations/:id/messages */
export const listVendorMessages = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = await getVendorFromReq(req);
  const { id } = req.params;
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '30', 10), 100);

  const conv = await Conversation.findById(id);
  if (!conv) throw new AppError('Conversation not found', 404);
  if (String(conv.vendorId) !== String(vendorId)) {
    throw new AppError('Not authorized', 403);
  }

  const [messages] = await Promise.all([
    Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Message.updateMany(
      { conversationId: id, senderRole: 'customer', readAt: null },
      { $set: { readAt: new Date() } },
    ),
  ]);

  if (conv.vendorUnreadCount > 0) {
    conv.vendorUnreadCount = 0;
    await conv.save();
  }

  res.status(200).json({ success: true, data: messages.reverse() });
});

/** POST /vendor/conversations/:id/messages */
export const sendVendorMessage = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = await getVendorFromReq(req);
  const { id } = req.params;
  const { content, attachmentUrls } = req.body;
  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  const conv = await Conversation.findById(id);
  if (!conv) throw new AppError('Conversation not found', 404);
  if (String(conv.vendorId) !== String(vendorId)) {
    throw new AppError('Not authorized', 403);
  }

  const message = await Message.create({
    conversationId: id,
    senderId: vendorId,
    senderRole: 'vendor',
    content: content.trim(),
    attachmentUrls,
  });

  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = content.trim().slice(0, 200);
  conv.lastMessageSenderRole = 'vendor';
  conv.customerUnreadCount = (conv.customerUnreadCount || 0) + 1;
  await conv.save();

  res.status(201).json({ success: true, data: message });
});
