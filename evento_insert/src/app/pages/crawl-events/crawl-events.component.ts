import { Component, OnInit } from "@angular/core";
import * as moment from "moment";
import { NgxSpinnerService } from "ngx-spinner";
import { finalize, forkJoin, map, of } from "rxjs";
import { Event } from "src/app/models/event";
import { Organizer } from "src/app/models/organizer";
import { OrganizerService } from "src/app/services/organizer.web.service";
import { SnackbarService } from "src/app/services/utils/snackbar.service";
import { crawlerConfig } from "../../../constants/browseAi";
import { CrawlerApiService } from "../../services/crawler/crawler-api.service";
import { crawlBrowseAi } from "./specific-crawler/browseAI.subscription";
import { mapIfzToEvents } from "./specific-crawler/ifz-helper";
import { mapLeipzigToEvents } from "./specific-crawler/leipzig-helper";
import { mapUrbaniteToEvents } from "./specific-crawler/urbanite-helper";

export type PossibleCrawlerNames = keyof typeof crawlerConfig | "All";

@Component({
  selector: "app-crawl-events",
  templateUrl: "./crawl-events.component.html",
  styleUrls: ["./crawl-events.component.css"],
})
export class CrawlEventsComponent implements OnInit {
  message;
  crawlerConfig = crawlerConfig;
  crawlerNames = [...Object.keys(crawlerConfig), "All"];
  selectedInputDate = new Date();
  crawledEventList: Event[] = [];
  allOrganizer: Organizer[] = [];
  inputNumberOfDays: number = 1;
  organizerIn: Organizer;
  eventIn: Event;
  organizer$;
  index = 0;
  linkList = [];
  actualCrawler: PossibleCrawlerNames = "urbanite";

  constructor(
    private crawlerService: CrawlerApiService,
    private snackbar: SnackbarService,
    private organizerService: OrganizerService,
    private spinner: NgxSpinnerService
  ) {}
  ngOnInit(): void {
    this.organizerService.getOrganizer().subscribe((org) => {
      this.allOrganizer = org;
    });
  }

  nextEvent() {
    if (this.index === this.crawledEventList.length - 1) {
      console.error("Index too big. Not that many Elements in the list.");
    } else {
      this.index++;
      this.eventIn = this.crawledEventList[this.index];
      this.findOrganizer();
    }
  }
  previousEvent() {
    if (this.index === 0) {
      console.error("Index smaller than 0.");
    } else {
      this.index--;
      this.eventIn = this.crawledEventList[this.index];
      this.findOrganizer();
    }
  }
  getRobots() {
    this.crawlerService.getRobots().subscribe((res) => {
      this.message = res["messageCode"];
    });
  }

  setIndex(index) {
    this.index = Number(index);
    if (index > this.crawledEventList.length) {
      console.error("Index too big. Not that many Elements in the list.");
    } else if (index < 0) {
      console.error("Index smaller than 0.");
    } else {
      this.eventIn = this.crawledEventList[this.index];
    }
  }

  startCrawling(crawlerKey: PossibleCrawlerNames) {
    this.actualCrawler = crawlerKey;
    if (crawlerKey === "All") {
      this.crawlAllCrawler();
    } else {
      const crawler = crawlerConfig[crawlerKey];
      const [crawling$, mapCrawledEventsFunction] =
        this.crawlEventsOfSpecificCrawler(crawlerKey, crawler);
      crawling$.subscribe({
        next: (eventList) => {
          console.log("Final crawled events: ", eventList.flat());
          this.spinner.hide();
          this.crawledEventList = mapCrawledEventsFunction(eventList.flat());
          this.index = 0;
          this.eventIn = this.crawledEventList[this.index];
          this.findOrganizer();
        },
        error: (error) => {
          // Handle error here
          this.spinner.hide();
          this.snackbar.openSnackBar(
            error.message || error.error.text || error.error || error,
            "error",
            2000
          );
          console.error("An error occurred while fetching", error.error);
        },
        complete: () => {
          console.log("complete");
          this.spinner.hide();
        },
      });
    }
  }
  crawlAllCrawler() {
    const observables = this.crawlerNames.map(
      (crawlerName: PossibleCrawlerNames) => {
        if (crawlerName !== "All" && crawlerName !== "leipzig") {
          const crawler = crawlerConfig[crawlerName];

          const [crawling$, mapCrawledEventsFunction] =
            this.crawlEventsOfSpecificCrawler(crawlerName, crawler);

          return crawling$.pipe(
            // Map the result using mapCrawledEventsFunction
            map((eventList: any) => {
              return mapCrawledEventsFunction(eventList.flat());
            }),
            finalize(() => {
              console.log("Finished crawling for", crawlerName);
            })
          );
        }

        return of(null); // Return an empty observable for 'All' crawler
      }
    );
    const forkedSubscription = forkJoin(observables).subscribe({
      next: (results) => {
        let filteredResult = results
          .filter((result) => result !== null && Object.keys(result).length > 0)
          .flat();
        filteredResult = filteredResult.filter((event, index, array) => {
          return (
            array.findIndex(
              (e) => e.name === event.name && e.date.start === event.date.start
            ) === index
          );
        });
        this.crawledEventList = filteredResult;
        this.index = 0;
        this.eventIn = this.crawledEventList[this.index];
        this.findOrganizer();
        console.log(
          "Collected results after each subscription completes:",
          filteredResult
        );
      },
      error: (error) => {
        // Handle error for forkJoin
        this.spinner.hide();

        this.snackbar.openSnackBar(
          error.message || error.error.text || error.error || error,
          "error",
          2000
        );
        console.error("An error occurred while fetching", error.error);
        forkedSubscription.unsubscribe();
        console.error("An error occurred while combining results", error);
      },
      complete: () => {
        this.spinner.hide();
        console.log("COMPLETED All Subscriptions");
      },
    });
  }

