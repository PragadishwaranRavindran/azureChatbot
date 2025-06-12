import WebSocket from 'ws';

export interface AzureOpenAIRealtimeConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  voiceChoice: string;
  searchEndpoint: string;
  searchIndex: string;
  searchApiKey: string;
  searchSemanticConfiguration: string;
  searchIdentifierField: string;
  searchTitleField: string;
  searchContentField: string;
  searchEmbeddingField: string;
  searchUseVectorQuery: boolean;
  tenantId: string;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class AzureOpenAIRealtimeClient {
  private config: AzureOpenAIRealtimeConfig;
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: AzureOpenAIRealtimeConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://${this.config.endpoint.replace('https://', '')}/openai/realtime?api-version=2024-10-01-preview&deployment=${this.config.deployment}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'api-key': this.config.apiKey,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('Azure OpenAI Realtime WebSocket connected');
        this.sendSessionUpdate();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Azure OpenAI Realtime WebSocket closed');
        this.ws = null;
      });
    });
  }

  private sendSessionUpdate() {
    if (!this.ws) return;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful AI assistant. Use the provided Azure Search knowledge base to answer questions accurately.',
        voice: this.config.voiceChoice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [
          {
            type: 'function',
            name: 'search_knowledge_base',
            description: 'Search the Azure AI Search knowledge base for relevant information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant information'
                }
              },
              required: ['query']
            }
          }
        ],
        tool_choice: 'auto'
      }
    };

    this.ws.send(JSON.stringify(sessionUpdate));
  }

  sendEvent(event: RealtimeEvent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify(event));
  }

  on(eventType: string, handler: Function) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  private handleEvent(event: RealtimeEvent) {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }

    // Handle tool calls for Azure Search
    if (event.type === 'response.function_call_arguments.done') {
      this.handleFunctionCall(event);
    }
  }

  private async handleFunctionCall(event: any) {
    if (event.name === 'search_knowledge_base') {
      try {
        const args = JSON.parse(event.arguments);
        const searchResults = await this.searchKnowledgeBase(args.query);
        
        this.sendEvent({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: event.call_id,
            output: JSON.stringify(searchResults)
          }
        });
      } catch (error) {
        console.error('Error handling function call:', error);
        this.sendEvent({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: event.call_id,
            output: JSON.stringify({ error: 'Failed to search knowledge base' })
          }
        });
      }
    }
  }

  private async searchKnowledgeBase(query: string) {
    const searchUrl = `${this.config.searchEndpoint}/indexes/${this.config.searchIndex}/docs/search?api-version=2023-11-01`;
    
    const searchBody = {
      search: query,
      select: `${this.config.searchTitleField},${this.config.searchContentField},${this.config.searchIdentifierField}`,
      top: 5,
      searchMode: 'any',
      queryType: 'semantic',
      semanticConfiguration: this.config.searchSemanticConfiguration,
      ...(this.config.searchUseVectorQuery && {
        vectorQueries: [
          {
            kind: 'text',
            text: query,
            fields: this.config.searchEmbeddingField,
            k: 5
          }
        ]
      })
    };

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.searchApiKey
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      throw new Error(`Azure Search error: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();
    return results.value.map((doc: any) => ({
      title: doc[this.config.searchTitleField],
      content: doc[this.config.searchContentField],
      id: doc[this.config.searchIdentifierField]
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
