import { createAgentActionsService } from "./action-service";
import { createAgentAttachmentsService } from "./attachment-service";
import {
	activeRunControllers,
	buildAttachmentModelParts,
	createAgentMessagesService,
	listThreadMessages,
} from "./message-service";
import { createAgentThreadsService, getAgentThread } from "./thread-service";

export { buildAttachmentModelParts };

export const agentService = {
	threads: createAgentThreadsService({ activeRunControllers, listThreadMessages }),
	messages: createAgentMessagesService(),
	attachments: createAgentAttachmentsService({ getThread: getAgentThread }),
	actions: createAgentActionsService(),
};
