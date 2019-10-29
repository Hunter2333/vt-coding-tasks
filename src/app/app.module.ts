import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PostsComponent } from './posts/posts.component';
// import { FormatTimePipe } from './posts/posts.component';
import { SortableColumnComponent } from './sortable-table/sortable-column.component';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { PostsService } from './posts.service';
import { SortService } from './sortable-table/sort.service';

import { NgxPaginationModule } from 'ngx-pagination';
import { Ng2SearchPipeModule } from 'ng2-search-filter';

import { SortableTableDirective } from './sortable-table/sortable-table.directive';


const Routes = [
  {
    path: '',
    redirectTo: 'posts',
    pathMatch: 'full'
  },
  {
    path: 'posts',
    component: PostsComponent
  }
];

@NgModule({
  declarations: [
    AppComponent,
    PostsComponent,
    SortableColumnComponent,
    SortableTableDirective,
    // FormatTimePipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
    RouterModule.forRoot(Routes),
    NgxPaginationModule,
    Ng2SearchPipeModule,
  ],
  providers: [PostsService, SortService],
  bootstrap: [AppComponent]
})
export class AppModule { }
