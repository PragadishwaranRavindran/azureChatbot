import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bot, Mic, Send, Trash2, Moon, Sun } from "lucide-react";
import MessageBubble from "./message-bubble";
import VoiceOverlay from "./voice-overlay";
import { useDirectLine } from "@/hooks/use-direct-line";
import { useVoiceRecording } from "@/hooks/use-voice-recording";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  messageType?: 'text' | 'voice';
}

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const {
    conversationId,
    isConnected,
    isLoading,
    messages,
    sendMessage,
    clearConversation,
    error: directLineError
  } = useDirectLine();

  const {
    isRecording,
    startRecording,
    stopRecording,
    error: voiceError
  } = useVoiceRecording();

  // Handle new messages from Direct Line
  useEffect(() => {
    // This would be handled by the useDirectLine hook
    // Messages would be added via the hook's message callback
  }, []);

  // Show errors
  useEffect(() => {
    if (directLineError) {
      toast({
        title: "Connection Error",
        description: directLineError,
        variant: "destructive",
      });
    }
  }, [directLineError, toast]);

  useEffect(() => {
    if (voiceError) {
      toast({
        title: "Voice Error",
        description: voiceError,
        variant: "destructive",
      });
    }
  }, [voiceError, toast]);

  // Auto-resize textarea
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-content]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !conversationId) return;

    const messageText = inputValue.trim();
    setInputValue("");
    setIsTyping(true);

    try {
      await sendMessage(messageText);
      // The response will be handled by the useDirectLine hook
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      clearConversation();
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Bot className="text-primary-foreground w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">
              {isConnected ? 'Connected' : 'Connecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 relative">
        <ScrollArea ref={scrollAreaRef} className="h-full px-4 py-6">
          <div className="space-y-4">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="flex justify-center animate-fade-in">
                <div className="bg-card border rounded-lg shadow-sm p-4 max-w-2xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bot className="text-primary w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-semibold text-card-foreground mb-2">
                      Welcome to AI Assistant
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      I'm here to help you with your questions. You can type your message or use the voice button to speak with me.
                    </p>
                    <div className="flex items-center justify-center space-x-4 mt-4 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <span>💬</span>
                        <span>Type to chat</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>🎤</span>
                        <span>Voice enabled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="assistant-message rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">AI is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Voice Recording Overlay */}
      <VoiceOverlay
        isVisible={isRecording}
        onStop={stopRecording}
      />

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-900 border-t border-border px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            {/* Voice Button */}
            <Button
              variant="outline"
              size="icon"
              className={`flex-shrink-0 h-12 w-12 rounded-full transition-colors ${
                isRecording 
                  ? 'voice-recording text-white border-red-500' 
                  : 'hover:bg-accent'
              }`}
              onClick={handleVoiceToggle}
              title="Voice input"
            >
              <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Type your message here..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  autoResizeTextarea();
                }}
                onKeyDown={handleKeyDown}
                className="resize-none rounded-2xl border-input focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{ maxHeight: '120px' }}
                rows={1}
              />
            </div>

            {/* Send Button */}
            <Button
              size="icon"
              className="flex-shrink-0 h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || !conversationId}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>
                {isConnected ? 'Connected to AI Assistant' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
