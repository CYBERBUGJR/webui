import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import * as _ from 'lodash';

import { DialogService, SystemGeneralService, WebSocketService } from '../../../services/index';
import { ApplicationsService } from '../applications.service';
import { ModalService } from '../../../services/modal.service';
import { EntityJobComponent } from '../../common/entity/entity-job/entity-job.component';
import { EntityUtils } from '../../common/entity/utils';
import { DialogFormConfiguration } from '../../common/entity/entity-dialog/dialog-form-configuration.interface';
import { ChartReleaseEditComponent } from '../forms/chart-release-edit.component';
import { CommonUtils } from 'app/core/classes/common-utils';
import { ChartFormComponent } from '../forms/chart-form.component';
import { EmptyConfig, EmptyType } from '../../common/entity/entity-empty/entity-empty.component';

import  helptext  from '../../../helptext/apps/apps';
import { Router } from '@angular/router';

@Component({
  selector: 'app-charts',
  templateUrl: './chart-releases.component.html',
  styleUrls: ['../applications.component.scss']
})

export class ChartReleasesComponent implements OnInit {
  public chartItems = {};
  @Output() switchTab = new EventEmitter<string>();

  private dialogRef: any;
  public ixIcon = 'assets/images/ix-original.png';
  private rollbackChartName: string;
  private refreshTable: Subscription;

  protected utils: CommonUtils;
  private refreshForm: Subscription;
  private chartReleaseChangedListener: any;
  
  private selectedAppName: String;
  private podList = [];
  private podDetails = {};
 
  public emptyPageConf: EmptyConfig = {
    type: EmptyType.loading,
    large: true,
    title: helptext.message.loading,
    button: {
      label: "View Catalog",
      action: this.viewCatalog.bind(this),
    }
  };

  public rollBackChart: DialogFormConfiguration = {
    title: helptext.charts.rollback_dialog.title,
    fieldConfig: [{
      type: 'input',
      name: 'item_version',
      placeholder: helptext.charts.rollback_dialog.version.placeholder,
      tooltip: helptext.charts.rollback_dialog.version.tooltip,
      required: true
    },{
      type: 'checkbox',
      name: 'rollback_snapshot',
      placeholder: helptext.charts.rollback_dialog.snapshot.placeholder,
      tooltip: helptext.charts.rollback_dialog.snapshot.tooltip
    },{
      type: 'checkbox',
      name: 'force',
      placeholder: helptext.charts.rollback_dialog.force.placeholder,
      tooltip: helptext.charts.rollback_dialog.force.tooltip
    }],
    method_ws: 'chart.release.rollback',
    saveButtonText: helptext.charts.rollback_dialog.action,
    customSubmit: this.doRollback,
    parent: this,
  }

  public choosePod: DialogFormConfiguration = {
    title: helptext.podConsole.choosePod.title,
    fieldConfig: [{
      type: 'select',
      name: 'pods',
      placeholder: helptext.podConsole.choosePod.placeholder,
      required: true,
    },{
      type: 'select',
      name: 'containers',
      placeholder: helptext.podConsole.chooseConatiner.placeholder,
      required: true,
    },{
      type: 'input',
      name: 'command',
      placeholder: helptext.podConsole.chooseCommand.placeholder,
      value: '/bin/bash'
    }],
    saveButtonText: helptext.podConsole.choosePod.action,
    customSubmit: this.doPodSelect,
    afterInit: this.afterShellDialogInit,
    parent: this,
  }

  constructor(private mdDialog: MatDialog,
    private dialogService: DialogService, private translate: TranslateService,
    private appService: ApplicationsService, private modalService: ModalService,
    private sysGeneralService: SystemGeneralService, private router: Router,
    protected ws: WebSocketService
  ) { }

  ngOnInit(): void {
    this.utils = new CommonUtils();

    this.refreshTable = this.modalService.refreshTable$.subscribe(() => {
      this.refreshChartReleases();
    });

    this.addChartReleaseChangedEventListner();
  }

  ngOnDestroy() {
    if (this.chartReleaseChangedListener) {
      this.ws.unsubscribe(this.chartReleaseChangedListener);
    }
  }

  viewCatalog() {
    this.switchTab.emit('0');
  }

  showLoadStatus(type: EmptyType) {
    let title = "";
    let message = undefined;

    switch (type) {
      case EmptyType.loading:
        title = helptext.message.loading;
        break;
      case EmptyType.first_use:
        title = helptext.message.not_configured;
        break;
      case EmptyType.no_page_data :
        title = helptext.message.no_installed;
        message = helptext.message.no_installed_message;
        break;
      case EmptyType.errors:
        title = helptext.message.not_running;
        break;
    }

    this.emptyPageConf.type = type;
    this.emptyPageConf.title = title;
    this.emptyPageConf.message = message;
  }

