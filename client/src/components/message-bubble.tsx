import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  messageType?: 'text' | 'voice';
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const timestamp = message.timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  if (message.sender === 'user') {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="user-message rounded-2xl rounded-br-md px-4 py-3 max-w-xs lg:max-w-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>  
        <div className="text-xs opacity-75 mt-1 text-white/75">{timestamp}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-slide-up">
      <div className="assistant-message rounded-2xl rounded-bl-md px-4 py-3 max-w-xs lg:max-w-md shadow-sm">
        <div className="prose prose-sm dark:prose-invert text-card-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{timestamp}</div>
      </div>
    </div>
  );
}
