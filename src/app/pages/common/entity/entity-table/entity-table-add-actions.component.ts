import { Component, ElementRef, Input, ViewChild, OnInit, AfterViewInit, OnDestroy, SimpleChanges} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import {RestService} from '../../../../services/rest.service';

import {EntityTableComponent} from './entity-table.component';

@Component({
  selector : 'app-entity-table-add-actions',
  templateUrl: './entity-table-add-actions.component.html'
})
export class EntityTableAddActionsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('filter', { static: false}) filter: ElementRef;
  @Input('entity') entity: any;
  public conf;

  public actions: any[];
  public menuTriggerMessage:string = "Click for options";

  public spin: boolean = true;
  public direction: string = 'left';
  public animationMode: string = 'fling';
  get totalActions(){
    if (this.entity && this.entity.conf) {
      let addAction = this.entity.conf.route_add ? 1 : 0;
        return this.actions.length + addAction;
    }
    else {
      return this.actions.length;
    }
  }

  constructor(protected translate: TranslateService) { }

  ngOnInit() { 
    this.actions = this.entity.getAddActions(); 
  }

  ngOnDestroy(){
  }

  ngAfterViewInit(){
    if (this.filter) {
      this.entity.filter = this.filter;
    }
  }

  applyConfig(entity){
    this.entity = entity;
    this.conf = entity.conf;
  }

}
