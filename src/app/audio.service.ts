import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, from, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AudioService implements OnDestroy {
  private mediaRecorder: MediaRecorder | null = null;
  private webSocket: WebSocket | null = null;
  private isRecording = false;
  private audioDataSubject = new Subject<Blob>();

  public audioData$ = this.audioDataSubject.asObservable();

  constructor() {}

  ngOnDestroy() {
    this.stopRecording();
    this.audioDataSubject.complete();
  }

  private getAudioStream(): Observable<MediaStream> {
    return from(navigator.mediaDevices.getUserMedia({ audio: true })).pipe(
      catchError((error) => {
        console.error('Error accessing microphone:', error);
        return throwError(() => error);
      })
    );
  }

  public startRecording(): void {
    if (this.isRecording) {
      console.warn('Recording is already in progress.');
      return;
    }

    this.getAudioStream()
      .pipe(
        tap((stream) => {
          this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm; codecs=opus',
          });

          this.webSocket = new WebSocket(
            'ws://localhost:5001/api/booking/audiostream/stream'
          );

          this.webSocket.onopen = () => {
            this.mediaRecorder?.start(1000);
            this.isRecording = true;
          };

          this.mediaRecorder!.ondataavailable = (event) => {
            if (
              event.data.size > 0 &&
              this.webSocket?.readyState === WebSocket.OPEN
            ) {
              this.webSocket.send(event.data);
              this.audioDataSubject.next(event.data);
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
        })
      )
      .subscribe({
        error: (error) => {
          console.error('Failed to start recording:', error);
        },
      });
  }

  stopRecording() {
    if (this.isRecording) {
      this.mediaRecorder?.stop();
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
