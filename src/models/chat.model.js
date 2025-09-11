import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        messageContent: {
            type: String,
            required: true,
            trim: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        readAt: {
            type: Date 
        },
        senderRole: {
            type: String,
            enum: ['Admin', 'User'], 
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);