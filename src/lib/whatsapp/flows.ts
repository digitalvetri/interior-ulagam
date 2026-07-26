const GRAPH_URL = 'https://graph.facebook.com/v21.0';

export interface FlowMessage {
  to: string;
  flowId: string;
  flowToken: string;
  screenId: string;
  flowCta: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  flowData?: Record<string, unknown>;
}

interface MetaMessagesResponse {
  messages?: [{ id: string }];
  error?: unknown;
}

/**
 * Send a WhatsApp Interactive Flow message via Meta Graph API.
 * Returns the Meta message ID string.
 */
export async function sendWhatsAppFlow(msg: FlowMessage): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp env vars WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN not set');
  }

  const interactive: Record<string, unknown> = {
    type: 'flow',
    body: { text: msg.bodyText },
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_token: msg.flowToken,
        flow_id: msg.flowId,
        flow_cta: msg.flowCta,
        mode: process.env.NODE_ENV === 'production' ? 'published' : 'draft',
        flow_action: 'navigate',
        flow_action_payload: {
          screen: msg.screenId,
          data: msg.flowData ?? {},
        },
      },
    },
  };

  if (msg.headerText) {
    interactive.header = { type: 'text', text: msg.headerText };
  }

  if (msg.footerText) {
    interactive.footer = { text: msg.footerText };
  }

  const body = {
    messaging_product: 'whatsapp',
    to: msg.to,
    type: 'interactive',
    interactive,
  };

  const response = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as MetaMessagesResponse;

  if (!response.ok) {
    throw new Error(`WhatsApp Flow API error: ${JSON.stringify(data.error)}`);
  }

  return data.messages?.[0]?.id ?? '';
}
