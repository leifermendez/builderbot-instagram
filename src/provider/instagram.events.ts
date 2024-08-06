import { EventEmitterClass, utils } from "@builderbot/bot";
import { ProviderEventTypes } from "@builderbot/bot/dist/types";

export type InstagramMessage = {
    object: string;
    entry: Array<{
        time: number;
        id: string;
        messaging: Array<{
            sender: { id: string };
            recipient: { id: string };
            timestamp: number;
            message: {
                is_echo?: boolean;
                mid?: string;
                text?: string;
                attachments?: Array<{
                    type: string;
                    payload: {
                        url: string;
                    };
                }>;
            };
        }>;
    }>;
}

export class InstagramEvents extends EventEmitterClass<ProviderEventTypes> {
    /**
     * Function that handles incoming Instagram message events.
     * @param payload - The incoming Instagram message payload.
     */
    public eventInMsg = (payload: InstagramMessage) => {
        if (payload.object !== 'instagram' || !payload.entry || payload.entry.length === 0) return;

        const entry = payload.entry[0];
        const messaging = entry.messaging[0];

        if (!messaging || messaging.message?.is_echo) return;

        const sendObj = {
            body: messaging.message?.text || '',
            from: messaging.sender.id,
            name: '', // Instagram doesn't provide a name in this payload
            host: {
                id: messaging.recipient.id,
                phone: 'instagram' // Add this line
            },
            timestamp: messaging.timestamp,
            messageId: messaging.message?.mid || ''
        };

        if (messaging.message?.attachments && messaging.message.attachments.length > 0) {
            const attachment = messaging.message.attachments[0];
            switch (attachment.type) {
                case 'image':
                    sendObj.body = utils.generateRefProvider('_event_media_');
                    break;
                case 'video':
                    sendObj.body = utils.generateRefProvider('_event_media_');
                    break;
                case 'audio':
                    sendObj.body = utils.generateRefProvider('_event_voice_note_');
                    break;
                case 'file':
                    sendObj.body = utils.generateRefProvider('_event_document_');
                    break;
                // Instagram doesn't seem to have a specific 'location' type in this payload,
                // but if it did, we could handle it like this:
                // case 'location':
                //     sendObj.body = utils.generateRefProvider('_event_location_');
                //     break;
            }
        }

        this.emit('message', sendObj);
    }
}