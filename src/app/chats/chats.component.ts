import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatService } from '../chat.service';
import { Client, ConnectionState, Conversation, Message, Participant, User, UserUpdateReason } from '@twilio/conversations';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chats',
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.css']
})
export class ChatsComponent implements OnInit, OnDestroy, AfterViewChecked {

  userName: string;
  client: Client;
  $nameSubscriber: Subscription;
  isLoading: boolean;
  newUser: string;

  chatList: Array<any> = [];
  chatListMeta: Array<{ sid: string, unreadCount: number, lastMessage: string }> = [];
  messages: Array<Message> = [];
  message: string;
  error: string;
  currentConversation: Conversation;

  isTyping: boolean;
  currentTime: Date;
  @ViewChild('chatBox') private myScrollContainer: ElementRef;

  constructor(
    private chatService: ChatService
  ) {
    this.$nameSubscriber = this.chatService.userName.subscribe(name => this.userName = name);
  }

  ngOnInit(): void {
    this.currentTime = new Date();
    this.connectTwilio();
  }

  getToken() {
    return this.chatService.getToken(this.userName);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  connectTwilio() {
    this.isLoading = true;
    this.getToken().subscribe(token => {
      this.client = new Client(token);
      this.isLoading = false;
      this.listenToEvents();
    }, error => console.log(error));
  }

  listenToEvents() {
    this.client.on('initialized', () => {
      console.log('Client initialized');
      this.fetchUserChats();
    });

    this.client.on('initFailed', (error: any) => {
      console.log('Client initialization failed: ', error);
    });

    this.client.on('connectionStateChanged', (state: ConnectionState) => {
      console.log('Connection state change: ', state);
    });

    this.client.on('connectionError', (error: any) => {
      console.log('Connection error: ', error);
    });

    this.client.on('tokenAboutToExpire', () => {
      console.log('About to expire');
      this.getToken().subscribe(async (token) => {
        this.client = await this.client.updateToken(token);
      })
    });

    this.client.on('tokenExpired', () => {
      console.log('Token expired');
      this.client.removeAllListeners();
      this.connectTwilio();
    });

    this.client.on('conversationAdded', (conv: Conversation) => {
      setTimeout(async () => {
        if (conv.dateCreated && conv.dateCreated > this.currentTime) {
          console.log('Conversation added', conv);
          await conv.setAllMessagesUnread();
          this.chatList = this.chatList.concat(conv);
          setTimeout(async () => {
            this.chatListMeta = [{
              sid: conv.sid,
              unreadCount: await conv.getUnreadMessagesCount(),
              lastMessage: (await conv.getMessages()).items[conv.lastReadMessageIndex].body
            }, ...this.chatListMeta];
          }, 500);
        }
      }, 500);
    });

    this.client.on('messageAdded', async (msg: Message) => {
      console.log('Message added', msg);
      if (this.currentConversation && this.currentConversation.sid === msg.conversation.sid) {
        this.messages.push(msg);
        await this.currentConversation.updateLastReadMessageIndex(msg.index);
        this.chatListMeta = this.chatListMeta.map(el => {
          if (el.sid == this.currentConversation.sid) {
            el.lastMessage = msg.body;
          }
          return el;
        })
      } else {
        this.chatListMeta = this.chatListMeta.map(el => {
          if (el.sid == msg.conversation.sid) {
            el.lastMessage = msg.body;
            el.unreadCount++;
          }
          return el;
        })
      }
    });

    this.client.on('typingStarted', (user: Participant) => {
      console.log('typing..', user);
      if (user.conversation.sid === this.currentConversation.sid) this.isTyping = true;
    });

    this.client.on('typingEnded', (user: Participant) => {
      console.log('typing end..', user);
      if (user.conversation.sid === this.currentConversation.sid) this.isTyping = false;
    });
  }

  fetchUserChats() {
    this.isLoading = true;
    this.client.getSubscribedConversations().then(convs => {
      this.chatList = [...convs.items, ...this.chatList];
      this.chatList.forEach(async (chat) => {
        this.chatListMeta.push({
          sid: chat.sid,
          unreadCount: await chat.getUnreadMessagesCount(),
          lastMessage: (await chat.getMessages()).items[chat.lastReadMessageIndex || 0].body
        });
      });

      this.isLoading = false;
    }).catch(error => console.log(error));
  }

  sendMessage() {
    this.currentConversation.sendMessage(this.message).then(result => {
      this.message = '';
    }).catch(err => console.log(err));
  }

  newChat() {
    this.isLoading = true;
    this.client.getUser(this.newUser).then(res => {
      this.client.createConversation({
        friendlyName: `${this.newUser}-${this.userName}`,
      }).then(async (channel: Conversation) => {
        channel.join().then(async () => {
          await channel.setAllMessagesUnread();
          channel.add(this.newUser).then(() => {
            this.currentConversation = channel;
            this.message = `-- ${this.userName} created a new chat --`;
            this.sendMessage();
            this.openChat(channel);
            this.scrollToBottom();
            this.isLoading = false;
          })
        });
      }).catch(error => console.log(error));
    }).catch(err => {
      this.isLoading = false;
      this.error = 'User not found in Twilio';
      setTimeout(() => {
        this.error = null;
      }, 2000);
      this.newUser = null;
    });
  }

  openChat(conv: Conversation) {
    this.currentConversation = conv;
    this.messages = [];
    this.fetchMessages();
  }

  fetchMessages(skip?: number) {
    this.isLoading = true;
    this.currentConversation.getMessages(30, skip).then(async (result) => {
      this.messages = [...result.items, ...this.messages];
      if (!skip) {
        let resetTo = this.messages.length >= 1 ? this.messages[this.messages.length - 1].index : 0;
        await this.currentConversation.updateLastReadMessageIndex(resetTo);
        this.chatListMeta = this.chatListMeta.map(el => {
          if (el.sid == this.currentConversation.sid) {
            el.unreadCount = 0;
          }
          return el;
        })
      }
      this.isLoading = false;
    }).catch(error => {
      this.isLoading = false;
      console.log(error)
    });
  }

  loadMessages() {
    if (this.messages[0].index > 0) this.fetchMessages(this.messages[0].index - 1);
  }

  getCounts() {
    return this.currentConversation.lastMessage ? this.currentConversation.lastMessage.index : 0;
  }

  ngOnDestroy(): void {
    if (this.$nameSubscriber) this.$nameSubscriber.unsubscribe();
    this.client.removeAllListeners();
    this.client.shutdown();
  }

}
