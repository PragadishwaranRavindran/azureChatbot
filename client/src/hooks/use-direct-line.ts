import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DirectLineConversation {
  id: number;
  directLineConversationId: string;
  token: string;
  streamUrl: string;
}

interface DirectLineActivity {
  type: string;
  id?: string;
  timestamp?: string;
  from: {
    id: string;
    name?: string;
  };
  text?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  messageType?: 'text' | 'voice';
}

export function useDirectLine() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize conversation
  useEffect(() => {
    initializeConversation();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const initializeConversation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest('POST', '/api/conversations/start');
      const conversation: DirectLineConversation = await response.json();

      setConversationId(conversation.id);
      setIsConnected(true);
      
      // Start polling for messages
      startPolling(conversation.id);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize conversation';
      setError(errorMessage);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (convId: number) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const url = watermark 
          ? `/api/conversations/${convId}/activities?watermark=${watermark}`
          : `/api/conversations/${convId}/activities`;

        const response = await apiRequest('GET', url);
        const data = await response.json();

        if (data.activities && data.activities.length > 0) {
          // Handle new activities
          data.activities.forEach((activity: DirectLineActivity) => {
            if (activity.from.id !== 'user' && activity.type === 'message' && activity.text) {
              const newMessage: Message = {
                id: activity.id || Date.now().toString(),
                text: activity.text,
                sender: 'assistant',
                timestamp: new Date(activity.timestamp || Date.now()),
                messageType: 'text'
              };
              
              setMessages(prev => {
                // Avoid duplicate messages
                if (prev.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            }
          });
        }

        if (data.watermark) {
          setWatermark(data.watermark);
        }

      } catch (err) {
        console.error('Polling error:', err);
        // Don't show error for polling failures unless it's persistent
      }
    }, 1000);
  };

  const sendMessage = async (text: string) => {
    if (!conversationId) {
      throw new Error('No active conversation');
    }

    setIsLoading(true);
    setError(null);

    // Add user message to the local state immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      timestamp: new Date(),
      messageType: 'text'
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      await apiRequest('POST', `/api/conversations/${conversationId}/messages`, {
        text
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    if (!conversationId) return;

    try {
      await apiRequest('DELETE', `/api/conversations/${conversationId}/messages`);
      setMessages([]);
    } catch (err) {
      console.error('Error clearing conversation:', err);
    }
  };

  return {
    conversationId,
    isConnected,
    isLoading,
    error,
    messages,
    sendMessage,
    clearConversation
  };
}
