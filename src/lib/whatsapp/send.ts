const GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface TextMessage {
  type: 'text';
  to: string;
  text: string;
}

interface TemplateMessage {
  type: 'template';
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

type WaMessage = TextMessage | TemplateMessage;

async function sendMessage(message: WaMessage): Promise<{ messageId: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;

  let body: Record<string, unknown>;

  if (message.type === 'text') {
    body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'text',
      text: { body: message.text },
    };
  } else {
    body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.languageCode ?? 'en' },
        components: message.components ?? [],
      },
    };
  }

  const response = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { messages?: [{ id: string }]; error?: unknown };
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(data.error)}`);
  }

  return { messageId: data.messages?.[0]?.id ?? '' };
}

export const whatsapp = { send: sendMessage };
