import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AudioService implements OnDestroy {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private webSocket: WebSocket | null = null;
  private isRecording = false;

  constructor() {}

  ngOnDestroy() {
    this.stopRecording();
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording is already in progress.');
      return;
    }

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize AudioContext
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Dynamically register the AudioWorkletProcessor
      const processorCode = `
        class InlineRecorderProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
              const inputChannelData = input[0];
              const int16Buffer = this.convertFloat32ToInt16(inputChannelData);
              this.port.postMessage(int16Buffer);
            }
            return true;
          }

          convertFloat32ToInt16(buffer) {
            const l = buffer.length;
            const result = new DataView(new ArrayBuffer(l * 2));
            for (let i = 0; i < l; i++) {
              let s = Math.max(-1, Math.min(1, buffer[i]));
              result.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true for little-endian
            }
            return result.buffer;
          }
        }

        registerProcessor('inline-recorder-processor', InlineRecorderProcessor);
      `;
      const blob = new Blob([processorCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);

      // Create a MediaStreamAudioSourceNode
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create the AudioWorkletNode
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'inline-recorder-processor');

      // Handle PCM data from the AudioWorkletProcessor
      this.audioWorkletNode.port.onmessage = (event) => {
        const int16Buffer = event.data as ArrayBuffer;

        // Stream PCM data to the backend via WebSocket
        if (this.webSocket?.readyState === WebSocket.OPEN) {
          this.webSocket.send(int16Buffer);
        }
      };

      // Connect the AudioWorkletNode to the source
      source.connect(this.audioWorkletNode);

      // Open WebSocket connection
      this.webSocket = new WebSocket(`${environment.WS_BOOKING_URL}/audiostream/stream`);
      this.webSocket.binaryType = 'arraybuffer';
      this.webSocket.onopen = () => {
        this.isRecording = true;
        console.log('WebSocket connection opened.');
      };
      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.stopRecording();
      };
      this.webSocket.onclose = () => {
        console.log('WebSocket connection closed.');
        this.stopRecording();
      };
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  public stopRecording(): void {
    if (this.isRecording) {
      // Stop and clean up
      this.audioWorkletNode?.disconnect();
      this.audioWorkletNode = null;

      this.audioContext?.close();
      this.audioContext = null;

      this.mediaStream?.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;

      if (this.webSocket?.readyState === WebSocket.OPEN) {
        this.webSocket.close();
      }

      this.isRecording = false;
    }
  }

  public isRecordingActive(): boolean {
    return this.isRecording;
  }
}
