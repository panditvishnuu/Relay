import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as users from '../controllers/user.controller.js';
import * as conversations from '../controllers/conversation.controller.js';
import * as groups from '../controllers/group.controller.js';
import { uploadFile } from '../controllers/upload.controller.js';
import { singleFile } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import * as profile from '../controllers/profile.controller.js';

export const apiRoutes = Router();

// everything below this line needs a valid access token
apiRoutes.use(requireAuth);

apiRoutes.patch('/users/me', validate(profile.updateProfileSchema), profile.updateMe);
apiRoutes.get('/users/me/blocked', profile.blocked);
apiRoutes.post('/users/:id/block', profile.block);
apiRoutes.delete('/users/:id/block', profile.unblock);

apiRoutes.get('/users', users.search);
apiRoutes.get('/users/:id', users.getOne);

apiRoutes.get('/conversations', conversations.list);
apiRoutes.post('/conversations/direct', validate(conversations.directSchema), conversations.createDirect);
apiRoutes.post('/conversations/group', validate(groups.createGroupSchema), groups.create);

apiRoutes.get('/conversations/:id', conversations.getOne);
apiRoutes.get('/conversations/:id/messages', conversations.getMessages);
apiRoutes.get('/conversations/:id/media', conversations.getMedia);

apiRoutes.post('/upload', uploadLimiter, singleFile('file'), uploadFile);

apiRoutes.patch('/conversations/:id', validate(groups.renameGroupSchema), groups.rename);
apiRoutes.post('/conversations/:id/members', validate(groups.addMembersSchema), groups.addPeople);
apiRoutes.delete('/conversations/:id/members/:userId', groups.removePerson);

apiRoutes.delete('/conversations/:id/messages', profile.clearChat);
apiRoutes.delete('/conversations/:id', profile.deleteChat);