  getChartItems() {
    return Object.values(this.chartItems);
  }
  
  addChartReleaseChangedEventListner() {
    this.chartReleaseChangedListener = this.ws.subscribe("chart.release.query").subscribe((evt) => {
      const app = this.chartItems[evt.id];
      if (app) {
        app.status = evt.fields.status;
      }
    });
  }

  refreshChartReleases() {
    this.showLoadStatus(EmptyType.loading);
    this.chartItems = {};
    const checkTitle = setTimeout(() => {
        this.updateChartReleases();
    }, 1000);
  }

  updateChartReleases() {
    this.appService.getKubernetesConfig().subscribe(res => {
      if (!res.pool) {
        this.chartItems = {};
        this.showLoadStatus(EmptyType.first_use);
      } else {
        this.appService.getKubernetesServiceStarted().subscribe(res => {
          if (!res) {
            this.chartItems = {};
            this.showLoadStatus(EmptyType.errors);
          } else {
            this.appService.getChartReleases().subscribe(charts => {
              this.chartItems = {};
              
              charts.forEach(chart => {
                let chartObj = {
                  name: chart.name,
                  catalog: chart.catalog,
                  status: chart.status,
                  version: chart.chart_metadata.version,
                  latest_version: chart.chart_metadata.latest_chart_version,
                  description: chart.chart_metadata.description,
                  update: chart.update_available,
                  chart_name: chart.chart_metadata.name,
                  repository: chart.config.image.repository,
                  tag: chart.config.image.tag,
                  portal: chart.portals && chart.portals.web_portal ? chart.portals.web_portal[0] : '',
                  id: chart.chart_metadata.name,
                  icon: chart.chart_metadata.icon ? chart.chart_metadata.icon : this.ixIcon,
                  count: `${chart.pod_status.available}/${chart.pod_status.desired}`,
                  desired: chart.pod_status.desired,
                  history: !(_.isEmpty(chart.history)),
                };
        
                let ports = [];
                if (chart.used_ports) {
                  chart.used_ports.forEach(item => {
                    ports.push(`${item.port}\\${item.protocol}`)
                  })
                  chartObj['used_ports'] = ports.join(', ');
                  this.chartItems[chartObj.name] = chartObj;
                }  
              })
              
              if (this.getChartItems().length == 0) {
                this.showLoadStatus(EmptyType.no_page_data );
              }
            })
          }
        })
      }
    })
  }

  refreshStatus(name: string) {
    this.appService.getChartReleases(name).subscribe(res => {
      let item = this.chartItems[name];
      if (item) {
        item.status = res[0].status;
        if (item.status === 'DEPLOYING') {
          setTimeout(() => {
            this.refreshStatus(name);
          }, 3000);
        }
      }
    })
  }

  start(name: string) {
    this.appService.setReplicaCount(name, 1).subscribe(() => {
      this.refreshStatus(name);
    })
  }

  stop(name: string) {
    this.appService.setReplicaCount(name, 0).subscribe(() => {
      this.refreshStatus(name);
    })
  }

  portal(portal: string) {
    window.open(portal);
  }

