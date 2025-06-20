import { useState, useRef, useCallback } from "react";
import { AzureOpenAIRealtimeClient } from "@/lib/azure-openai-realtime";

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [assistantTranscript, setAssistantTranscript] = useState<string>("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const realtimeClientRef = useRef<AzureOpenAIRealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const currentResponseRef = useRef<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript("");
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000
        } 
      });
      
      streamRef.current = stream;

      // Initialize Azure OpenAI Realtime client
      const realtimeClient = new AzureOpenAIRealtimeClient();
      await realtimeClient.connect();
      realtimeClientRef.current = realtimeClient;

      // Set up audio context for real-time processing
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Convert to base64 and send
        const uint8Array = new Uint8Array(pcm16.buffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binaryString);
        realtimeClient.sendEvent({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Set up event handlers
      realtimeClient.on('input_audio_buffer.speech_started', () => {
        console.log('Speech detected');
        // If assistant is speaking, interrupt and cancel current response
        if (assistantSpeaking) {
          realtimeClient.sendEvent({
            type: 'response.cancel'
          });
          setAssistantSpeaking(false);
          setAssistantTranscript("");
        }
      });

      realtimeClient.on('input_audio_buffer.speech_stopped', () => {
        console.log('Speech ended');
        realtimeClient.sendEvent({
          type: 'input_audio_buffer.commit'
        });
        realtimeClient.sendEvent({
          type: 'response.create'
        });
        setIsProcessing(true);
      });

      realtimeClient.on('conversation.item.input_audio_transcription.completed', (event: any) => {
        if (event.transcript) {
          setTranscript(event.transcript);
        }
      });

      realtimeClient.on('response.created', (event: any) => {
        currentResponseRef.current = event.response.id;
        setAssistantSpeaking(true);
        setAssistantTranscript("");
      });

      realtimeClient.on('response.audio_transcript.delta', (event: any) => {
        if (event.delta) {
          setAssistantTranscript(prev => prev + event.delta);
        }
      });

      realtimeClient.on('response.audio.delta', (event: any) => {
        // Audio is handled by the client library
      });

      realtimeClient.on('response.done', () => {
        setIsProcessing(false);
        setAssistantSpeaking(false);
        currentResponseRef.current = null;
        // Keep the final transcript visible for a moment
        setTimeout(() => {
          setAssistantTranscript("");
        }, 2000);
      });

      realtimeClient.on('response.cancelled', () => {
        setIsProcessing(false);
        setAssistantSpeaking(false);
        setAssistantTranscript("");
        currentResponseRef.current = null;
      });

      setIsRecording(true);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start voice recording. Please check your microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
      realtimeClientRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  return {
    isRecording,
    isProcessing,
    error,
    transcript,
    assistantSpeaking,
    assistantTranscript,
    startRecording,
    stopRecording
  };
}
