interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export class AzureOpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Connect to our backend WebSocket proxy
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/realtime`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to Azure OpenAI Realtime API');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.ws = null;
      };
    });
  }

  sendEvent(event: RealtimeEvent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify(event));
  }

  sendAudioData(audioBlob: Blob) {
    // Convert audio blob to base64 and send as audio input
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      this.sendEvent({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      });
    };
    reader.readAsArrayBuffer(audioBlob);
  }

  commitAudioBuffer() {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  clearAudioBuffer() {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    });
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

    // Handle common events
    switch (event.type) {
      case 'session.created':
        console.log('Session created:', event);
        break;
      
      case 'response.audio.delta':
        // Handle audio response chunks
        this.playAudioChunk(event.delta);
        break;
      
      case 'response.audio_transcript.delta':
        // Handle transcript updates
        console.log('Transcript delta:', event.delta);
        break;
      
      case 'input_audio_buffer.speech_started':
        console.log('Speech started');
        break;
      
      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped');
        this.commitAudioBuffer();
        break;
      
      case 'error':
        console.error('Realtime API error:', event.error);
        break;
    }
  }

  private audioContext: AudioContext | null = null;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;

  private async playAudioChunk(base64Audio: string) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Decode base64 audio
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32Array
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      this.audioQueue.push(float32);
      
      if (!this.isPlaying) {
        this.playAudioQueue();
      }
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }

  private async playAudioQueue() {
    if (!this.audioContext || this.audioQueue.length === 0) return;

    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift()!;
      
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, 24000);
      audioBuffer.copyToChannel(audioData, 0);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      await new Promise(resolve => {
        source.onended = resolve;
        source.start();
      });
    }

    this.isPlaying = false;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
  }
}
