import {
  Component,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Category, Subcategory } from "@globals/models/category";
import { Event } from "@globals/models/event";
import { Settings } from "@globals/models/settings";
import { NominatimGeoService } from "@services/core/location/nominatim-geo.service";
import { PositionService } from "@services/core/location/position.service";
import { SharedObservableService } from "@services/core/shared-observables/shared-observables.service";
import { CategoriesComplexService } from "@services/complex/categories/categories.complex.service";
import { EventsComplexService } from "@services/complex/events/events.complex.service";
import { PROMOTION_CATEGORY } from "@globals/constants/categories.c";
import * as moment from "moment-timezone";
import { NgxSpinnerService } from "ngx-spinner";
import {
  Observable,
  Subscription,
  combineLatest,
  distinctUntilChanged,
  map,
  switchMap,
  tap,
} from "rxjs";
import { SessionStorageService } from "@services/core/session-storage/session-storage.service";
import { CustomRouterService } from "@services/core/custom-router/custom-router.service";
import { Search } from "@globals/types/search.types";
import { MapCenterViewService } from "@services/core/map-center-view/map-center-view.service";
import { isPlatformBrowser } from "@angular/common";
@Component({
  selector: "app-events",
  templateUrl: "./events.component.html",
  styleUrls: ["./events.component.css"],
})
export class EventsComponent implements OnInit, OnDestroy {
  public isDropdown = false;

  //Observables
  private subscriptions$: Array<Subscription> = [];
  isLoadingMoreEvents = false;
  private lastScrollPosition = 0;

  // equal limit at start == start limit
  actualLoadEventLimit;
  startLoadEventLimit = 16;
  offsetLoadEventLimit = 16;

  fetchEventsCompleted = false;
  fetchParamsCompleted = false;
  currentPosition = [];
  mapView = null;
  mapView$;
  eventList: Event[] = [];
  // Applied filtered Category IDs

  categoryList: Category[] = [];

  subcategoryList: Subcategory[] = [];

  search: Search = { searchString: "", event: "Reset" };

  loadMore = false;
  isLoadMoreClicked = false;
  hasLoadedMore = true;

