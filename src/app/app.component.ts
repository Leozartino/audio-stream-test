import { Component } from '@angular/core';
import { AudioService } from './audio.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  constructor(public audioService: AudioService) {}

  toggleRecording() {
    if (this.audioService.isRecordingActive()) {
      this.audioService.stopRecording();
    } else {
      this.audioService.startRecording().then(() =>
        console.log('Recording started.')
      );
    }
  }
}
