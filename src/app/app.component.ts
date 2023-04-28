import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChatService } from './chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  title = 'twilio-chat-example';
  userName:string = '';
  enableChat:boolean = false;
  $nameSubscriber:Subscription;

  constructor(
    private chatService:ChatService
  ){
    this.$nameSubscriber = this.chatService.userName.subscribe( name => this.userName = name);
  }

  ngOnInit(): void {

  }

  setName(){
    this.chatService.setUsername(this.userName);
    this.enableChat = true;
  }

  logout(){
    this.chatService.setUsername('');
    this.enableChat = false;
  }

  ngOnDestroy(): void {
    if(this.$nameSubscriber) this.$nameSubscriber.unsubscribe();
  }
}
