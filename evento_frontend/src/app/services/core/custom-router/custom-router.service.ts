import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import {
  NOW_CATEGORY,
  PROMOTION_CATEGORY,
} from "@globals/constants/categories.c";
import { SUBDOMAIN_URLS } from "@globals/constants/subdomainUrls";
import { Settings } from "@globals/models/settings";
import { CategoriesComplexService } from "@services/complex/categories/categories.complex.service";
import moment from "moment";
import { NgxSpinnerService } from "ngx-spinner";
import {
  Observable,
  ReplaySubject,
  filter,
  map,
  of,
  switchMap,
  tap,
} from "rxjs";
@Injectable({
  providedIn: "root",
})
export class CustomRouterService {
  constructor(
    private router: Router,
    private _activatedRoute: ActivatedRoute,
    private categoriesComplexService: CategoriesComplexService,
    private spinner: NgxSpinnerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  queryParamsSubject: ReplaySubject<any> = new ReplaySubject<any>(1);
  subdomainSubject: ReplaySubject<any> = new ReplaySubject<any>(1);
  categoryList = [];
  getSubdomain(): Observable<string> {
    return this.router.events.pipe(
      filter(
        (event: any) =>
          event instanceof NavigationEnd ||
          event.routerEvent instanceof NavigationEnd
      ),
      map((event: any) => {
        const url = event?.url || event?.routerEvent?.url;
        return (
          SUBDOMAIN_URLS.find((substring) => url.includes(substring)) || ""
        );
      }),
      tap((url) => this.subdomainSubject.next(url))
    );
  }
  getQueryParams(): Observable<any> {
    return this.router.events.pipe(
      filter(
        (event: any) =>
          (event instanceof NavigationEnd &&
            !SUBDOMAIN_URLS.some((subdomain) =>
              event.url.includes(subdomain)
            )) ||
          (event.routerEvent instanceof NavigationEnd &&
            !SUBDOMAIN_URLS.some((subdomain) =>
              event.routerEvent.url.includes(subdomain)
            ))

        // this is the issue
        //||
        //event.routerEvent instanceof NavigationSkipped
      ),
      map(() => this._activatedRoute.snapshot.queryParams),
      tap((qp) => this.queryParamsSubject.next(qp))
    );
  }

  getInitialQueryParamsSSR() {
    return of(this._activatedRoute.snapshot.queryParams);
  }

  getQueryParamsEventsComponent(settings: Settings): Observable<any> {
    const categoryList$ =
      this.categoriesComplexService.getCategoriesSortedByWeight();
    return categoryList$.pipe(
      tap((categoryList) => {
        this.spinner.show();
        this.categoryList = categoryList;
      }),
      switchMap(() => {
        if (isPlatformBrowser(this.platformId)) return this.queryParamsSubject;
        else return this.getInitialQueryParamsSSR();
      }),
      map((queryParams) => {
        const date = moment(queryParams.date);
        // append the hours of the current time zone because the post request will automatically
        // change to time with time zone an this could change the date
        date.add(moment(new Date()).utcOffset() / 60, "hours");
        let category = queryParams.category;
        if (category === "1") {
          category = settings.isPromotionActivated
            ? PROMOTION_CATEGORY
            : this.categoryList[0];
        } else if (category === "2") {
          category = NOW_CATEGORY;
        } else {
          category = category
            ? this.categoryList.find((c) => c._id === category)
            : this.categoryList[0];
        }
        let subcategories;
        if (queryParams.subcategory) {
          subcategories = category.subcategories?.filter((s) =>
            queryParams.subcategory.includes(s._id)
          );
        } else {
          subcategories = [];
        }

        return [date, category, subcategories];
      })
    );
  }
  getQueryParamsCategoryListComponent(settings: Settings): Observable<any> {
    const categoryList$ =
      this.categoriesComplexService.getCategoriesSortedByWeight();
    return categoryList$.pipe(
      tap((categoryList) => {
        this.spinner.show();
        this.categoryList = categoryList;
      }),
      switchMap(() => {
        if (isPlatformBrowser(this.platformId)) return this.queryParamsSubject;
        else return this.getInitialQueryParamsSSR();
      }),
      map((queryParams) => {
        let category = queryParams.category;
        if (category === "1") {
          category = settings.isPromotionActivated
            ? PROMOTION_CATEGORY
            : this.categoryList[0];
        } else if (category === "2") {
          category = NOW_CATEGORY;
        } else {
          category = category
            ? this.categoryList.find((c) => c._id === category)
            : this.categoryList[0];
        }
        let subcategories;
        if (queryParams.subcategory) {
          subcategories = category.subcategories?.filter((s) =>
            queryParams.subcategory.includes(s._id)
          );
        } else {
          subcategories = [];
        }

        return [this.categoryList, category, subcategories];
      }),
      tap((qp) => {
        console.log("Query params: ", qp);
      })
    );
  }
}
