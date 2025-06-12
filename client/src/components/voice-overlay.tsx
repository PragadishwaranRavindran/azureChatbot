import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface VoiceOverlayProps {
  isVisible: boolean;
  onStop: () => void;
}

export default function VoiceOverlay({ isVisible, onStop }: VoiceOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm mx-4 text-center">
        <div className="w-24 h-24 voice-recording rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
          <Mic className="text-white w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Listening...</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Speak now, I'm listening to your question
        </p>
        <Button
          onClick={onStop}
          className="voice-recording hover:bg-red-600 text-white"
        >
          <Square className="w-4 h-4 mr-2" />
          Stop Recording
        </Button>
      </div>
    </div>
  );
}