  eventToScrollId = undefined;
  hoveredEventId = null;
  filteredCategory: any = PROMOTION_CATEGORY;
  lastEventListLength = 0;
  hasMoreEventsToLoad = true;
  // filteredSubcategories
  filteredSubcategories = [];
  scrollLeftMax: Boolean;
  scrollRightMax: Boolean;
  lastRunningSubscription: "category" | "searchString" | "hot" | "promotion";
  resetEventList = false;
  // clicked date
  filteredDate: moment.Moment = moment(new Date()).utcOffset(0, false).set({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  storageLocationObservation$: Subscription;

  public getScreenWidth: number;
  public settings: Settings;
  mapCenter: number[];
  constructor(
    private eventsComplexService: EventsComplexService,
    private spinner: NgxSpinnerService,
    private _activatedRoute: ActivatedRoute,
    private geoService: NominatimGeoService,
    private categoriesComplexService: CategoriesComplexService,
    private positionService: PositionService,
    private sharedObservables: SharedObservableService,
    private customRouterService: CustomRouterService,
    private mapCenterViewService: MapCenterViewService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.actualLoadEventLimit = this.startLoadEventLimit;
    const searchString$ = this.sharedObservables.searchStringObservable;
    const position$ = this.positionService.positionObservable;
    const categoryList$ =
      this.categoriesComplexService.getCategoriesSortedByWeight();

    categoryList$
      .pipe(
        tap((categoryList) => {
          this.categoryList = categoryList;
        }),
        switchMap((categoryList: Category[]) => {
          let queryParams$ =
            this.customRouterService.getQueryParamsEventsComponent(
              this.settings,
              categoryList
            );

          return combineLatest([queryParams$, searchString$, position$]);
        }),
        distinctUntilChanged()
      )
      .subscribe({
        next: ([queryParams, searchString, position]) => {
          this.spinner.show();
          // Handle the combined values here
          [
            this.filteredDate,
            this.filteredCategory,
            this.filteredSubcategories,
          ] = queryParams;
          this.sharedObservables.setSearchString(searchString);
          this.search = searchString;
          this.currentPosition = position;
          const req = this.createRequestObject(false);
          this.applyFilters(req);
        },
        error: (error) => {
          console.error(error);
        },
        complete: () => {
          console.log("Subscription should never complete");
        },
      });

    this.mapView = this.mapCenterViewService.isMapViewObservable.value;
    const mapView$ = this.mapCenterViewService.isMapViewObservable.subscribe({
      next: (isMapView) => {
        console.log("Map view next: ", isMapView);
        this.mapView = isMapView;
      },
    });
    const mapCenter$ = this.mapCenterViewService.mapCenterPosition.subscribe({
      next: (mapCenter) => {
        this.mapCenter = mapCenter;
      },
    });

    this.sharedObservables.settingsObservable.subscribe({
      next: (settings) => {
        console.log("Settings next: ", settings);
      },
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        console.log("Settings subsription should never complete");
      },
    });

    this.subscriptions$.push(mapView$, mapCenter$);
  }
  createRequestObject(hasMapCenterChanged) {
    const germanyTime = new Date().toLocaleTimeString("en-DE", {
      timeZone: "Europe/Berlin",
    });
    if (this.search.event === "Input") {
      return {
        searchString: this.search.searchString,
        limit: this.actualLoadEventLimit,
        alreadyReturnedEventIds: [],
        date: this.filteredDate,
        categories: this.categoryList.map((cat) => cat._id),
      };
    } else {
      return {
        event: "Params",
        date: this.filteredDate,
        time: germanyTime,
        cat: [this.filteredCategory],
        subcat: this.filteredSubcategories,
        limit: this.offsetLoadEventLimit,
        alreadyReturnedEventIds:
          this.startLoadEventLimit === this.actualLoadEventLimit
            ? []
            : this.eventList.map((event) => event._id),
        currentPosition: hasMapCenterChanged
          ? this.mapCenter
          : this.currentPosition,
      };
    }
  }
  ngOnDestroy(): void {
    this.subscriptions$.forEach((subscription$) => {
      if (subscription$) {
        subscription$.unsubscribe();
      }
    });
  }

  ngOnInit(): void {
    console.log("Position");
    this.positionService.getPositionByLocation();

    const settings$ = this.sharedObservables.settingsObservable.subscribe(
      (settings) => {
        if (settings) {
          this.settings = settings;
        }
      }
    );
    this.subscriptions$.push(settings$);
  }

  applyFilters(req) {
    console.log("Apply filters", req);
    const event$ = this.eventsComplexService
      .getEventsSubscriptionBasedOnTypeAndCategory(req)
      .subscribe({
        next: (events) => {
          this.resetEventList = true;
          this.handlyEventListLoaded(events);
        },
        error: (error) => {
          console.error(error);
        },
        complete: () => {
          this.onFetchEventsCompleted();
        },
      });
    this.subscriptions$.push(event$);
  }
  get_distance_to_current_position(event) {
    // get distance
    const dist = this.geoService.get_distance(this.currentPosition, [
      event.geoData.lat,
      event.geoData.lon,
    ]);
    return dist;
  }

  loadMoreEvents(mapCenter = undefined) {
    console.log("Load more events");
    if (this.loadMore) {
      this.isLoadMoreClicked = mapCenter ? false : true;
      this.actualLoadEventLimit += this.offsetLoadEventLimit;
      this.resetEventList = false;
      const req = this.createRequestObject(false);
      this.applyFilters(req);
    }
  }

  getEventFromId() {
    const event = this.eventList.find(
      (event) => event._id === this.hoveredEventId
    );
    return event || null;
  }

  changeToMapView() {
    this.mapView ? (this.mapView = false) : (this.mapView = true);
    this.mapCenterViewService.setMapViewData(this.mapView);
  }

  onFetchEventsCompleted() {
    console.log("Fetch events completed");
    this.fetchEventsCompleted = true;
    if (this.lastEventListLength <= this.eventList.length) {
      this.hasMoreEventsToLoad = false;
    }
    this.lastEventListLength = this.eventList.length;
    this.spinner.hide();
  }

  handlyEventListLoaded(events: Event[]) {
    this.eventList = !this.resetEventList
      ? [...this.eventList, ...events]
      : events;
    this.loadMore = this.eventList.length >= this.actualLoadEventLimit;
    if (this.isLoadMoreClicked) {
      this.isLoadMoreClicked = false;
    }
  }

  @HostListener("window:resize", ["$event"])
  getScreenSize(event?) {
    this.getScreenWidth = window.innerWidth;
    this.setScrollMaxBool();
  }

  scrollRight() {
    const element = document.getElementById("main-category-container");
    if (element) {
      element.scrollLeft += 80;
    }
    this.setScrollMaxBool();
    // if max scrolled true then true
  }

  scrollLeft() {
    const element = document.getElementById("main-category-container");
    if (element) {
      element.scrollLeft -= 80;
    }
    this.setScrollMaxBool();
  }

  @HostListener("window:mouseover", ["$event"])
  setScrollMaxBool() {
    const element = document.getElementById("main-category-container");
    if (element) {
      this.scrollLeftMax = element.scrollLeft === 0;
      this.scrollRightMax =
        element.scrollLeft === element.scrollWidth - element.clientWidth;
    }
  }

  onScroll(event): void {
    const element = event.target;
    const distanceToTop: number = element.scrollTop;
    const distanceToBottom =
      element.scrollHeight - element.clientHeight - element.scrollTop;
    if (this.isScrollingDown(element)) {
      //this.sharedObservables.notifyScrolling("down");
      const scroll = {
        direction: "down" as any,
        distanceTop: distanceToTop,
        distanceBottom: distanceToBottom,
      };
      this.sharedObservables.notifyScrollOutInOfScreen(scroll);
    } else {
      const scroll = {
        direction: "up" as any,
        distanceTop: distanceToTop,
        distanceBottom: distanceToBottom,
      };
      this.sharedObservables.notifyScrollOutInOfScreen(scroll);
      // this.sharedObservables.notifyScrolling("up");
    }
    // Check if the div is scrolled to the bottom
    if (
      this.isScrolledToBottom(element) &&
      !this.isLoadingMoreEvents &&
      this.loadMore
    ) {
      this.isLoadingMoreEvents = true;
      this.loadMoreEvents();
      setTimeout(() => {
        this.isLoadingMoreEvents = false;
      }, 750);
    }
  }

  isScrolledToBottom(element: HTMLElement): boolean {
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 5;
    return atBottom;
  }

  // return true if scrolling down, false if scrolling up
  isScrollingDown(element: HTMLElement) {
    const currentScrollPosition = element.scrollTop;

    if (currentScrollPosition > this.lastScrollPosition) {
      this.lastScrollPosition = currentScrollPosition;
      return true;
    }
    // Check if scrolling up
    else if (currentScrollPosition < this.lastScrollPosition) {
      this.lastScrollPosition = currentScrollPosition;
      return false;
    }
  }

  private resetLoadingLimit() {
    this.actualLoadEventLimit = this.startLoadEventLimit;
  }

  //TODO time
  closeSpinnerAfterTimeout() {
    setTimeout(() => {
      this.spinner.hide();
    }, 1);
  }
}

class DateClicked {
  date: moment.Moment;
  isClicked: boolean;
}