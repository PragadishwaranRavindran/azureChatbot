interface LiveCaptionsProps {
  userTranscript: string;
  assistantTranscript: string;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
}

export default function LiveCaptions({ 
  userTranscript, 
  assistantTranscript, 
  isUserSpeaking, 
  isAssistantSpeaking 
}: LiveCaptionsProps) {
  if (!isUserSpeaking && !isAssistantSpeaking) return null;

  return (
    <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-40 max-w-2xl w-full px-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-6 py-4 text-center animate-fade-in">
        {isUserSpeaking && userTranscript && (
          <div className="mb-2">
            <div className="text-xs text-blue-400 font-medium mb-1">You're saying:</div>
            <div className="text-white text-sm">{userTranscript}</div>
          </div>
        )}
        
        {isAssistantSpeaking && assistantTranscript && (
          <div>
            <div className="text-xs text-green-400 font-medium mb-1">AI is saying:</div>
            <div className="text-white text-sm">{assistantTranscript}</div>
          </div>
        )}
        
        {(isUserSpeaking || isAssistantSpeaking) && (
          <div className="flex items-center justify-center mt-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-xs text-gray-300 ml-2">
              {isUserSpeaking ? 'Listening...' : 'Speaking...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}