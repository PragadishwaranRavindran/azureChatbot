import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { DirectLineClient } from "./direct-line";
import { AzureOpenAIRealtimeClient } from "./azure-openai-realtime";
import { insertMessageSchema, insertConversationSchema } from "@shared/schema";

const DIRECT_LINE_TOKEN = process.env.DIRECT_LINE_TOKEN || 'DPbGFgq3LQMaox32EzuWwphjsAvVMq74WRWifivBTcw1dxZSHluCJQQJ99BFACL93NaAArohAAABAZBS4bb3.1KZ6TNVsks0DaUGGcxQtJNahQ96kxuz6wCdhb0YRamoN2PE65DXZJQQJ99BFACL93NaAArohAAABAZBS2Itt';

const AZURE_CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://kesav-mbosq0if-eastus2.cognitiveservices.azure.com/',
  apiKey: process.env.AZURE_OPENAI_API_KEY || 'lhdhXwKJnJVA9E3KlnE8EICjBikdcAPJmQlXYQCVon0mRDmaaxXuJQQJ99BFACHYHv6XJ3w3AAAAACOGhE4j',
  deployment: process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview',
  voiceChoice: process.env.AZURE_OPENAI_REALTIME_VOICE_CHOICE || 'alloy',
  searchEndpoint: process.env.AZURE_SEARCH_ENDPOINT || 'https://velocitisearch.search.windows.net',
  searchIndex: process.env.AZURE_SEARCH_INDEX || 'multimodal-rag-1748870142039',
  searchApiKey: process.env.AZURE_SEARCH_API_KEY || 'vUdvY61UzhcOSxhmlJNp4KoO11U7opQccMPJ8M9ilDAzSeDCBkrb',
  searchSemanticConfiguration: process.env.AZURE_SEARCH_SEMANTIC_CONFIGURATION || 'multimodal-rag-1748870142039-semantic-configuration',
  searchIdentifierField: process.env.AZURE_SEARCH_IDENTIFIER_FIELD || 'content_id',
  searchTitleField: process.env.AZURE_SEARCH_TITLE_FIELD || 'document_title',
  searchContentField: process.env.AZURE_SEARCH_CONTENT_FIELD || 'content_text',
  searchEmbeddingField: process.env.AZURE_SEARCH_EMBEDDING_FIELD || 'content_embedding',
  searchUseVectorQuery: process.env.AZURE_SEARCH_USE_VECTOR_QUERY === 'true',
  tenantId: process.env.AZURE_TENANT_ID || 'd8de15bd-e39b-44b9-a159-da558e2e993e'
};

export async function registerRoutes(app: Express): Promise<Server> {
  const directLineClient = new DirectLineClient({ token: DIRECT_LINE_TOKEN });

  // Start a new conversation with Copilot Studio
  app.post("/api/conversations/start", async (req, res) => {
    try {
      const conversation = await directLineClient.startConversation();
      
      // Store conversation in our storage
      const storedConversation = await storage.createConversation({
        directLineConversationId: conversation.conversationId
      });

      res.json({
        id: storedConversation.id,
        directLineConversationId: conversation.conversationId,
        token: conversation.token,
        streamUrl: conversation.streamUrl
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  });

  // Send message to Copilot Studio
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation || !conversation.directLineConversationId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Send to Direct Line API
      const result = await directLineClient.sendActivity(conversation.directLineConversationId, {
        text: text
      });

      // Store user message
      await storage.createMessage({
        conversationId: conversationId.toString(),
        text: text,
        sender: 'user',
        messageType: 'text'
      });

      res.json({ id: result.id });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Get messages from Copilot Studio
  app.get("/api/conversations/:id/activities", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const watermark = req.query.watermark as string;

      const conversation = await storage.getConversation(conversationId);
      if (!conversation || !conversation.directLineConversationId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const activities = await directLineClient.getActivities(conversation.directLineConversationId, watermark);

      // Store new messages from bot
      for (const activity of activities.activities) {
        if (activity.from.id !== 'user' && activity.type === 'message' && activity.text) {
          await storage.createMessage({
            conversationId: conversationId.toString(),
            text: activity.text,
            sender: 'assistant',
            messageType: 'text'
          });
        }
      }

      res.json(activities);
    } catch (error) {
      console.error('Error getting activities:', error);
      res.status(500).json({ error: 'Failed to get activities' });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = req.params.id;
      const messages = await storage.getMessagesByConversationId(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // Clear conversation messages
  app.delete("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = req.params.id;
      await storage.clearConversationMessages(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing messages:', error);
      res.status(500).json({ error: 'Failed to clear messages' });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for Azure OpenAI Realtime
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/realtime'
  });

  wss.on('connection', async (ws) => {
    console.log('WebSocket client connected');
    
    let realtimeClient: AzureOpenAIRealtimeClient | null = null;

    try {
      realtimeClient = new AzureOpenAIRealtimeClient(AZURE_CONFIG);
      await realtimeClient.connect();

      // Forward events from client to Azure OpenAI
      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          if (realtimeClient) {
            realtimeClient.sendEvent(event);
          }
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      // Forward events from Azure OpenAI to client
      realtimeClient.on('session.created', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('session.updated', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('input_audio_buffer.committed', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('input_audio_buffer.cleared', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('input_audio_buffer.speech_started', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('input_audio_buffer.speech_stopped', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('conversation.item.created', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('conversation.item.input_audio_transcription.completed', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.created', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.output_item.added', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.content_part.added', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.audio_transcript.delta', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.audio.delta', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('response.done', (event) => {
        ws.send(JSON.stringify(event));
      });

      realtimeClient.on('error', (event) => {
        ws.send(JSON.stringify(event));
      });

    } catch (error) {
      console.error('Error setting up realtime client:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: {
          message: 'Failed to connect to Azure OpenAI Realtime API'
        }
      }));
    }

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      if (realtimeClient) {
        realtimeClient.disconnect();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (realtimeClient) {
        realtimeClient.disconnect();
      }
    });
  });

  return httpServer;
}
