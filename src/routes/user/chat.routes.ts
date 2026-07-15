import express from 'express';
import {
  listCustomerConversations,
  startCustomerConversation,
  listCustomerMessages,
  sendCustomerMessage,
} from '../../controllers/chat.controller';

const router = express.Router();

// Customer identified via `x-clerk-id` header (same pattern as wallet + addresses)
router.get('/conversations', listCustomerConversations);
router.post('/conversations', startCustomerConversation);
router.get('/conversations/:id/messages', listCustomerMessages);
router.post('/conversations/:id/messages', sendCustomerMessage);

export default router;
