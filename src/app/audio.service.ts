import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private mediaRecorder!: MediaRecorder;
  private webSocket!: WebSocket;
  private isRecording = false;

  constructor() {}

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm; codecs=opus',
      });

      this.webSocket = new WebSocket('ws://localhost:3000/audiostream/stream');

      this.webSocket.onopen = () => {
        this.mediaRecorder.start(1000);
        this.isRecording = true;
      };

      this.mediaRecorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          this.webSocket.readyState === WebSocket.OPEN
        ) {
          this.webSocket.send(event.data);
        }
      };

      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.stopRecording();
      };

      this.webSocket.onclose = () => {
        console.log('WebSocket connection closed');
        this.stopRecording();
      };
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }

  stopRecording() {
    if (this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;

      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.close();
      }
    }
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }
}
