import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  constructor(
    private http:HttpClient
  ) { }

  private url = "http://localhost:3000";

  userName:BehaviorSubject<string> = new BehaviorSubject('');

  setUsername(text:string){
    this.userName.next(text);
  }

  getToken(name:string){
    let param = new HttpParams();
    param = param.set('userName', name);
    return this.http.get<string>(`${this.url}/getToken`, {params: param});
  }
}
