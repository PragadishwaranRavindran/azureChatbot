export interface DirectLineConfig {
  token: string;
}

export interface DirectLineConversation {
  conversationId: string;
  token: string;
  streamUrl: string;
  referenceGrammarId?: string;
  eTag?: string;
}

export interface DirectLineActivity {
  type: string;
  id?: string;
  timestamp?: string;
  localTimestamp?: string;
  serviceUrl?: string;
  channelId?: string;
  from: {
    id: string;
    name?: string;
  };
  conversation?: {
    id: string;
  };
  recipient?: {
    id: string;
    name?: string;
  };
  text?: string;
  speak?: string;
  inputHint?: string;
  summary?: string;
  suggestedActions?: any;
  attachments?: any[];
  entities?: any[];
  channelData?: any;
  action?: string;
  replyToId?: string;
  label?: string;
  valueType?: string;
  value?: any;
  name?: string;
  relatesTo?: any;
  code?: string;
  expiration?: string;
  importance?: string;
  deliveryMode?: string;
  listenFor?: string[];
  textHighlights?: any[];
  semanticAction?: any;
}

export interface DirectLineActivitiesResponse {
  activities: DirectLineActivity[];
  watermark: string;
}

export class DirectLineClient {
  private config: DirectLineConfig;
  private baseUrl = 'https://directline.botframework.com/v3/directline';

  constructor(config: DirectLineConfig) {
    this.config = config;
  }

  async startConversation(): Promise<DirectLineConversation> {
    const response = await fetch(`${this.baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Direct Line API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async sendActivity(conversationId: string, activity: Partial<DirectLineActivity>): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message',
        from: { id: 'user' },
        ...activity
      })
    });

    if (!response.ok) {
      throw new Error(`Direct Line API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getActivities(conversationId: string, watermark?: string): Promise<DirectLineActivitiesResponse> {
    const url = watermark 
      ? `${this.baseUrl}/conversations/${conversationId}/activities?watermark=${watermark}`
      : `${this.baseUrl}/conversations/${conversationId}/activities`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Direct Line API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}