  update(name: string) {
    this.translate.get(helptext.charts.upgrade_dialog.msg).subscribe(msg => {
      this.dialogService.confirm(helptext.charts.upgrade_dialog.title, msg + name + '?')
      .subscribe(res => {
        if (res) {
          this.dialogRef = this.mdDialog.open(EntityJobComponent, { data: { 'title': (
            helptext.charts.upgrade_dialog.job) }, disableClose: true});
          this.dialogRef.componentInstance.setCall('chart.release.upgrade', [name]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe((res) => {
            this.dialogService.closeAllDialogs();
          });
          this.dialogRef.componentInstance.failure.subscribe((err) => {
            // new EntityUtils().handleWSError(this, err, this.dialogService);
          })
        }
      })
    })
  }

  rollback(name: string) {
    this.rollbackChartName = name;
    this.dialogService.dialogForm(this.rollBackChart, true);
  }

  doRollback(entityDialog: any) {
    const self = entityDialog.parent;
    const form = entityDialog.formGroup.controls;
    const payload = {
      item_version: form['item_version'].value,
      rollback_snapshot: form['rollback_snapshot'].value,
      force: form['force'].value
    }
    self.dialogRef = self.mdDialog.open(EntityJobComponent, { data: { 'title': (
      helptext.charts.rollback_dialog.job) }, disableClose: true});
    self.dialogRef.componentInstance.setCall('chart.release.rollback', [self.rollbackChartName, payload]);
    self.dialogRef.componentInstance.submit();
    self.dialogRef.componentInstance.success.subscribe((res) => {
      self.dialogService.closeAllDialogs();
    });
    self.dialogRef.componentInstance.failure.subscribe((err) => {
      // new EntityUtils().handleWSError(self, err, self.dialogService);
    })

  }

  edit(name: string, id: string) {
    const catalogApp = this.chartItems[name];
    if (catalogApp && catalogApp.chart_name != 'ix-chart') {
      const chartFormComponent = new ChartFormComponent(this.mdDialog,this.dialogService,this.modalService,this.appService);
      chartFormComponent.setTitle(catalogApp.chart_name);
      this.modalService.open('slide-in-form', chartFormComponent, name);
    } else {
      const chartReleaseForm = new ChartReleaseEditComponent(this.mdDialog,this.dialogService,this.modalService,this.appService);
      this.modalService.open('slide-in-form', chartReleaseForm, name);
    }
  }

  delete(name: string) {
    this.translate.get(helptext.charts.delete_dialog.msg).subscribe(msg => {
      this.dialogService.confirm(helptext.charts.delete_dialog.title, msg + name + '?')
      .subscribe(res => {
        if (res) {
          this.dialogRef = this.mdDialog.open(EntityJobComponent, { data: { 'title': (
            helptext.charts.delete_dialog.job) }, disableClose: true});
          this.dialogRef.componentInstance.setCall('chart.release.delete', [name]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe((res) => {
            this.dialogService.closeAllDialogs();
            this.refreshChartReleases();
          });
          this.dialogRef.componentInstance.failure.subscribe((err) => {
            // new EntityUtils().handleWSError(this, err, this.dialogService);
          })
        }
      })
    })
  }

  updateImage(image: string, tag: string) {
    this.translate.get(helptext.updateImageDialog.message).subscribe(msg => {
      this.dialogService.confirm(helptext.updateImageDialog.title, msg + image + '?', true).subscribe(res => {
        if (res) {
          this.dialogRef = this.mdDialog.open(EntityJobComponent, { data: { 'title': (
            helptext.charts.update_dialog.job) }, disableClose: true});
          this.dialogRef.componentInstance.setCall('container.image.pull', [{from_image: image,tag:tag}]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe(() => {
            this.dialogService.closeAllDialogs();
            this.dialogService.Info(helptext.updateImageDialog.success, helptext.updateImageDialog.successMsg,
               '300px', 'info', true);
            this.refreshChartReleases();
          });
          this.dialogRef.componentInstance.failure.subscribe((err) => {
            // new EntityUtils().handleWSError(this, err, this.dialogService);
          })
        }
      })
    })
  }

  openShell(name: string) {
    this.podList = [];
    this.podDetails = {};
    this.selectedAppName = name;
    this.ws.call('chart.release.pod_console_choices', [this.selectedAppName]).subscribe(res => {
      this.podDetails = Object.assign({}, res);
      this.podList = Object.keys(this.podDetails);
      if (this.podList.length == 0) {
        this.dialogService.confirm(helptext.podConsole.nopod.title, helptext.podConsole.nopod.message, true, 'Close', false, null, null, null, null, true);
      } else {
        this.choosePod.fieldConfig[0].value = this.podList[0];
        this.choosePod.fieldConfig[0].options = this.podList.map(item => {
          return {
            label: item,
            value: item,
          }
        });
        this.choosePod.fieldConfig[1].value = this.podDetails[this.podList[0]][0];
        this.choosePod.fieldConfig[1].options = this.podDetails[this.podList[0]].map(item => {
          return {
            label: item,
            value: item,
          }
        });
        this.dialogService.dialogForm(this.choosePod, true);
      }
    })
  }

  doPodSelect(entityDialog: any) {
    const self = entityDialog.parent;
    const pod = entityDialog.formGroup.controls['pods'].value;
    const command = entityDialog.formGroup.controls['command'].value;
    self.router.navigate(new Array("/apps/shell/").concat([self.selectedAppName, pod, command]));
    self.dialogService.closeAllDialogs();
  }

  afterShellDialogInit(entityDialog: any) {
    const self = entityDialog.parent;
    entityDialog.formGroup.controls['pods'].valueChanges.subscribe(value => {
      const containers = self.podDetails[value];
      const containerFC = _.find(entityDialog.fieldConfig, {'name' : 'containers'});
      containerFC.options = containers.map(item => {
        return {
          label: item,
          value: item,
        }
      });
      entityDialog.formGroup.controls['containers'].setValue(containers[0]);
    })
  }
}
