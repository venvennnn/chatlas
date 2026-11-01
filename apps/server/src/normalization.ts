import { z } from "zod";
const id = z.string().min(1).max(200);
const metadata = z.object({
  message_id: id,
  message_timestamp: z
    .string()
    .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp"),
});
const chat = z.object({
  message_id: id,
  broadcaster_user_id: id,
  chatter_user_id: id,
  chatter_user_name: z.string().max(100),
  source_broadcaster_user_id: z.string().nullable().optional(),
  message: z.object({
    text: z.string().max(2000),
    fragments: z
      .array(
        z
          .object({
            type: z.string(),
            emote: z.object({ id }).nullable().optional(),
          })
          .passthrough(),
      )
      .default([]),
  }),
});
const eventSchemas = {
  "channel.chat.message": chat,
  "channel.chat.message_delete": z.object({ message_id: id }),
  "channel.chat.clear_user_messages": z.object({ target_user_id: id }),
  "channel.chat.clear": z.object({ broadcaster_user_id: id }).partial(),
};
export function validateNotification(input: unknown) {
  const envelope = z
    .object({
      metadata,
      payload: z.object({
        subscription: z.object({
          type: z.enum([
            "channel.chat.message",
            "channel.chat.message_delete",
            "channel.chat.clear_user_messages",
            "channel.chat.clear",
          ]),
        }),
        event: z.unknown(),
      }),
    })
    .safeParse(input);
  if (!envelope.success) return null;
  const type = envelope.data.payload.subscription.type;
  const event = eventSchemas[type].safeParse(envelope.data.payload.event);
  if (!event.success) return null;
  return {
    ...envelope.data,
    payload: { ...envelope.data.payload, event: event.data },
  };
}