  getUrlForCrawler(crawlerName: PossibleCrawlerNames, crawler, inputDate) {
    if (crawlerName === "urbanite") {
      return crawler.inputUrl + moment(inputDate).format("YYYY-MM-DD");
    }
    if (crawlerName === "leipzig") {
      const customDate = new Date(inputDate);
      const customDateObj = new Date(customDate);

      // Extract day, month, and year components from the custom date
      const day = customDateObj.getDate().toString().padStart(2, "0");
      const month = (customDateObj.getMonth() + 1).toString().padStart(2, "0"); // Months are zero-based
      const year = customDateObj.getFullYear();

      const formattedDate = `${day}.${month}.${year}`;
      const newUrl = crawler.inputUrl
        .replace(
          /mksearch%5Bdate_from%5D=\d{2}\.\d{2}\.\d{4}/,
          `mksearch%5Bdate_from%5D=${formattedDate}`
        )
        .replace(
          /mksearch%5Bdate_to%5D=\d{2}\.\d{2}\.\d{4}/,
          `mksearch%5Bdate_to%5D=${formattedDate}`
        );

      return newUrl;
    }
    if (crawlerName === "ifz") {
      return crawler.inputUrl;
    }
  }

  crawlEventsOfSpecificCrawler(crawlerName: PossibleCrawlerNames, crawler) {
    this.spinner.show();

    let urls = [];
    for (let i = 0; i <= this.inputNumberOfDays; i++) {
      urls.push(
        this.getUrlForCrawler(
          crawlerName,
          crawler,
          moment(this.selectedInputDate).add(i, "days").toDate()
        )
      );
    }
    let crawlings$;
    let mapCrawledEventsFunction: Function;

    switch (crawlerName) {
      case "urbanite":
        crawlings$ = forkJoin(
          urls.map((url) =>
            crawlBrowseAi(crawler, url, this.crawlerService, crawlerName)
          )
        );
        mapCrawledEventsFunction = mapUrbaniteToEvents;
        break;
      case "leipzig":
        crawlings$ = forkJoin(
          urls.map((url) => {
            return crawlBrowseAi(
              crawler,
              url,
              this.crawlerService,
              crawlerName
            );
          })
        );
        mapCrawledEventsFunction = mapLeipzigToEvents;
      case "ifz":
        crawlings$ = crawlBrowseAi(
          crawler,
          urls[0],
          this.crawlerService,
          crawlerName
        );
        mapCrawledEventsFunction = mapIfzToEvents;
    }
    return [crawlings$, mapCrawledEventsFunction];
  }
  findOrganizer() {
    const filteredOrganizer = this.allOrganizer.filter(
      (organizer) =>
        organizer.name.toLowerCase() ===
          this.eventIn.organizerName?.toLowerCase() ||
        organizer.alias.some(
          (aliasName) =>
            aliasName.toLowerCase() ===
            this.eventIn?.organizerName.toLowerCase()
        )
    );

    if (filteredOrganizer.length < 1) {
      this.organizerIn = new Organizer();
      this.organizerIn.name = this.eventIn.organizerName;
      this.organizerIn.category = this.eventIn.category
        ? this.eventIn.category
        : undefined;
      this.organizerIn.address.city = this.eventIn.address?.city
        ? this.eventIn.address.city
        : "";
      this.organizerIn.address.plz = this.eventIn.address?.plz
        ? this.eventIn.address.plz
        : "";
      this.organizerIn.address.street = this.eventIn.address?.street
        ? this.eventIn.address.street
        : "";
      this.organizerIn.address.streetNumber = this.eventIn.address?.streetNumber
        ? this.eventIn.address.streetNumber
        : "";
      this.organizerIn.address.country = this.eventIn.address?.country
        ? this.eventIn.address.country
        : "Deutschland";
    } else {
      //wenn es organizer gibt dann baue direkt das event
      this.organizerIn = filteredOrganizer[0];
      //todo Event befüllen

      const e = this.eventIn;
      e._organizerId = this.organizerIn._id;
      e.organizerName = this.organizerIn.name;
      if (!e.category) e.category = this.organizerIn.category;
      if (!e.address) e.address = this.organizerIn.address;
      if (!e.description) e.description = this.organizerIn.description;
      this.eventIn = e;
    }
  }
  newOrganizer(organizer) {
    this.allOrganizer.push(organizer);
    this.findOrganizer();
  }
  onDateChange(date: any): void {
    this.selectedInputDate = new Date(date);
  }
}
