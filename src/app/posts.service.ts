import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import { map } from 'rxjs/operators';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class PostsService {

  arr: any = [];

  constructor(private http: HttpClient) {
  }

  getAllPosts(criteria: DataSearchCriteria) {
    return this.http.get('/routes/posts').pipe(map(posts => {
      this.arr = posts;
      this.arr.forEach((item, index) => {
        item['#'] = index + 1;
      });
      // console.log(this.arr);
      return this.arr.sort((a, b) => {
        if (criteria.sortDirection === 'desc') {
          if (a[criteria.sortColumn] < b[criteria.sortColumn]) {
            return 1;
          } else if (a[criteria.sortColumn] > b[criteria.sortColumn]) {
            return -1;
          } else {
            return 0;
          }
        }
        if (criteria.sortDirection === 'asc') {
          if (a[criteria.sortColumn] < b[criteria.sortColumn]) {
            return -1;
          } else if (a[criteria.sortColumn] > b[criteria.sortColumn]) {
            return 1;
          } else {
            return 0;
          }
        }
      });
    }));
  }
}

export class DataSearchCriteria {
  sortColumn: string;
  sortDirection: string;
}
