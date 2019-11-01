import {Component, OnInit} from '@angular/core';
import {PostsService, DataSearchCriteria} from '../posts.service';
import {map} from "rxjs/operators";

@Component({
  selector: 'app-posts',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.css'],
})
export class PostsComponent implements OnInit {

  page = 1;
  inputNumPerPage = '';
  numPerPage = 3;
  gotoPageNum = '';
  posts: any = [];
  csvData = '';
  changes: any = [];

  constructor(private  PostService: PostsService) {
  }

  getData() {
    this.PostService.getAllPosts({sortColumn: '#', sortDirection: 'asc'}).subscribe(posts => {
      this.posts = posts;
      this.csvData = this.objectToCsv(posts);
    });
  }

  sortData(criteria: DataSearchCriteria) {
    console.log('CRITERIA: ' + criteria.sortColumn + ', ' + criteria.sortDirection);
    this.PostService.getAllPosts(criteria).subscribe(posts => {
      this.posts = posts;
    });
  }

  onSorted($event) {
    console.log('call onSorted($event)!');
    this.sortData($event);
  }

  gotoPage() {
    // positive int validation
    const re = /^[1-9]*[1-9][0-9]*$/;
    if (!re.test(this.gotoPageNum)) {
      alert('Please input a legal page number!');
    } else {
      const pageNum = Number(this.gotoPageNum);
      // maxPage: consider the influence of table filter (ngx-pagination)
      const filterResultCount = parseInt(document.getElementById('filterResultCount').textContent, 10);
      const maxPage = Math.ceil(filterResultCount / this.numPerPage);
      if (pageNum > maxPage) {
        alert('Maximum page number: ' + maxPage.toString());
      } else {
        this.page = pageNum;
      }
    }
  }

  setItemsPerPage() {
    // positive int validation
    const re = /^[1-9]*[1-9][0-9]*$/;
    if (!re.test(this.inputNumPerPage)) {
      alert('Please input a positive integer!');
    } else {
      this.numPerPage = parseInt(this.inputNumPerPage, 10);
    }
  }

  objectToCsv(data: any) {

    const csvRows = [];

    // get the headers
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));

    // loop over the rows
    for (const row of data) {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    // console.log(csvRows);
    return csvRows.join('\n');
  }

  getNowDate(): string {
    const date = new Date();
    let month: string | number = date.getMonth() + 1;
    let strDate: string | number = date.getDate();

    if (month <= 9) {
      month = '0' + month;
    }

    if (strDate <= 9) {
      strDate = '0' + strDate;
    }

    return date.getFullYear() + '-' + month + '-' + strDate + ' '
      + date.getHours() + '-' + date.getMinutes() + '-' + date.getSeconds();
  }

  Download(data: any) {
    const blob = new Blob([data], {type: 'text/csv'});
    const url = window.URL.createObjectURL(blob);
    // window.open(url);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'long-running-deployment-in-ccv2 ' + this.getNowDate() + '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  exportCsv() {
    this.Download(this.csvData);
  }

  getKeys(item) {
    return Object.keys(item);
  }

  ngOnInit() {
    this.getData();
    /*const interval = setInterval(() => {
      console.log('CHECK FOR DATA CHANGES!');
      this.PostService.getDataChanges().subscribe(async res => {
        this.changes = res;
        const key = 'msg';
        if (this.changes.length === 1 && this.changes[0][key] === '1') {
          await clearInterval(interval);
          window.location.reload(true);
        }
      });
    }, 5000);*/
  }
}
